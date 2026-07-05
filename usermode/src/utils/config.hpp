#pragma once

struct config_data_t
{
	std::string m_ip;
	int m_port = 5173;

	NLOHMANN_DEFINE_TYPE_INTRUSIVE(config_data_t, m_ip, m_port)
};

namespace cfg
{
	bool setup(config_data_t& config_data);
}