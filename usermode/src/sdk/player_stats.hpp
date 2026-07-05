#pragma once

#include "sdk/dead_offsets.hpp"
#include "sdk/hero_ids.hpp"

struct player_stats_t
{
	uint32_t m_hero_id = 0;
	int32_t m_health = 0;
	int32_t m_health_max = 0;
	uint8_t m_team = 0;
	bool m_valid = false;
};

inline bool is_valid_entity_designer_name(const std::string& name)
{
	if (name.empty() || name.size() > 48)
		return false;

	for (const auto ch : name)
	{
		if (ch >= 'a' && ch <= 'z')
			continue;

		if (ch >= '0' && ch <= '9')
			continue;

		if (ch == '_')
			continue;

		return false;
	}

	return true;
}

std::string read_entity_designer_name(uintptr_t entity_addr);

inline player_stats_t read_controller_stats(const uintptr_t controller_addr)
{
	player_stats_t stats{};

	if (controller_addr < 0x10000 || controller_addr >= 0x7FFFFFFFFFFF)
		return stats;

	const auto pdg_base = controller_addr + dl_off::m_PlayerDataGlobal;
	stats.m_hero_id = static_cast<uint32_t>(m_memory->read_t<int32_t>(pdg_base + dl_off::pdg_m_nHeroID));
	stats.m_health_max = m_memory->read_t<int32_t>(pdg_base + dl_off::pdg_m_iHealthMax);
	stats.m_health = m_memory->read_t<int32_t>(pdg_base + dl_off::pdg_m_iHealth);
	stats.m_team = m_memory->read_t<uint8_t>(controller_addr + dl_off::m_iTeamNum);
	const auto alive = m_memory->read_t<bool>(pdg_base + dl_off::pdg_m_bAlive);

	if (stats.m_hero_id <= 0)
		return stats;

	if (stats.m_health_max < 100 || stats.m_health_max > 5000)
		return stats;

	if (!alive || stats.m_health <= 0)
		stats.m_health = 0;
	else if (stats.m_health < 0)
		stats.m_health = 0;
	else if (stats.m_health > stats.m_health_max)
		return stats;

	stats.m_valid = true;
	return stats;
}
