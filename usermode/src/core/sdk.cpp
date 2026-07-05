#include "pch.hpp"

void sdk::update()
{
	sdk::m_local_controller = c_citadel_player_controller::find_local_controller();
}
