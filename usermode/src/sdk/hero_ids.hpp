#pragma once

#include <unordered_map>
#include <string>
#include <cstdint>

// Playable hero IDs (44 total). Keep in sync with webapp/src/data/hero-id-map.json
// and webapp/public/heroes/hero_map.json (slug -> display name / portrait).
inline const char* hero_slug_from_id(uint32_t hero_id)
{
	static const std::unordered_map<uint32_t, const char*> hero_map = {
		{1, "inferno"},      // Infernus
		{2, "gigawatt"},     // Seven
		{3, "hornet"},       // Vindicta
		{4, "spectre"},      // Lady Geist
		{6, "bull"},         // Abrams
		{7, "wraith"},       // Wraith
		{8, "engineer"},     // McGinnis
		{10, "chrono"},      // Paradox
		{11, "sumo"},        // Dynamo
		{12, "kelvin"},      // Kelvin
		{13, "haze"},        // Haze
		{14, "astro"},       // Holliday
		{15, "bebop"},       // Bebop
		{16, "nano"},        // Calico
		{17, "archer"},      // Grey Talon
		{18, "digger"},      // Mo & Krill
		{19, "shiv"},        // Shiv
		{20, "tengu"},       // Ivy
		{25, "warden"},      // Warden
		{27, "yamato"},      // Yamato
		{31, "lash"},        // Lash
		{35, "viscous"},     // Viscous
		{50, "synth"},       // Pocket
		{52, "mirage"},      // Mirage
		{58, "kali"},        // Vyper (internal codename kali)
		{60, "magician"},    // Sinclair
		{63, "vampirebat"},  // Mina
		{64, "drifter"},     // Drifter
		{65, "priest"},      // Venator
		{66, "frank"},       // Victor
		{67, "bookworm"},    // Paige
		{69, "doorman"},     // The Doorman
		{72, "punkgoat"},    // Billy
		{76, "necro"},       // Graves
		{77, "fencer"},      // Apollo
		{78, "deadpack"},    // Deadman Danny
		{79, "familiar"},    // Rem
		{80, "werewolf"},    // Silver
		{81, "unicorn"},     // Celeste
		{84, "ratking"},     // Rat King
		{85, "chessmaster"}, // Solomon
		{86, "artist"},      // Violet
		{87, "nurse"},       // Nurse Harrow
		{88, "baba"},        // Baba
	};

	const auto it = hero_map.find(hero_id);
	return it != hero_map.end() ? it->second : "unknown";
}

inline bool hero_id_is_known(const uint32_t hero_id)
{
	return strcmp(hero_slug_from_id(hero_id), "unknown") != 0;
}
