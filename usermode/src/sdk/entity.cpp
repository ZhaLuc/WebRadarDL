#include "pch.hpp"
#include "sdk/player_stats.hpp"

std::string read_entity_designer_name(const uintptr_t entity_addr)
{
	if (entity_addr < 0x10000)
		return {};

	const auto identity_addr = m_memory->read_t<uintptr_t>(entity_addr + dl_off::m_pEntity);
	if (identity_addr < 0x10000)
		return {};

	const auto string_ptr = m_memory->read_t<uintptr_t>(identity_addr + dl_off::m_designerName);
	const auto designer = m_memory->read_remote_string(string_ptr);
	return is_valid_entity_designer_name(designer) ? designer : std::string{};
}

std::string c_entity_instance::get_designer_name() const
{
	return read_entity_designer_name(reinterpret_cast<uintptr_t>(this));
}

bool is_valid_citadel_player_controller(const uintptr_t entity_addr)
{
	return read_controller_stats(entity_addr).m_valid;
}

bool is_likely_citadel_player_controller(const uintptr_t entity_addr)
{
	return is_valid_citadel_player_controller(entity_addr);
}

const c_base_handle c_entity_instance::get_ref_e_handle() const
{
	const auto entity_addr = reinterpret_cast<uintptr_t>(this);
	if (entity_addr < 0x10000)
		return c_base_handle();

	const auto identity_addr = m_memory->read_t<uintptr_t>(entity_addr + dl_off::m_pEntity);
	if (identity_addr < 0x10000)
		return c_base_handle();

	const auto handle = m_memory->read_t<uint32_t>(identity_addr + dl_off::m_identityHandle);
	return c_base_handle(static_cast<int32_t>(handle & ENT_ENTRY_MASK), static_cast<int32_t>(handle >> NUM_SERIAL_NUM_SHIFT_BITS));
}

f_vector c_base_entity::get_scene_origin() const
{
	const auto scene_node = get_scene_node();
	if (!scene_node)
		return {};

	return scene_node->get_abs_origin();
}

c_citadel_player_pawn* c_citadel_player_controller::get_hero_pawn() const
{
	const auto handle = get_hero_pawn_handle();
	if (!handle.is_valid())
		return nullptr;

	return i::m_game_entity_system->get<c_citadel_player_pawn*>(handle);
}

c_citadel_player_controller* c_citadel_player_controller::find_local_controller()
{
	const auto [client_base, client_size] = m_memory->get_module_info(CLIENT_DLL);
	if (client_base.has_value())
	{
	const auto local_addr = m_memory->read_t<uintptr_t>(client_base.value() + dl_off::rva_local_controller);
	if (local_addr >= 0x10000 && local_addr < 0x7FFFFFFFFFFF)
	{
		if (m_memory->read_t<bool>(local_addr + dl_off::m_bIsLocalPlayerController))
			return reinterpret_cast<c_citadel_player_controller*>(local_addr);

		if (read_controller_stats(local_addr).m_valid)
			return reinterpret_cast<c_citadel_player_controller*>(local_addr);
	}
	}

	for (int32_t idx = 0; idx < 2048; idx++)
	{
		const auto controller = i::m_game_entity_system->get<c_citadel_player_controller*>(idx);
		if (!controller)
			continue;

		if (!read_controller_stats(reinterpret_cast<uintptr_t>(controller)).m_valid)
			continue;

		if (controller->is_local_controller())
			return controller;
	}

	return nullptr;
}
