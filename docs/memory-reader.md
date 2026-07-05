# Memory reader (`radar_reader.exe`)

Source: `usermode/src/`  
Output: `usermode/release/radar_reader.exe`  
Target process: **`deadlock.exe`** (must be running in an active match for live data)

The memory reader is an external console application that uses `ReadProcessMemory` to read Source 2 game structures and stream normalized JSON to the web host over WebSocket.

---

## Lifecycle

```mermaid
stateDiagram-v2
  [*] --> LoadConfig
  LoadConfig --> ConnectWS: config ok
  LoadConfig --> [*]: config fail
  ConnectWS --> WaitGame: WS connected
  WaitGame --> WaitGame: send waiting_game payload
  WaitGame --> LiveLoop: i::setup() ok
  LiveLoop --> WaitGame: deadlock.exe exited
  LiveLoop --> LiveLoop: read + send 20Hz
```

---

## Configuration

Loaded from `config.json` next to the executable (`usermode/release/`):

```json
{
  "m_ip": "127.0.0.1",
  "m_port": 5173
}
```

Implementation: `utils/config.cpp` — falls back to defaults if keys missing.

WebSocket URL format:

```text
ws://{m_ip}:{m_port}/deadlock_webradar
```

---

## Game initialization (`try_initialize_game`)

1. `m_memory->setup()` — `OpenProcess` on `deadlock.exe`
2. `i::setup()` — resolve entity system (pattern or RVA), game rules
3. `schema::setup()` — optional runtime schema table (warning only if fails)

Retries every **2 seconds** until success.

While waiting, sends JSON with `m_debug.reader_state: "waiting_game"`.

---

## Main loop (20 Hz)

```cpp
sdk::update();  // refresh local controller pointer

if ((tick_counter % 4) == 0)
    f::run();       // FULL scan
else
    f::run_fast();  // FAST cached refresh

web_socket.send(f::m_data.dump());
sleep(50ms);
```

| Mode | Function | Cost | Purpose |
|------|----------|------|---------|
| **full** | `f::run()` → `get_player_info()` | High — iterates 2048 entity indices | Discover controllers, refresh cache |
| **fast** | `f::run_fast()` → `get_player_info_fast()` | Low — ~12 players | Update positions/HP from cache |

---

## Player discovery (full scan)

`features/features.cpp`:

1. Add local controller from SDK + global RVA `rva_local_controller`
2. Loop entity indices `0..2047` on `c_game_entity_system`
3. Match designer name `citadel_player_controller`
4. Read team handle vectors `m_aPlayerControllers` / `m_aPlayers`
5. Validate via `read_controller_stats()` (hero ID, HP range, alive flag)
6. Export unique controllers through `players::get_data()`

---

## Per-player export (`players.cpp`)

Each player JSON includes:

| Field | Source |
|-------|--------|
| `m_idx` | Entity index |
| `m_name` | Hero display name from slug |
| `m_team` | Controller team byte |
| `m_health` / `m_health_max` | Pawn or PlayerDataGlobal |
| `m_hero_id` / `m_hero_slug` | PlayerDataGlobal hero ID |
| `m_position` x/y/z | Pawn scene origin |
| `m_eye_angle` | Pawn eye yaw (not shown in UI) |
| `m_is_local` | `m_bIsLocalPlayerController` |
| `m_is_dead` | HP ≤ 0 |
| `m_has_pawn` | Pawn pointer valid |

---

## Memory layer (`utils/memory.cpp`)

| API | Behavior |
|-----|----------|
| `get_process_id("deadlock.exe")` | Toolhelp snapshot |
| `OpenProcess(PROCESS_VM_READ \| PROCESS_QUERY_INFORMATION)` | Reader handle |
| `find_pattern(module, sig)` | Byte scan in module image |
| `read_t<T>(address)` | Typed `ReadProcessMemory` |

### Pattern signatures (`common.hpp`)

| Macro | Module | Purpose |
|-------|--------|---------|
| `GET_SCHEMA_SYSTEM` | `schemasystem.dll` | Locate schema interface |
| `GET_ENTITY_LIST` | `client.dll` | Locate entity system global |

If entity list pattern fails → fallback RVA `dl_off::rva_game_entity_system`.

---

## Diagnostics

| Output | Location |
|--------|----------|
| Console | `printf` / `LOG_*` macros |
| File | `usermode_diag.log` (append) |

---

## Dependencies (vcpkg)

| Package | Use |
|---------|-----|
| `nlohmann-json` | Payload serialization |
| `ixwebsocket` | WebSocket client with auto-reconnect |

---

## Related documents

- [SDK & offsets](./sdk-and-offsets.md)
- [Data protocol](./data-protocol.md)
- [Troubleshooting](./troubleshooting.md)
