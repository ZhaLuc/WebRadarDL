#include "pch.hpp"
#include "sdk/player_stats.hpp"
#include <set>

namespace
{
	bool is_remote_ptr(const uintptr_t address)
	{
		return address >= 0x10000 && address < 0x7FFFFFFFFFFF;
	}

	bool try_read_handle_vector(const uintptr_t entity_addr, const uint32_t offset, std::vector<uint32_t>& out_handles)
	{
		const auto count = m_memory->read_t<int32_t>(entity_addr + offset);
		const auto data = m_memory->read_t<uintptr_t>(entity_addr + offset + 0x8);

		if (count <= 0 || count > 12 || !is_remote_ptr(data))
			return false;

		out_handles.clear();
		out_handles.reserve(static_cast<size_t>(count));

		for (int32_t i = 0; i < count; i++)
		{
			const auto handle = m_memory->read_t<uint32_t>(data + static_cast<uintptr_t>(i) * sizeof(uint32_t));
			const auto entry_idx = handle & ENT_ENTRY_MASK;
			if (entry_idx == 0 || entry_idx == ENT_ENTRY_MASK)
				return false;

			out_handles.push_back(handle);
		}

		return true;
	}

	void try_add_controller(const int32_t controller_idx, const uintptr_t controller_addr, const uintptr_t pawn_hint, std::vector<player_entry_t>& out)
	{
		if (!is_remote_ptr(controller_addr))
			return;

		const auto stats = read_controller_stats(controller_addr);
		if (!stats.m_valid)
			return;

		uintptr_t pawn_addr = pawn_hint;
		if (!pawn_addr && i::m_game_entity_system)
		{
			const auto hero_handle = m_memory->read_t<uint32_t>(controller_addr + dl_off::m_hHeroPawn);
			const auto pawn_idx = static_cast<int32_t>(hero_handle & ENT_ENTRY_MASK);
			if (const auto pawn = i::m_game_entity_system->get<c_citadel_player_pawn*>(pawn_idx))
				pawn_addr = reinterpret_cast<uintptr_t>(pawn);
		}

		player_entry_t entry{};
		entry.m_idx = controller_idx;
		entry.m_controller_addr = controller_addr;
		entry.m_pawn_addr = pawn_addr;
		entry.m_stats = stats;
		out.push_back(entry);
	}

	void refresh_entry(player_entry_t& entry)
	{
		if (!is_remote_ptr(entry.m_controller_addr))
			return;

		entry.m_stats = read_controller_stats(entry.m_controller_addr);

		if (!i::m_game_entity_system)
			return;

		const auto hero_handle = m_memory->read_t<uint32_t>(entry.m_controller_addr + dl_off::m_hHeroPawn);
		const auto pawn_idx = static_cast<int32_t>(hero_handle & ENT_ENTRY_MASK);
		if (const auto pawn = i::m_game_entity_system->get<c_citadel_player_pawn*>(pawn_idx))
			entry.m_pawn_addr = reinterpret_cast<uintptr_t>(pawn);
		else
			entry.m_pawn_addr = 0;
	}

	bool export_players(const std::vector<player_entry_t>& entries)
	{
		std::set<uintptr_t> exported_controllers;
		int32_t missing_pawn = 0;
		int32_t exported = 0;

		for (const auto& entry : entries)
		{
			if (!exported_controllers.insert(entry.m_controller_addr).second)
				continue;

			if (!f::players::get_data(entry))
				continue;

			if (!entry.m_pawn_addr)
				missing_pawn++;

			f::m_data["m_players"].push_back(f::m_player_data);
			exported++;
		}

		f::m_debug["controllers_found"] = static_cast<int32_t>(entries.size());
		f::m_debug["controllers_missing_pawn"] = missing_pawn;
		f::m_debug["players_exported"] = exported;
		return exported > 0;
	}
}

void f::run()
{
	m_data = nlohmann::json{};
	m_player_data = nlohmann::json{};
	m_debug = nlohmann::json{};

	m_debug["entity_system_ok"] = i::m_game_entity_system != nullptr;
	m_debug["game_rules_ok"] = i::m_game_rules != nullptr;
	m_debug["local_controller_found"] = sdk::m_local_controller != nullptr;
	m_debug["entity_system_source"] = i::m_entity_system_source;
	m_debug["entity_system_ptr"] = reinterpret_cast<uintptr_t>(i::m_game_entity_system);
	m_debug["update_mode"] = "full";

	if (sdk::m_local_controller)
	{
		const auto local_addr = reinterpret_cast<uintptr_t>(sdk::m_local_controller);
		const auto local_stats = read_controller_stats(local_addr);
		m_debug["local_hero_id"] = local_stats.m_hero_id;
		m_debug["local_health"] = local_stats.m_health;
		m_debug["local_health_max"] = local_stats.m_health_max;
		m_debug["local_stats_valid"] = local_stats.m_valid;
	}

	const auto local_team = sdk::m_local_controller ? sdk::m_local_controller->get_team() : e_team::none;
	m_data["m_local_team"] = static_cast<uint8_t>(local_team);
	m_debug["local_team"] = static_cast<uint8_t>(local_team);
	m_data["m_source"] = "live";

	get_bounds();
	get_player_info();

	m_data["m_debug"] = m_debug;
}

