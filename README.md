# WebRadarDL

Live position radar for Deadlock. Reads game memory externally and streams player positions to a browser UI.

## Architecture

```
WebRadarDL.exe (console supervisor)
  ├─ hidden: node host.js (web UI + WebSocket relay on :5173)
  ├─ visible: radar_reader.exe (admin memory reader)
  ├─ hidden: cloudflared (optional public share link)
  └─ browser app window → http://localhost:5173
```

## Requirements

- Windows 10/11
- [Node.js 18+](https://nodejs.org/) (for the web server on first run)
- Deadlock running (`deadlock.exe`)
- Administrator rights (UAC prompt for the memory reader)

To rebuild C++ from source: Visual Studio 2022 with the **Desktop development with C++** workload (x64).

## Quick start (use prebuilt binaries)

1. Clone this repository.
2. Double-click **`WebRadarDL.exe`** or **`START.bat`**.

On first run the console will:

1. Install npm dependencies (`webapp/`)
2. Skip the web UI build if `webapp/dist/` is already present
3. Start the web server + relay
4. Start the public share tunnel (optional)
5. Start `radar_reader.exe` (approve UAC)
6. Open the browser

3. Launch Deadlock and join a match (not spectator-only).

4. Stop with **Settings → Share → End Program**, close the WebRadarDL console, or run **`STOP.bat`**.

## Sharing

Open **Settings → Share** for copyable LAN and internet links. Viewers only need a browser.

## Rebuilding from source

### C++ (launcher + memory reader)

1. Open `usermode/DL_WebRadar.sln` in Visual Studio 2022.
2. Select **Release | x64**.
3. Build the solution (vcpkg restores `nlohmann-json` and `ixwebsocket` automatically).

Outputs:

- `WebRadarDL.exe` (project root)
- `usermode/release/radar_reader.exe`

### Web UI (optional)

```powershell
cd webapp
npm install
npm run build
```

The prebuilt `webapp/dist/` in the repo lets you skip this unless you changed the UI.

### Memory reader config

`usermode/release/config.json`:

```json
{
  "m_ip": "127.0.0.1",
  "m_port": 5173
}
```

## Map calibration

Tune alignment in **Settings → Calibrate Map**, or edit `webapp/public/data/deadlock/data.json`.

## Hero icons

Hero portraits are in `webapp/public/heroes/`, mapped by slug in `hero_map.json`.
