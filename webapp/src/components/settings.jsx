import { useEffect, useRef, useState } from "react";
import {
  calibrationToDataJson,
  DEFAULT_CALIBRATION,
  getPlayerName,
  resolveHeroSlug,
  nudgeCalibration,
} from "../utilities/utilities";

const Slider = ({ label, value, min, max, step, onChange, display, hint }) => (
  <div>
    <div className="flex justify-between items-center mb-1 gap-2">
      <span className="text-radar-secondary text-xs">{label}</span>
      <span className="text-radar-primary text-xs font-mono shrink-0">
        {display ?? value}
      </span>
    </div>
    {hint && (
      <p className="text-[10px] text-radar-secondary/80 leading-snug mb-1.5">{hint}</p>
    )}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-radar-primary"
    />
  </div>
);

const SliderWithInput = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => v,
  parseValue = (v) => v,
}) => {
  const [draft, setDraft] = useState(null);

  const commitDraft = () => {
    if (draft === null || draft === "") {
      setDraft(null);
      return;
    }

    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(parseValue(clamped));
    }

    setDraft(null);
  };

  return (
    <div className="rounded-lg bg-black/20 p-2.5 space-y-2">
      <div>
        <div className="text-radar-primary text-xs font-medium">{label}</div>
        {hint && (
          <p className="text-[10px] text-radar-secondary/85 leading-snug mt-0.5">{hint}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseValue(parseFloat(e.target.value)))}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? formatValue(value)}
          onFocus={() => setDraft(String(formatValue(value)))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-[4.5rem] bg-black/40 border border-radar-secondary/30 rounded px-1.5 py-1 text-radar-primary text-xs font-mono text-right"
        />
      </div>
    </div>
  );
};

const NudgePad = ({ onNudge, stepLabel }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-3 gap-1.5 w-36 mx-auto">
      <div />
      <button
        type="button"
        onClick={() => onNudge("offsetY", 1)}
        className="text-sm py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 font-bold"
        title="Move dots up"
      >
        ▲
      </button>
      <div />
      <button
        type="button"
        onClick={() => onNudge("offsetX", -1)}
        className="text-sm py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 font-bold"
        title="Move dots left"
      >
        ◀
      </button>
      <div className="flex items-center justify-center text-[10px] text-radar-secondary text-center leading-tight">
        move
        <br />
        dots
      </div>
      <button
        type="button"
        onClick={() => onNudge("offsetX", 1)}
        className="text-sm py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 font-bold"
        title="Move dots right"
      >
        ▶
      </button>
      <div />
      <button
        type="button"
        onClick={() => onNudge("offsetY", -1)}
        className="text-sm py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 font-bold"
        title="Move dots down"
      >
        ▼
      </button>
      <div />
    </div>
    {stepLabel && (
      <div className="text-center text-[10px] text-amber-300/90">{stepLabel}</div>
    )}
  </div>
);

