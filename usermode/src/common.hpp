#pragma once

/* game modules */
#define CLIENT_DLL "client.dll"
#define ENGINE2_DLL "engine2.dll"
#define SCHEMASYSTEM_DLL "schemasystem.dll"
#define TARGET_PROCESS "deadlock.exe"

/* game signatures (Deadlock / Source 2) */
#define GET_SCHEMA_SYSTEM "48 89 05 ? ? ? ? 4c 8d 0d ? ? ? ? 33 c0"
#define GET_ENTITY_LIST "48 8b 0d ? ? ? ? 8b d0 e8 ? ? ? ? 44 8b 83 c0 00 00 00"

/* RVA fallbacks from dezlock dump (2026-07-05) - use dl_off:: namespace in dead_offsets.hpp */

/* custom defines */
#define LOG_INFO(str, ...) \
    printf(" [info] " str "\n", __VA_ARGS__)

#define LOG_WARNING(str, ...) \
    printf(" [warning] " str "\n", __VA_ARGS__)

#define LOG_ERROR(str, ...) \
    printf(" [error] " str "\n", __VA_ARGS__)

#define INIT_STEP(name, expr) \
    if (!(expr)) \
    { \
        std::this_thread::sleep_for(std::chrono::seconds(5)); \
        return {}; \
    } \
    LOG_INFO(name " initialization completed")
