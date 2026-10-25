#include "pch.hpp"

#include <algorithm>
#include <atomic>
#include <format>
#include <mutex>

namespace
{
	struct reader_runtime_config_t
	{
		bool performance_mode = false;
		int update_hz = 20;
		int full_scan_every = 4;
		bool low_priority = false;
		bool skip_unchanged = false;
	};

	std::mutex g_config_mutex;
	reader_runtime_config_t g_config{};
	std::atomic<bool> g_force_full_scan{ false };
	std::atomic<bool> g_reload_requested{ false };
	std::string g_last_payload;

	void diag(const char* msg)
	{
		printf("%s\n", msg);
		fflush(stdout);

		if (FILE* f = fopen("usermode_diag.log", "a"))
		{
			fprintf(f, "%s\n", msg);
			fclose(f);
		}
	}

	std::string normalize_ip(std::string ip)
	{
		if (ip.empty() || ip == "localhost")
			return "127.0.0.1";
		return ip;
	}

	void apply_process_priority(const bool low_priority)
	{
		const HANDLE process = GetCurrentProcess();
		const DWORD desired = low_priority ? BELOW_NORMAL_PRIORITY_CLASS : NORMAL_PRIORITY_CLASS;
		if (!SetPriorityClass(process, desired))
			diag("failed to set process priority");
		else
			diag(low_priority ? "process priority: below normal" : "process priority: normal");
	}

	reader_runtime_config_t snapshot_config()
	{
		std::lock_guard lock(g_config_mutex);
		return g_config;
	}

	void handle_control_message(const std::string& text)
	{
		nlohmann::json parsed;
		try
		{
			parsed = nlohmann::json::parse(text);
		}
		catch (...)
		{
			return;
		}

		if (!parsed.contains("m_message_type") || parsed["m_message_type"] != "reader_control")
			return;

		const auto command = parsed.value("m_command", "");
		if (command == "reload_map")
		{
			g_reload_requested.store(true);
			g_force_full_scan.store(true);
			diag("reload_map requested");
			return;
		}

		if (command != "set_performance")
			return;

		reader_runtime_config_t next{};
		next.performance_mode = parsed.value("m_performance_mode", false);
		next.update_hz = parsed.value("m_update_hz", 10);
		next.low_priority = parsed.value("m_low_priority", true);
		next.skip_unchanged = parsed.value("m_skip_unchanged", true);

		const auto full_scan_ms = parsed.value("m_full_scan_interval_ms", 2000);
		const auto tick_ms = next.performance_mode
			? std::max(50, 1000 / std::clamp(next.update_hz, 5, 20))
			: 50;
		next.full_scan_every = next.performance_mode
			? std::max(1, full_scan_ms / tick_ms)
			: 4;

		if (!next.performance_mode)
		{
			next.update_hz = 20;
			next.full_scan_every = 4;
			next.low_priority = false;
			next.skip_unchanged = false;
		}
		else
		{
			next.update_hz = std::clamp(next.update_hz, 5, 20);
		}

		bool priority_changed = false;
		{
			std::lock_guard lock(g_config_mutex);
			priority_changed = g_config.low_priority != next.low_priority
				|| g_config.performance_mode != next.performance_mode;
			g_config = next;
		}

		if (priority_changed)
			apply_process_priority(next.performance_mode && next.low_priority);

		diag(std::format(
			"performance mode {} (hz={}, full_scan_every={}, skip_unchanged={})",
			next.performance_mode ? "ON" : "OFF",
			next.update_hz,
			next.full_scan_every,
			next.skip_unchanged ? "yes" : "no").c_str());
	}

	bool connect_websocket(ix::WebSocket& web_socket, const std::string& url)
	{
		std::mutex handshake_mutex;
		std::condition_variable handshake_cv;
		bool connected = false;
		bool failed = false;

		web_socket.setUrl(url);
		web_socket.enableAutomaticReconnection();
		web_socket.setMinWaitBetweenReconnectionRetries(1000);
		web_socket.setOnMessageCallback([&](const ix::WebSocketMessagePtr& msg)
		{
			if (msg->type == ix::WebSocketMessageType::Open)
			{
				{
					std::lock_guard lock(handshake_mutex);
					connected = true;
				}
				handshake_cv.notify_one();
				LOG_INFO("connected to the web socket ('%s')", url.c_str());
			}
			else if (msg->type == ix::WebSocketMessageType::Error)
			{
				{
					std::lock_guard lock(handshake_mutex);
					failed = true;
				}
				handshake_cv.notify_one();
				LOG_ERROR("failed to connect to the web socket ('%s')", url.c_str());
			}
			else if (msg->type == ix::WebSocketMessageType::Message)
			{
				handle_control_message(msg->str);
			}
		});

		web_socket.start();

		{
			std::unique_lock lock(handshake_mutex);
			handshake_cv.wait_for(lock, std::chrono::seconds(15), [&] { return connected || failed; });
		}

		return connected;
	}

