#pragma once

class c_schema_system;
class c_game_entity_system;
class c_citadel_game_rules;

namespace i
{
	bool setup();

	inline c_schema_system* m_schema_system = nullptr;
	inline c_game_entity_system* m_game_entity_system = nullptr;
	inline c_citadel_game_rules* m_game_rules = nullptr;
	inline const char* m_entity_system_source = "unknown";
}
