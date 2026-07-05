#include "pch.hpp"

namespace
{
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
			diag("deadlock.exe closed - waiting for game");
			continue;
		}

		sdk::update();

		if ((tick_counter % 4) == 0)
			f::run();
		else
			f::run_fast();

		web_socket.send(f::m_data.dump());
		std::this_thread::sleep_for(std::chrono::milliseconds(50));
		++tick_counter;
	}

	return true;
}