void f::run_fast()
{
	if (m_cached_entries.empty())
	{
		run();
		return;
	}

	m_data = nlohmann::json{};
	m_player_data = nlohmann::json{};
	m_debug = nlohmann::json{};

	m_debug["entity_system_ok"] = i::m_game_entity_system != nullptr;
	m_debug["game_rules_ok"] = i::m_game_rules != nullptr;
	m_debug["local_controller_found"] = sdk::m_local_controller != nullptr;
	m_debug["entity_system_source"] = i::m_entity_system_source;
	m_debug["entity_system_ptr"] = reinterpret_cast<uintptr_t>(i::m_game_entity_system);
	m_debug["update_mode"] = "fast";

	if (sdk::m_local_controller)
	{
		const auto local_addr = reinterpret_cast<uintptr_t>(sdk::m_local_controller);
		const auto local_stats = read_controller_stats(local_addr);
		m_debug["local_hero_id"] = local_stats.m_hero_id;
		m_debug["local_health"] = local_stats.m_health;
		m_debug["local_health_max"] = local_stats.m_health_max;
		m_debug["local_stats_valid"] = local_stats.m_valid;
	}

	const auto local_team = sdk::m_local_controller ? sdk::m_local_controller->get_team() : e_team::none;
	m_data["m_local_team"] = static_cast<uint8_t>(local_team);
	m_debug["local_team"] = static_cast<uint8_t>(local_team);
	m_data["m_source"] = "live";

	get_bounds();
	get_player_info_fast();

	m_data["m_debug"] = m_debug;
}

void f::get_bounds()
{
	const auto rules = i::m_game_rules;
	if (!rules)
	{
		m_data["m_minimap_mins"] = { {"x", 0}, {"y", 0}, {"z", 0} };
		m_data["m_minimap_maxs"] = { {"x", 1}, {"y", 1}, {"z", 0} };
		m_debug["bounds_source"] = "fallback";
		return;
	}

	const auto mins = rules->get_minimap_mins();
	const auto maxs = rules->get_minimap_maxs();

	m_data["m_minimap_mins"] = { {"x", mins.m_x}, {"y", mins.m_y}, {"z", mins.m_z} };
	m_data["m_minimap_maxs"] = { {"x", maxs.m_x}, {"y", maxs.m_y}, {"z", maxs.m_z} };
	m_debug["bounds_source"] = "game_rules";
}

void f::get_player_info()
{
	m_data["m_players"] = nlohmann::json::array();

	if (!i::m_game_entity_system)
	{
		m_debug["scan_error"] = "no entity system";
		return;
	}

	std::vector<player_entry_t> entries;
	std::vector<std::string> designer_samples;
	int32_t entities_seen = 0;
	int32_t teams_found = 0;

	if (sdk::m_local_controller)
	{
		const auto local_addr = reinterpret_cast<uintptr_t>(sdk::m_local_controller);
		try_add_controller(-1, local_addr, 0, entries);
	}

	const auto [client_base, client_size] = m_memory->get_module_info(CLIENT_DLL);
	if (client_base.has_value())
	{
		const auto global_local = m_memory->read_t<uintptr_t>(client_base.value() + dl_off::rva_local_controller);
		try_add_controller(-1, global_local, 0, entries);
	}

	for (int32_t idx = 0; idx < 2048; idx++)
	{
		const auto entity = i::m_game_entity_system->get<c_base_entity*>(idx);
		if (!entity)
			continue;

		entities_seen++;
		const auto entity_addr = reinterpret_cast<uintptr_t>(entity);

		const auto designer = read_entity_designer_name(entity_addr);
		if (is_valid_entity_designer_name(designer) && designer_samples.size() < 12)
		{
			if (std::ranges::find(designer_samples, designer) == designer_samples.end())
				designer_samples.push_back(designer);
		}

		if (designer == "citadel_player_controller")
			try_add_controller(idx, entity_addr, 0, entries);

		std::vector<uint32_t> controller_handles;
		std::vector<uint32_t> pawn_handles;
		if (!try_read_handle_vector(entity_addr, dl_off::m_aPlayerControllers, controller_handles))
			continue;

		try_read_handle_vector(entity_addr, dl_off::m_aPlayers, pawn_handles);
		teams_found++;

		for (uint32_t i = 0; i < controller_handles.size(); i++)
		{
			const auto controller_idx = static_cast<int32_t>(controller_handles[i] & ENT_ENTRY_MASK);
			uintptr_t pawn_addr = 0;

			if (i < pawn_handles.size())
			{
				const auto pawn_idx = static_cast<int32_t>(pawn_handles[i] & ENT_ENTRY_MASK);
				if (const auto pawn = i::m_game_entity_system->get<c_citadel_player_pawn*>(pawn_idx))
					pawn_addr = reinterpret_cast<uintptr_t>(pawn);
			}

			if (const auto controller = i::m_game_entity_system->get<c_citadel_player_controller*>(controller_idx))
				try_add_controller(controller_idx, reinterpret_cast<uintptr_t>(controller), pawn_addr, entries);
		}
	}

	m_cached_entries = entries;
	export_players(entries);

	m_debug["entities_with_ptr"] = entities_seen;
	m_debug["designer_samples"] = designer_samples;
	m_debug["teams_found"] = teams_found;
	m_debug["scan_method"] = "stats_validated_v4";
	m_debug["reader_version"] = 4;
}

void f::get_player_info_fast()
{
	m_data["m_players"] = nlohmann::json::array();

	if (!i::m_game_entity_system || m_cached_entries.empty())
	{
		m_debug["scan_error"] = "no cached players";
		return;
	}

	std::vector<player_entry_t> entries = m_cached_entries;
	for (auto& entry : entries)
		refresh_entry(entry);

	m_cached_entries = entries;
	export_players(entries);

	m_debug["scan_method"] = "cached_refresh_v1";
	m_debug["reader_version"] = 4;
}

void f::clear_caches()
{
	m_cached_entries.clear();
	players::clear_position_cache();
	m_debug["scan_method"] = "caches_cleared";
}
