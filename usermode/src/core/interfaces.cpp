#include "pch.hpp"

bool i::setup()
{
	const auto [client_base, client_size] = m_memory->get_module_info(CLIENT_DLL);
	if (!client_base.has_value() || !client_size.has_value())
	{
		LOG_ERROR("failed to get '%s' module info - is deadlock.exe running?", CLIENT_DLL);
		return false;
	}

	if (const auto schema_pattern = m_memory->find_pattern(SCHEMASYSTEM_DLL, GET_SCHEMA_SYSTEM); schema_pattern.has_value())
		m_schema_system = schema_pattern->rip().as<c_schema_system*>();
	else
		LOG_WARNING("schema system pattern not found (hardcoded offsets will be used)");

	const auto entity_list_pattern = m_memory->find_pattern(CLIENT_DLL, GET_ENTITY_LIST);
	if (entity_list_pattern.has_value())
	{
		const auto entity_system_global = entity_list_pattern->rip().as<uintptr_t>();
		m_game_entity_system = m_memory->read_t<c_game_entity_system*>(entity_system_global);
		i::m_entity_system_source = "pattern";
	}
	else
	{
		LOG_WARNING("entity list pattern failed, using RVA fallback");
		m_game_entity_system = m_memory->read_t<c_game_entity_system*>(client_base.value() + dl_off::rva_game_entity_system);
		i::m_entity_system_source = "rva";
	}

	m_game_rules = m_memory->read_t<c_citadel_game_rules*>(client_base.value() + dl_off::rva_game_rules);

	// Entity system is required; game rules are optional (bounds fall back if missing).
	const bool success = m_game_entity_system != nullptr;

	if (m_game_entity_system)
		LOG_INFO("game entity system: %p", static_cast<void*>(m_game_entity_system));
	else
		LOG_ERROR("failed to resolve game entity system");

	if (m_game_rules)
		LOG_INFO("game rules: %p", static_cast<void*>(m_game_rules));
	else
		LOG_WARNING("game rules not resolved - using fallback minimap bounds");

	return success;
}
