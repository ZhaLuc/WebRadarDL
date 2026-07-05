#include "pch.hpp"

namespace
{
	std::filesystem::path get_exe_directory()
	{
		wchar_t buffer[MAX_PATH]{};
		const DWORD length = GetModuleFileNameW(nullptr, buffer, MAX_PATH);
		if (!length || length >= MAX_PATH)
			return {};

		return std::filesystem::path(buffer).parent_path();
	}

	std::ifstream open_config_file()
	{
		const std::vector<std::filesystem::path> candidates = {
			get_exe_directory() / "config.json",
			std::filesystem::current_path() / "config.json",
		};

		for (const auto& path : candidates)
		{
			std::ifstream file(path);
			if (file.is_open())
				return file;
		}

		return {};
	}

	void write_example_config(const std::filesystem::path& path)
	{
		std::ofstream example_config(path);
		example_config << std::format("{}", R"({
    "m_ip": "127.0.0.1",
    "m_port": 5173
})");
	}
}

bool cfg::setup(config_data_t& config_data)
{
	auto file = open_config_file();
	if (!file.is_open())
	{
		const auto example_path = get_exe_directory() / "config.json";
		LOG_WARNING("cannot open file 'config.json'");

		if (!example_path.empty())
			write_example_config(example_path);

		return {};
	}

	const auto parsed_data = nlohmann::json::parse(file);
	if (parsed_data.empty())
	{
		LOG_ERROR("failed to parse 'config.json'");
		return {};
	}

	try
	{
		config_data.m_ip = parsed_data.value("m_ip", std::string{"127.0.0.1"});
		config_data.m_port = parsed_data.value("m_port", 5173);

		if (config_data.m_ip.empty() || config_data.m_ip == "localhost")
			config_data.m_ip = "127.0.0.1";
		if (config_data.m_port <= 0)
			config_data.m_port = 5173;
	}
	catch (const std::exception& e)
	{
		LOG_ERROR("failed to deserialize 'config_data_t' (%s)", e.what());
		return {};
	}

	return true;
}
