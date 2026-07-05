#pragma once

#include "sdk/dead_offsets.hpp"

bool is_likely_citadel_player_controller(uintptr_t entity_addr);
bool is_valid_citadel_player_controller(uintptr_t entity_addr);

enum class e_team : uint8_t
{
	none = 0,
	spec = 1,
	amber = 2,
	sapphire = 3
};

class c_entity_identity
{
public:
	int32_t get_entry_idx() const
	{
		const auto handle = m_memory->read_t<uint32_t>(reinterpret_cast<uintptr_t>(this) + dl_off::m_identityHandle);
		return static_cast<int32_t>(handle & ENT_ENTRY_MASK);
	}

	int32_t get_serial_number() const
	{
		const auto handle = m_memory->read_t<uint32_t>(reinterpret_cast<uintptr_t>(this) + dl_off::m_identityHandle);
		return static_cast<int32_t>(handle >> NUM_SERIAL_NUM_SHIFT_BITS);
	}

	std::string get_designer_name() const
	{
		const auto string_ptr = m_memory->read_t<uintptr_t>(reinterpret_cast<uintptr_t>(this) + dl_off::m_designerName);
		return m_memory->read_remote_string(string_ptr);
	}
};

class c_entity_instance
{
public:
	c_entity_identity* get_identity() const
	{
		return m_memory->read_t<c_entity_identity*>(reinterpret_cast<uintptr_t>(this) + dl_off::m_pEntity);
	}

	const c_base_handle get_ref_e_handle() const;
	std::string get_designer_name() const;
};

class c_game_scene_node
{
public:
	f_vector get_abs_origin() const
	{
		return m_memory->read_t<f_vector>(reinterpret_cast<uintptr_t>(this) + dl_off::m_vecAbsOrigin);
	}

	bool is_dormant() const
	{
		return m_memory->read_t<bool>(reinterpret_cast<uintptr_t>(this) + dl_off::m_bDormant);
	}
};

class c_base_entity : public c_entity_instance
{
public:
	c_game_scene_node* get_scene_node() const
	{
		return m_memory->read_t<c_game_scene_node*>(reinterpret_cast<uintptr_t>(this) + dl_off::m_pGameSceneNode);
	}

	e_team get_team() const
	{
		return m_memory->read_t<e_team>(reinterpret_cast<uintptr_t>(this) + dl_off::m_iTeamNum);
	}

	f_vector get_scene_origin() const;
};

class c_citadel_player_pawn : public c_base_entity
{
public:
	f_vector get_eye_angles() const
	{
		return m_memory->read_t<f_vector>(reinterpret_cast<uintptr_t>(this) + dl_off::m_angEyeAngles);
	}
};

class c_base_player_controller : public c_base_entity
{
public:
	std::string get_player_name() const
	{
		return m_memory->read_remote_string(reinterpret_cast<uintptr_t>(this) + dl_off::m_iszPlayerName);
	}

	uint64_t get_steam_id() const
	{
		return m_memory->read_t<uint64_t>(reinterpret_cast<uintptr_t>(this) + dl_off::m_steamID);
	}

	bool is_local_controller() const
	{
		return m_memory->read_t<bool>(reinterpret_cast<uintptr_t>(this) + dl_off::m_bIsLocalPlayerController);
	}
};

class c_player_data_global
{
public:
	explicit c_player_data_global(uintptr_t base) : m_base(base) {}

	int32_t health() const { return m_memory->read_t<int32_t>(m_base + dl_off::pdg_m_iHealth); }
	int32_t health_max() const { return m_memory->read_t<int32_t>(m_base + dl_off::pdg_m_iHealthMax); }
	int32_t hero_id() const { return m_memory->read_t<int32_t>(m_base + dl_off::pdg_m_nHeroID); }
	bool is_alive() const { return m_memory->read_t<bool>(m_base + dl_off::pdg_m_bAlive); }

private:
	uintptr_t m_base = 0;
};

class c_citadel_player_controller : public c_base_player_controller
{
public:
	c_base_handle get_hero_pawn_handle() const
	{
		return m_memory->read_t<c_base_handle>(reinterpret_cast<uintptr_t>(this) + dl_off::m_hHeroPawn);
	}

	c_player_data_global get_player_data_global() const
	{
		return c_player_data_global(reinterpret_cast<uintptr_t>(this) + dl_off::m_PlayerDataGlobal);
	}

	c_citadel_player_pawn* get_hero_pawn() const;

	static c_citadel_player_controller* find_local_controller();
};

class c_citadel_game_rules
{
public:
	f_vector get_minimap_mins() const
	{
		return m_memory->read_t<f_vector>(reinterpret_cast<uintptr_t>(this) + dl_off::m_vMinimapMins);
	}

	f_vector get_minimap_maxs() const
	{
		return m_memory->read_t<f_vector>(reinterpret_cast<uintptr_t>(this) + dl_off::m_vMinimapMaxs);
	}
};