const SettingsButton = ({
  settings,
  onSettingsChange,
  calibration,
  onCalibrationChange,
  bounds,
  localPlayer,
  connectionStatus,
  calibrationMode,
  onCalibrationModeChange,
  debugData,
  playerCount,
  heroMap,
  isHost = true,
  shareInfo,
  onReloadMap,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState(isHost ? "share" : "display");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [fineStep, setFineStep] = useState(false);
  const [reloadFlash, setReloadFlash] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const updateCalibration = (patch) => {
    onCalibrationChange({ ...calibration, ...patch });
  };

  const nudge = (axis, direction) => {
    if (direction === 0) return;
    const step = fineStep ? 0.001 : 0.01;
    onCalibrationChange(nudgeCalibration(calibration, axis, direction * step));
  };

  const copyCalibration = async () => {
    await navigator.clipboard.writeText(calibrationToDataJson(calibration));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrls = [...(shareInfo?.viewerUrls ?? [])].filter(
    (url, index, list) => url && list.indexOf(url) === index
  );

  const publicUrl = shareInfo?.publicUrl || null;
  const tunnelStatus = shareInfo?.tunnelStatus || "idle";
  const tunnelError = shareInfo?.tunnelError || null;
  const primaryShareUrl = publicUrl || shareUrls[0] || window.location.origin;

  const copyShareUrl = async (url) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(""), 2000);
  };

  const applyLiveBounds = () => {
    if (!bounds?.mins || !bounds?.maxs) return;
    updateCalibration({
      minX: bounds.mins.x,
      minY: bounds.mins.y,
      maxX: bounds.maxs.x,
      maxY: bounds.maxs.y,
    });
  };

  const handleReloadMap = () => {
    onReloadMap?.();
    setReloadFlash(true);
    setTimeout(() => setReloadFlash(false), 2000);
  };

  const patchSettings = (patch) => onSettingsChange({ ...settings, ...patch });

  return (
    <div ref={rootRef} className="relative z-50 flex flex-col items-end gap-2">
      <div className="flex flex-col items-end gap-2">
        {isHost && (
          <button
            type="button"
            onClick={handleReloadMap}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              reloadFlash
                ? "bg-emerald-500/90 text-black"
                : "bg-radar-panel/80 text-radar-primary border border-radar-secondary/30"
            }`}
          >
            {reloadFlash ? "Map Reloading..." : "Reload Map"}
          </button>
        )}

        {isHost && (
          <button
            type="button"
            onClick={() => {
              setTab("share");
              setIsOpen(true);
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all bg-radar-primary text-[#1E3A54] hover:brightness-110"
          >
            Share
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-1 transition-all rounded-xl bg-radar-panel/80 px-2 py-1"
        >
          <img className="w-[1.3rem]" src="./assets/icons/cog.svg" alt="" />
          <span className="text-radar-primary text-sm">Settings</span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[min(80vh,40rem)] overflow-y-auto bg-radar-panel/95 backdrop-blur-lg rounded-xl p-4 shadow-xl border border-radar-secondary/20">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-2 flex-wrap">
              {(isHost
                ? ["share", "display", "performance", "calibrate", "debug"]
                : ["display", "debug"]
              ).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTab(name)}
                  className={`text-xs px-2 py-1 rounded capitalize ${
                    tab === name
                      ? "bg-radar-primary text-[#1E3A54]"
                      : "text-radar-secondary"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="shrink-0 text-xs px-2 py-1 rounded bg-black/30 text-radar-secondary hover:text-radar-primary"
              title="Close settings"
            >
              Close
            </button>
          </div>

          {tab === "share" && isHost && (
            <div className="space-y-3">
              <div className="rounded-lg bg-black/25 border border-radar-secondary/20 p-3 space-y-2">
                <div className="text-radar-primary text-xs font-semibold">
                  Share this radar
                </div>
                <p className="text-[11px] text-radar-secondary leading-relaxed">
                  Send the link below to friends. They open it in any browser and see
                  the same live match, map alignment, and player positions. No installs
                  for them - only you need WebRadarDL running with the game.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-radar-secondary text-[10px] uppercase tracking-wide">
                  {publicUrl ? "Friend link (works anywhere)" : "Best link for friends"}
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={primaryShareUrl}
                    className="flex-1 bg-black/40 border border-radar-secondary/30 rounded px-2 py-1.5 text-radar-primary text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => copyShareUrl(primaryShareUrl)}
                    className="text-xs px-3 py-1.5 rounded bg-radar-primary text-[#1E3A54] font-medium shrink-0"
                  >
                    {copiedUrl === primaryShareUrl ? "Copied!" : "Copy"}
                  </button>
                </div>
                {!publicUrl && tunnelStatus === "starting" && (
                  <p className="text-[10px] text-amber-200/80">
                    Creating internet link... this usually takes 5-20 seconds.
                  </p>
                )}
                {!publicUrl && tunnelStatus === "failed" && (
                  <p className="text-[10px] text-amber-200/80">
                    Internet link unavailable{tunnelError ? `: ${tunnelError}` : ""}. Use the Same Wi-Fi links below.
                  </p>
                )}
              </div>

              {shareUrls.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-radar-secondary text-[10px] uppercase tracking-wide">
                    Same Wi-Fi only
                  </div>
                  {shareUrls.map((url) => (
                    <div key={url} className="flex gap-2">
                      <input
                        readOnly
                        value={url}
                        className="flex-1 bg-black/30 border border-radar-secondary/20 rounded px-2 py-1 text-radar-primary text-[11px] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyShareUrl(url)}
                        className="text-[11px] px-2 py-1 rounded border border-radar-secondary/30 text-radar-secondary shrink-0"
                      >
                        {copiedUrl === url ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-black/20 p-3 text-[10px] text-radar-secondary leading-relaxed space-y-1.5">
                <div className="text-radar-primary text-xs font-medium">Notes</div>
                <p>1. Keep the WebRadarDL console window open while you play.</p>
                <p>2. The public link changes each time you restart WebRadarDL.</p>
                <p>3. Only share with people you trust - anyone with the link can watch.</p>
                <p>
                  Viewers connected:{" "}
                  <span className="text-radar-primary font-semibold">
                    {shareInfo?.viewerCount ?? 0}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => copyShareUrl(primaryShareUrl)}
                  className="w-full text-left mt-1 rounded bg-black/30 border border-radar-secondary/20 px-2 py-1.5 hover:border-radar-primary/40 transition-colors"
                  title="Click to copy friend link"
                >
                  <div className="text-[9px] uppercase tracking-wide text-radar-secondary mb-0.5">
                    Friend link (works anywhere)
                  </div>
                  <div className="text-radar-primary font-mono text-[10px] truncate">
                    {copiedUrl === primaryShareUrl
                      ? "Copied!"
                      : publicUrl ||
                        (tunnelStatus === "starting"
                          ? "Public link starting..."
                          : primaryShareUrl)}
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Stop WebRadarDL and close all radar processes?")) {
                    return;
                  }
                  try {
                    await fetch("/api/shutdown", { method: "POST" });
                  } catch {
                    // launcher may exit before the response returns
                  }
                  window.close();
                }}
                className="w-full text-xs py-2.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-semibold"
              >
                End Program
              </button>
            </div>
          )}

          {tab === "display" && (
            <div className="space-y-3">
              <Slider
                label="Hero icon size on map"
                value={settings.dotSize}
                min={0.5}
                max={2}
                step={0.1}
                onChange={(dotSize) => patchSettings({ dotSize })}
                display={`${settings.dotSize}x`}
              />
              {isHost && (
                <div className="rounded-lg bg-black/25 border border-radar-secondary/20 p-3 space-y-2">
                  <div className="text-radar-primary text-xs font-semibold">
                    Map refresh
                  </div>
                  <p className="text-[10px] text-radar-secondary leading-relaxed">
                    Use after leaving the lobby and entering a match if heroes show in the
                    side cards but dots are missing or stuck off-map. Clears cached
                    lobby positions and forces a fresh entity scan.
                  </p>
                  <button
                    type="button"
                    onClick={handleReloadMap}
                    className="w-full text-xs py-2 rounded-lg bg-radar-primary/90 text-[#1E3A54] font-semibold hover:bg-radar-primary"
                  >
                    {reloadFlash ? "Reloading..." : "Reload Map"}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "performance" && isHost && (
            <div className="space-y-3">
              <div className="rounded-lg bg-black/25 border border-radar-secondary/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-radar-primary text-xs font-semibold">
                      Performance Mode
                    </div>
                    <p className="text-[10px] text-radar-secondary leading-relaxed mt-1">
                      Reduces how often the memory reader scans Deadlock. Helps when
                      in-game FPS dips while WebRadarDL is running.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patchSettings({ performanceMode: !settings.performanceMode })
                    }
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold ${
                      settings.performanceMode
                        ? "bg-emerald-500/90 text-black"
                        : "bg-radar-secondary/20 text-radar-secondary"
                    }`}
                  >
                    {settings.performanceMode ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <div
                className={`space-y-3 ${
                  settings.performanceMode ? "" : "opacity-45 pointer-events-none"
                }`}
              >
                <Slider
                  label="Update rate"
                  hint="Lower = less game strain, slightly less smooth dots"
                  value={settings.perfUpdateHz ?? 10}
                  min={5}
                  max={20}
                  step={1}
                  onChange={(perfUpdateHz) => patchSettings({ perfUpdateHz })}
                  display={`${settings.perfUpdateHz ?? 10} Hz`}
                />
                <Slider
                  label="Full entity scan interval"
                  hint="How often to rediscover players (lobby → match needs a scan)"
                  value={(settings.perfFullScanMs ?? 2000) / 1000}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onChange={(seconds) =>
                    patchSettings({ perfFullScanMs: Math.round(seconds * 1000) })
                  }
                  display={`${((settings.perfFullScanMs ?? 2000) / 1000).toFixed(1)}s`}
                />
                <label className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!settings.perfLowPriority}
                    onChange={(e) =>
                      patchSettings({ perfLowPriority: e.target.checked })
                    }
                    className="mt-0.5 accent-amber-400"
                  />
                  <span>
                    <span className="text-radar-primary text-xs font-medium block">
                      Lower reader process priority
                    </span>
                    <span className="text-[10px] text-radar-secondary leading-snug">
                      Gives Deadlock more CPU time when both run on the same PC.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!settings.perfSkipUnchanged}
                    onChange={(e) =>
                      patchSettings({ perfSkipUnchanged: e.target.checked })
                    }
                    className="mt-0.5 accent-amber-400"
                  />
                  <span>
                    <span className="text-radar-primary text-xs font-medium block">
                      Skip unchanged packets
                    </span>
                    <span className="text-[10px] text-radar-secondary leading-snug">
                      Do not resend WebSocket data when nothing moved.
                    </span>
                  </span>
                </label>
              </div>

              {!settings.performanceMode && (
                <p className="text-[10px] text-radar-secondary leading-relaxed">
                  Default when off: 20 Hz updates, full scan every ~0.2s, normal
                  priority.
                </p>
              )}
            </div>
          )}

          {tab === "calibrate" && isHost && (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-500/15 border border-amber-400/30 p-3 space-y-2">
                <div className="text-amber-200 text-xs font-semibold">
                  Easy calibration
                </div>
                <ol className="text-radar-secondary text-xs leading-relaxed list-decimal list-inside space-y-1.5">
                  <li>
                    Turn on <strong className="text-amber-200">Calibrate Map</strong> - your dot gets a{" "}
                    <strong className="text-amber-200">pulsing YOU ring</strong>.
                  </li>
                  <li>Stand on a map icon (guardian, shop, shrine).</li>
                  <li>
                    Use the <strong className="text-amber-200">arrow pad</strong> (or type Offset X/Y below) until{" "}
                    <strong className="text-amber-200">YOU</strong> sits on that icon.
                  </li>
                  <li>Walk somewhere else - if the dot drifts, adjust Scale X/Y.</li>
                </ol>
                {localPlayer && (
                  <div className="text-[11px] text-amber-200/90 pt-1 border-t border-amber-400/20">
                    Your hero: <strong>{getPlayerName(localPlayer, heroMap)}</strong>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-black/25 p-3 space-y-1.5 text-[10px] text-radar-secondary leading-relaxed">
                <div className="text-radar-primary text-xs font-medium">What do these mean?</div>
                <p>
                  <strong className="text-radar-primary">Offset X</strong> - slide every dot left (−) or right (+).
                  Start here.
                </p>
                <p>
                  <strong className="text-radar-primary">Offset Y</strong> - slide every dot up (−) or down (+).
                </p>
                <p>
                  <strong className="text-radar-primary">Scale X</strong> - stretch dots horizontally from map center.
                  Use if dots are correct in the middle but wrong at the sides (try 0.98-1.02).
                </p>
                <p>
                  <strong className="text-radar-primary">Scale Y</strong> - same vertically. Link both with the button below.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onCalibrationModeChange(false)}
                className="w-full text-xs py-2 rounded bg-amber-500/90 text-black font-medium"
              >
                Done calibrating
              </button>

              <label className="flex items-center gap-2 text-xs text-radar-secondary">
                <input
                  type="checkbox"
                  checked={calibrationMode}
                  onChange={(e) => onCalibrationModeChange(e.target.checked)}
                />
                Show calibration helpers on map
              </label>

              <label className="flex items-center gap-2 text-xs text-radar-secondary">
                <input
                  type="checkbox"
                  checked={fineStep}
                  onChange={(e) => setFineStep(e.target.checked)}
                />
                Fine nudge ({fineStep ? "0.001" : "0.01"} per arrow click)
              </label>

              <div className="text-center text-xs text-amber-200 font-medium">
                Step 1 - move dots (Offset)
              </div>
              <NudgePad
                onNudge={nudge}
                stepLabel={`Each click: ${fineStep ? "0.001" : "0.01"}`}
              />

              <SliderWithInput
                label="Offset X"
                hint="Negative = left, positive = right"
                value={calibration.offsetX ?? 0}
                min={-0.5}
                max={0.5}
                step={0.001}
                onChange={(offsetX) => updateCalibration({ offsetX })}
                formatValue={(v) => Number(v).toFixed(4)}
              />
              <SliderWithInput
                label="Offset Y"
                hint="Negative = up, positive = down"
                value={calibration.offsetY ?? 0}
                min={-0.5}
                max={0.5}
                step={0.001}
                onChange={(offsetY) => updateCalibration({ offsetY })}
                formatValue={(v) => Number(v).toFixed(4)}
              />

              <div className="text-center text-xs text-amber-200 font-medium pt-1">
                Step 2 - fix edge drift (Scale)
              </div>
              <SliderWithInput
                label="Scale X"
                hint="1.0 = default width. Below 1 = squeeze, above 1 = stretch"
                value={calibration.scaleX ?? 1}
                min={0.5}
                max={1.5}
                step={0.001}
                onChange={(scaleX) => updateCalibration({ scaleX })}
                formatValue={(v) => Number(v).toFixed(4)}
              />
              <SliderWithInput
                label="Scale Y"
                hint="1.0 = default height. Below 1 = squeeze, above 1 = stretch"
                value={calibration.scaleY ?? 1}
                min={0.5}
                max={1.5}
                step={0.001}
                onChange={(scaleY) => updateCalibration({ scaleY })}
                formatValue={(v) => Number(v).toFixed(4)}
              />
              <button
                type="button"
                onClick={() =>
                  updateCalibration({ scaleY: calibration.scaleX })
                }
                className="text-xs text-radar-secondary underline w-full text-left"
              >
                Copy Scale X → Scale Y
              </button>

              <label className="flex items-center gap-2 text-xs text-radar-secondary">
                <input
                  type="checkbox"
                  checked={calibration.flipX}
                  onChange={(e) => updateCalibration({ flipX: e.target.checked })}
                />
                Flip X
              </label>
              <label className="flex items-center gap-2 text-xs text-radar-secondary">
                <input
                  type="checkbox"
                  checked={calibration.flipY}
                  onChange={(e) => updateCalibration({ flipY: e.target.checked })}
                />
                Flip Y
              </label>

              <label className="flex items-center gap-2 text-xs text-radar-secondary">
                <input
                  type="checkbox"
                  checked={calibration.useFixedBounds}
                  onChange={(e) =>
                    updateCalibration({ useFixedBounds: e.target.checked })
                  }
                />
                Use manual world bounds
              </label>

              {bounds?.mins && (
                <button
                  type="button"
                  onClick={applyLiveBounds}
                  className="w-full text-xs py-1.5 rounded border border-radar-secondary/40 text-radar-secondary"
                >
                  Copy live bounds from game
                </button>
              )}

              {calibration.useFixedBounds && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["minX", calibration.minX],
                    ["minY", calibration.minY],
                    ["maxX", calibration.maxX],
                    ["maxY", calibration.maxY],
                  ].map(([key, val]) => (
                    <label key={key} className="flex flex-col gap-1 text-radar-secondary">
                      {key}
                      <input
                        type="number"
                        value={val}
                        onChange={(e) =>
                          updateCalibration({ [key]: parseFloat(e.target.value) })
                        }
                        className="bg-black/30 rounded px-2 py-1 text-radar-primary"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={copyCalibration}
                  className="flex-1 text-xs py-2 rounded bg-radar-primary text-[#1E3A54] font-medium"
                >
                  {copied ? "Copied!" : "Copy calibration JSON"}
                </button>
                <button
                  type="button"
                  onClick={() => onCalibrationChange({ ...DEFAULT_CALIBRATION })}
                  className="text-xs py-2 px-3 rounded border border-radar-secondary/40 text-radar-secondary"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {tab === "debug" && (
            <div className="space-y-2 text-xs font-mono text-radar-secondary">
              <div>
                Status:{" "}
                <span className="text-radar-primary">{connectionStatus}</span>
              </div>
              <div>
                Players on radar:{" "}
                <span className="text-radar-primary">{playerCount ?? 0}</span>
              </div>
              {debugData && (
                <>
                  <div className="pt-1 text-[10px] uppercase tracking-wide text-radar-secondary/70">
                    Memory reader
                  </div>
                  <div>
                    entity system:{" "}
                    <span className="text-radar-primary">
                      {debugData.entity_system_ok ? "ok" : "missing"}
                    </span>
                  </div>
                  <div>
                    game rules:{" "}
                    <span className="text-radar-primary">
                      {debugData.game_rules_ok ? "ok" : "missing"}
                    </span>
                  </div>
                  <div>
                    local controller:{" "}
                    <span className="text-radar-primary">
                      {debugData.local_controller_found ? "found" : "not found"}
                    </span>
                  </div>
                  <div>reader version: {debugData.reader_version ?? "?"}</div>
                  <div>
                    performance:{" "}
                    {debugData.performance_mode ? "ON" : "OFF"} /{" "}
                    {debugData.update_hz ?? "?"} Hz / scan every{" "}
                    {debugData.full_scan_every ?? "?"} ticks
                  </div>
                  <div>scan: {debugData.scan_method ?? "?"}</div>
                  <div>entity system: {debugData.entity_system_source ?? "?"}</div>
                  <div>local team: {debugData.local_team ?? "?"}</div>
                  <div>
                    local stats: hero {debugData.local_hero_id ?? "?"} hp{" "}
                    {debugData.local_health ?? "?"}/
                    {debugData.local_health_max ?? "?"}{" "}
                    {debugData.local_stats_valid ? "valid" : "invalid"}
                  </div>
                  <div>entities with ptr: {debugData.entities_with_ptr ?? 0}</div>
                  <div>teams found: {debugData.teams_found ?? 0}</div>
                  <div>controllers found: {debugData.controllers_found ?? 0}</div>
                  <div>
                    missing pawn: {debugData.controllers_missing_pawn ?? 0}
                  </div>
                  <div>players exported: {debugData.players_exported ?? 0}</div>
                  <div>bounds: {debugData.bounds_source ?? "?"}</div>
                  {debugData.designer_samples?.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[10px] uppercase tracking-wide text-radar-secondary/70">
                        Entity designer names (sample)
                      </div>
                      {debugData.designer_samples.map((name) => (
                        <div key={name} className="truncate">
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {!debugData && (
                <div className="text-radar-secondary/80">
                  Waiting for radar_reader.exe payload (run WebRadarDL as admin)
                </div>
              )}
              {bounds?.mins && (
                <>
                  <div className="pt-1 text-[10px] uppercase tracking-wide text-radar-secondary/70">
                    Minimap bounds
                  </div>
                  <div>
                    mins: {bounds.mins.x?.toFixed(1)}, {bounds.mins.y?.toFixed(1)}
                  </div>
                  <div>
                    maxs: {bounds.maxs.x?.toFixed(1)}, {bounds.maxs.y?.toFixed(1)}
                  </div>
                </>
              )}
              {localPlayer && (
                <>
                  <div className="pt-1 text-[10px] uppercase tracking-wide text-radar-secondary/70">
                    Local player
                  </div>
                  <div>
                    you: {getPlayerName(localPlayer, heroMap)} (
                    {resolveHeroSlug(localPlayer)})
                  </div>
                  <div>
                    world: {localPlayer.m_position?.x?.toFixed(1)},{" "}
                    {localPlayer.m_position?.y?.toFixed(1)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
