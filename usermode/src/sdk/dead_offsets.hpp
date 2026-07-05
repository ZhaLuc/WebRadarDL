#pragma once

// Deadlock offsets from dezlock dump (2026-07-05)

namespace dl_off
{
	// CEntityInstance
	inline constexpr uint32_t m_pEntity = 0x10;

	// CEntityIdentity
	inline constexpr uint32_t m_identityHandle = 0x10;
	inline constexpr uint32_t m_designerName = 0x20;

	// C_BaseEntity
	inline constexpr uint32_t m_pGameSceneNode = 0x330;
	inline constexpr uint32_t m_iHealth = 0x354;
	inline constexpr uint32_t m_iTeamNum = 0x3F3;

	// CGameSceneNode
	inline constexpr uint32_t m_vecAbsOrigin = 0xC8;
	inline constexpr uint32_t m_bDormant = 0x103;

	// CBasePlayerController
	inline constexpr uint32_t m_iszPlayerName = 0x6F0;
	inline constexpr uint32_t m_steamID = 0x778;
	inline constexpr uint32_t m_bIsLocalPlayerController = 0x780;

	// CCitadelPlayerController
	inline constexpr uint32_t m_hHeroPawn = 0x8AC;
	inline constexpr uint32_t m_PlayerDataGlobal = 0x8F0;

	// PlayerDataGlobal_t (relative)
	inline constexpr uint32_t pdg_m_iHealthMax = 0x10;
	inline constexpr uint32_t pdg_m_nHeroID = 0x1C;
	inline constexpr uint32_t pdg_m_iHealth = 0x4C;
	inline constexpr uint32_t pdg_m_bAlive = 0x68;

	// C_CitadelPlayerPawn
	inline constexpr uint32_t m_angEyeAngles = 0x11B8;

	// C_Team / C_CitadelTeam
	inline constexpr uint32_t m_aPlayerControllers = 0x5F0;
	inline constexpr uint32_t m_aPlayers = 0x608;

	// C_CitadelGameRules
	inline constexpr uint32_t m_vMinimapMins = 0x84;
	inline constexpr uint32_t m_vMinimapMaxs = 0x90;
	inline constexpr uintptr_t rva_game_entity_system = 0x30820D0;
	inline constexpr uintptr_t rva_local_controller = 0x2DCA358;
	inline constexpr uintptr_t rva_game_rules = 0x3792FD0;
}
