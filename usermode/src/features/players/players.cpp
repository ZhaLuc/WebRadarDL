#include "pch.hpp"
#include "sdk/hero_ids.hpp"
#include "sdk/player_stats.hpp"
#include "features/features.hpp"
#include <cctype>
#include <unordered_map>

namespace
{
	std::unordered_map<uintptr_t, f_vector> s_last_positions;

	bool has_world_position(const f_vector& position)
	{
		return position.m_x != 0.f || position.m_y != 0.f;
	}

	std::string hero_display_name(const char* slug)
	{
		if (!slug || slug[0] == '\0' || strcmp(slug, "unknown") == 0)
			return "Unknown Hero";

		std::string name = slug;
		if (!name.empty())
			name[0] = static_cast<char>(toupper(static_cast<unsigned char>(name[0])));

		return name;
	}
}

bool f::players::get_data(const player_entry_t& entry)
{
	if (!entry.m_stats.m_valid)
		return false;

	const auto hero_slug = hero_slug_from_id(entry.m_stats.m_hero_id);
	f_vector vec_origin{};
	f_vector eye_angles{};

	if (entry.m_pawn_addr)
	{
		const auto pawn = reinterpret_cast<c_citadel_player_pawn*>(entry.m_pawn_addr);
		vec_origin = pawn->get_scene_origin();

		auto pawn_health = m_memory->read_t<int32_t>(entry.m_pawn_addr + dl_off::m_iHealth);
		if (pawn_health >= 0 && pawn_health <= entry.m_stats.m_health_max)
		{
			m_player_data["m_health"] = pawn_health;
		}
		else
		{
			m_player_data["m_health"] = entry.m_stats.m_health;
		}

		eye_angles = pawn->get_eye_angles();
	}
	else
	{
		m_player_data["m_health"] = entry.m_stats.m_health;
	}

	f_vector position = vec_origin;
	if (entry.m_pawn_addr && has_world_position(vec_origin))
	{
		s_last_positions[entry.m_controller_addr] = vec_origin;
	}
	else if (const auto cached = s_last_positions.find(entry.m_controller_addr);
		cached != s_last_positions.end())
	{
		position = cached->second;
	}

	const auto is_dead = entry.m_stats.m_health <= 0;
	const auto health = std::max(0, entry.m_stats.m_health <= 0
		? 0
		: m_player_data["m_health"].get<int32_t>());

	const auto is_local = entry.m_controller_addr != 0
		&& m_memory->read_t<bool>(entry.m_controller_addr + dl_off::m_bIsLocalPlayerController);

	m_player_data["m_idx"] = entry.m_idx;
	m_player_data["m_name"] = hero_display_name(hero_slug);
	m_player_data["m_team"] = entry.m_stats.m_team;
	m_player_data["m_health"] = health;
	m_player_data["m_health_max"] = entry.m_stats.m_health_max;
	m_player_data["m_is_dead"] = is_dead;
	m_player_data["m_hero_id"] = entry.m_stats.m_hero_id;
	m_player_data["m_hero_slug"] = hero_slug;
	m_player_data["m_is_local"] = is_local;
	m_player_data["m_has_pawn"] = entry.m_pawn_addr != 0 && !is_dead;
	m_player_data["m_position"]["x"] = position.m_x;
	m_player_data["m_position"]["y"] = position.m_y;
	m_player_data["m_position"]["z"] = position.m_z;
	m_player_data["m_eye_angle"] = eye_angles.m_y;

	return true;
}