	nlohmann::json make_waiting_payload(const char* state, const char* detail)
	{
		return nlohmann::json{
			{"m_source", "live"},
			{"m_local_team", 0},
			{"m_players", nlohmann::json::array()},
			{"m_minimap_mins", {{"x", -8192}, {"y", -8192}, {"z", 0}}},
			{"m_minimap_maxs", {{"x", 8192}, {"y", 8192}, {"z", 0}}},
			{"m_debug", {
				{"reader_state", state},
				{"reader_detail", detail},
				{"entity_system_ok", false},
				{"game_rules_ok", false},
				{"local_controller_found", false},
			}},
		};
	}

	bool try_initialize_game()
	{
		if (!m_memory->setup())
			return false;

		if (!i::setup())
			return false;

		if (!schema::setup())
			LOG_WARNING("schema dump unavailable - using hardcoded offsets");

		return true;
	}
}

bool main()
{
	diag("radar_reader starting");

	config_data_t config_data = {};
	if (!cfg::setup(config_data))
	{
		diag("config failed");
		std::this_thread::sleep_for(std::chrono::seconds(5));
		return {};
	}

	const auto ws_port = config_data.m_port > 0 ? config_data.m_port : 5173;
	const auto ws_ip = normalize_ip(config_data.m_ip);
	const auto formatted_address = std::format("ws://{}:{}/deadlock_webradar", ws_ip, ws_port);
	diag(formatted_address.c_str());

	ix::initNetSystem();

	static ix::WebSocket web_socket;
	while (!connect_websocket(web_socket, formatted_address))
	{
		diag("websocket connect failed, retrying in 2s");
		std::this_thread::sleep_for(std::chrono::seconds(2));
	}

	diag("websocket connected, waiting for deadlock.exe");

	bool game_ready = false;
	auto next_init_attempt = std::chrono::steady_clock::now();
	uint32_t tick_counter = 0;

	for (;;)
	{
		if (g_reload_requested.exchange(false))
		{
			// Lobby and match use different entity lists. Re-resolve pointers
			// so pawns exist again without restarting the reader.
			if (m_memory->is_target_running())
			{
				if (i::setup())
					diag("rebound entity system and game rules");
				else
					diag("map reload could not rebind entity system");
			}

			sdk::update();
			f::clear_caches();
			g_last_payload.clear();
			g_force_full_scan.store(true);
			diag("cleared player/position caches for map reload");
		}

		if (!game_ready)
		{
			const auto now = std::chrono::steady_clock::now();
			if (now >= next_init_attempt)
			{
				game_ready = try_initialize_game();
				next_init_attempt = now + std::chrono::seconds(game_ready ? 0 : 2);
				if (!game_ready)
					diag("waiting for deadlock.exe - launch the game and join a match");
			}

			if (!game_ready)
			{
				web_socket.send(make_waiting_payload(
					"waiting_game",
					"deadlock.exe not ready - join a match, then data will appear"));
				std::this_thread::sleep_for(std::chrono::milliseconds(500));
				continue;
			}

			diag("deadlock memory initialized");
		}
		else if (!m_memory->is_target_running())
		{
			game_ready = false;
			f::clear_caches();
			g_last_payload.clear();
			diag("deadlock.exe closed - waiting for game");
			continue;
		}

		const auto config = snapshot_config();
		const auto tick_ms = config.performance_mode
			? std::max(50, 1000 / std::clamp(config.update_hz, 5, 20))
			: 50;
		const auto full_scan_every = std::max(1, config.full_scan_every);

		sdk::update();

		const bool do_full = g_force_full_scan.exchange(false)
			|| (tick_counter % static_cast<uint32_t>(full_scan_every)) == 0;
		if (do_full)
			f::run();
		else
			f::run_fast();

		f::m_debug["performance_mode"] = config.performance_mode;
		f::m_debug["update_hz"] = config.performance_mode ? config.update_hz : 20;
		f::m_debug["full_scan_every"] = full_scan_every;
		f::m_debug["tick_ms"] = tick_ms;
		f::m_data["m_debug"] = f::m_debug;

		const auto payload = f::m_data.dump();
		if (!(config.performance_mode && config.skip_unchanged && payload == g_last_payload))
		{
			web_socket.send(payload);
			g_last_payload = payload;
		}

		std::this_thread::sleep_for(std::chrono::milliseconds(tick_ms));
		++tick_counter;
	}

	return true;
}
