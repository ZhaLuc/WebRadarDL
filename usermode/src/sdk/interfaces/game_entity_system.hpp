#pragma once

class c_game_entity_system
{
public:
	template <typename T = c_base_entity*>
	T get(int32_t idx)
	{
		const auto slot_addr = get_entity_slot_addr(idx);
		if (!slot_addr)
			return nullptr;

		return m_memory->read_t<T>(slot_addr);
	}

	template <typename T = c_base_entity*>
	T get(const c_base_handle handle)
	{
		if (!handle.is_valid())
			return nullptr;

		return get<T>(handle.get_entry_idx());
	}

private:
	uintptr_t get_entity_slot_addr(const int32_t idx) const
	{
		if (static_cast<uint32_t>(idx) >= 0x7ffe)
			return 0;

		if (static_cast<uint32_t>(idx >> 9) >= 0x3f)
			return 0;

		const auto system = reinterpret_cast<uintptr_t>(this);
		const auto entry_list = m_memory->read_t<uintptr_t>(system + 8i64 * (idx >> 9) + 16);
		if (!entry_list)
			return 0;

		return 112i64 * (idx & 0x1ff) + entry_list;
	}
};
