#pragma once

#include "sdk/player_stats.hpp"

struct player_entry_t
{
	int32_t m_idx = -1;
	uintptr_t m_controller_addr = 0;
	uintptr_t m_pawn_addr = 0;
	player_stats_t m_stats{};
};

namespace f::players
{
	bool get_data(const player_entry_t& entry);
	void clear_position_cache();
}

namespace f
{
	void run();
	void run_fast();
	void get_bounds();
	void get_player_info();
	void get_player_info_fast();
	void clear_caches();

	inline std::vector<player_entry_t> m_cached_entries = {};
	inline nlohmann::json m_data = {};
	inline nlohmann::json m_player_data = {};
	inline nlohmann::json m_debug = {};
}
