#pragma once

#include <unordered_map>
#include <string>
#include <cstdint>

inline const char* hero_slug_from_id(uint32_t hero_id)
{
	static const std::unordered_map<uint32_t, const char*> hero_map = {
		{1, "inferno"}, {2, "gigawatt"}, {3, "hornet"}, {4, "spectre"}, {6, "bull"},
		{7, "wraith"}, {8, "engineer"}, {10, "chrono"}, {11, "sumo"}, {12, "kelvin"},
		{13, "haze"}, {14, "astro"}, {15, "bebop"}, {16, "nano"}, {17, "archer"},
		{18, "digger"}, {19, "shiv"}, {20, "tengu"}, {21, "kali"}, {25, "warden"},
		{27, "yamato"}, {31, "lash"}, {35, "viscous"}, {50, "synth"}, {52, "mirage"},
		{60, "magician"}, {63, "vampirebat"}, {64, "drifter"}, {65, "priest"},
		{66, "frank"}, {67, "bookworm"}, {69, "doorman"}, {71, "punkgoat"},
		{76, "necro"}, {77, "fencer"}, {79, "familiar"}, {80, "werewolf"}, {81, "unicorn"},
	};

	const auto it = hero_map.find(hero_id);
	return it != hero_map.end() ? it->second : "unknown";
}

inline bool hero_id_is_known(const uint32_t hero_id)
{
	return strcmp(hero_slug_from_id(hero_id), "unknown") != 0;
}
