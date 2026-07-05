#pragma once

class c_memory
{
public:
	~c_memory()
	{
		if (this->m_handle != nullptr)
			CloseHandle(this->m_handle);
	}

	bool setup();
	bool is_target_running() const;
	std::optional<uint32_t> get_process_id(const std::string_view& process_name);
	std::optional<c_address> find_pattern(const std::string_view& module_name, const std::string_view& pattern);
	std::pair<std::optional<uintptr_t>, std::optional<uintptr_t>> get_module_info(const std::string_view& module_name);

	bool read_t(const uintptr_t address, void* buffer, uintptr_t size)
	{
		this->read_memory(reinterpret_cast<void*>(address), buffer, size);
		return true;
	}

	template <typename t>
	t read_t(void* address)
	{
		t value{ 0 };
		this->read_memory(address, &value, sizeof(t));
		return value;
	}

	template <typename T>
	T read_t(const uintptr_t address) noexcept
	{
		T buffer{};
		this->read_memory(reinterpret_cast<void*>(address), &buffer, sizeof(T));
		return buffer;
	}

	template <>
	std::string read_t<std::string>(const uintptr_t address)
	{
		static const int length = 128;
		std::vector<char> buffer(length, '\0');

		if (!this->read_memory(reinterpret_cast<void*>(address), buffer.data(), length - 1))
			return {};

		const auto& it = find(buffer.begin(), buffer.end(), '\0');

		if (it != buffer.end())
			buffer.resize(distance(buffer.begin(), it));

		return std::string(buffer.begin(), buffer.end());
	}

	std::string read_remote_string(const uintptr_t address, const size_t max_length = 64)
	{
		if (address < 0x10000 || address >= 0x7FFFFFFFFFFF)
			return {};

		std::vector<char> buffer(max_length + 1, '\0');
		if (!this->read_memory(reinterpret_cast<void*>(address), buffer.data(), max_length))
			return {};

		for (const auto ch : buffer)
		{
			if (ch == '\0')
				break;

			if (static_cast<unsigned char>(ch) < 0x20 || static_cast<unsigned char>(ch) > 0x7E)
				return {};
		}

		return std::string(buffer.data());
	}

private:
	void* m_handle = nullptr;
	uint32_t m_id = 0;

	bool read_memory(void* address, void* buffer, const size_t size)
	{
		return ReadProcessMemory(this->m_handle, reinterpret_cast<void*>(address), buffer, size, nullptr);
	}
};

inline const std::unique_ptr<c_memory> m_memory{ new c_memory() };