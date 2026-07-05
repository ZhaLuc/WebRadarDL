# WebRadarDL - Screenshot & Media Guide

Place every file listed below directly in this `Media/` folder using the **exact filename** shown. Use **PNG** format, **1920x1080** or higher where possible, and the **Windows Snipping Tool** or **Win+Shift+S** (save as PNG).

The main README embeds these files for GitHub rendering.

---

## Required images

| Filename | What to capture | How to get it |
|----------|-----------------|---------------|
| `01-hero-banner.png` | Full radar during a live Deadlock match - map, player dots, side cards visible | Run WebRadarDL, join a match, maximize the browser window, capture the entire radar view |
| `02-launcher-init.png` | WebRadarDL console during startup (steps 1–4 visible) | Start `WebRadarDL.exe`, screenshot the console while npm/host steps are running |
| `03-launcher-ready.png` | Console showing **Ready: http://localhost:5173** | Screenshot after all 6 init steps complete |
| `04-uac-prompt.png` | Windows UAC dialog for `radar_reader.exe` | Screenshot when the elevation prompt appears (crop to the dialog) |
| `05-radar-live-match.png` | Close-up of the minimap with multiple heroes moving | Same session as #1; focus on the circular map area |
| `06-player-cards.png` | Left and right player card columns with HP bars | Wide screenshot or crop showing teammate/enemy cards |
| `07-settings-share.png` | **Settings → Share** tab with link field visible | Open Settings, Share tab; blur the public URL if you prefer |
| `08-settings-calibration.png` | **Calibration mode** with pulsing **YOU** dot on the map | Enable Calibrate Map, stand on a lane marker, capture overlay |
| `09-settings-debug.png` | **Settings → Debug** tab with reader stats | Open Debug tab while in a live match |
| `10-end-program.png` | **End Program** button at bottom of Share tab | Scroll if needed; capture the red shutdown button |
| `11-browser-app-mode.png` | Browser opened in app mode (minimal chrome) | Show the Edge/Chrome window WebRadarDL launches |
| `12-exe-in-explorer.png` | Project folder in File Explorer showing `WebRadarDL.exe` icon | Open repo root in Explorer, medium icon view |
| `13-share-remote-viewer.png` | Viewer experience (phone or second PC) | Open the share link on another device; photo or screenshot of viewer UI |
| `14-stop-bat.png` | Running `STOP.bat` or console after shutdown | Double-click STOP.bat or show "All radar processes stopped" |

---

## Optional images

| Filename | What to capture | How to get it |
|----------|-----------------|---------------|
| `15-visual-studio-build.png` | Visual Studio building **Release \| x64** | Open `DL_WebRadar.sln`, start build, screenshot Output window |
| `16-deadlock-not-running.png` | UI status **waiting for match** | Launch WebRadarDL without Deadlock running |

---

## Naming rules

- All lowercase filenames exactly as listed (e.g. `01-hero-banner.png`).
- PNG only (`.png` extension).
- No spaces in filenames.
- Do not rename after adding - documentation links depend on these names.
