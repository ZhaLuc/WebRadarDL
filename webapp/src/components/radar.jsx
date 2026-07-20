import { useRef } from "react";
import Player from "./player";
import StatLockerMap from "./statlockermap";
import { getPlayerName, getRadarPosition, isMapRotatedForTeam, FIXED_MAP_ZOOM } from "../utilities/utilities";

const CalibrationOverlay = ({ localPlayerName, mapRotated }) => {
  const uprightStyle = mapRotated ? { transform: "rotate(180deg)" } : undefined;

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-[11] rounded-full overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.18) 1px, transparent 1px)",
          backgroundSize: "10% 10%",
        }}
      />

      <div className="absolute inset-0 pointer-events-none z-[12] rounded-full overflow-hidden">
        <div
          className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
          style={{ background: "rgba(251, 191, 36, 0.55)" }}
        />
        <div
          className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2"
          style={{ background: "rgba(251, 191, 36, 0.55)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300"
          style={{ boxShadow: "0 0 12px rgba(251,191,36,0.8)" }}
        />
      </div>

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[13] pointer-events-none max-w-[92%]">
        <div
          className="rounded-lg bg-black/80 border border-amber-400/50 px-3 py-2 text-center shadow-lg"
          style={uprightStyle}
        >
          <div className="text-amber-300 text-xs font-bold tracking-wide">
            CALIBRATION MODE
          </div>
          <div className="text-[11px] text-white/90 mt-0.5 leading-snug">
            Stand on a map icon, then move arrows until the pulsing{" "}
            <span className="text-amber-300 font-bold">YOU</span> dot sits on it.
          </div>
          {localPlayerName && (
            <div className="text-[10px] text-amber-200/80 mt-1">
              Your dot: {localPlayerName}
            </div>
          )}
        </div>
      </div>

      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[13] pointer-events-none flex gap-4 text-[10px] font-bold text-amber-300/70"
        style={uprightStyle}
      >
        <span>◀ left</span>
        <span>▲ up</span>
        <span>▼ down</span>
        <span>right ▶</span>
      </div>
    </>
  );
};

// Fixed display zoom (matches the old default). Not user-adjustable - changing it
// breaks calibration relative to the map art.
const MAP_ZOOM = FIXED_MAP_ZOOM;

const Radar = ({
  playerArray,
  bounds,
  mapData,
  localTeam,
  settings,
  heroMap,
  calibrationMode,
}) => {
  const mapContainerRef = useRef();
  const lastPositionsRef = useRef(new Map());
  const localPlayer = playerArray.find((p) => p.m_is_local);
  const mapRotated = isMapRotatedForTeam(localTeam);

  playerArray.forEach((player) => {
    if (player.m_is_dead) {
      return;
    }

    const position = getRadarPosition(bounds, player.m_position, mapData);
    if (
      position &&
      (player.m_position?.x !== 0 || player.m_position?.y !== 0)
    ) {
      lastPositionsRef.current.set(player.m_idx, position);
    }
  });

  return (
    <div
      id="radar"
      className="relative origin-center transition-transform duration-150 w-full max-w-[900px] overflow-visible bg-black"
      style={{
        transform: `scale(${MAP_ZOOM})`,
        maxWidth: `${900 / MAP_ZOOM}px`,
      }}
    >
      <div
        className="relative w-full origin-center transition-transform duration-300"
        style={{ transform: mapRotated ? "rotate(180deg)" : undefined }}
      >
        {calibrationMode && (
          <CalibrationOverlay
            localPlayerName={
              localPlayer ? getPlayerName(localPlayer, heroMap) : null
            }
            mapRotated={mapRotated}
          />
        )}

        <StatLockerMap ref={mapContainerRef} />

        <div className="absolute inset-0 overflow-visible pointer-events-none z-[15]">
          {playerArray.map((player) => (
            <Player
              key={player.m_idx}
              playerData={player}
              bounds={bounds}
              mapData={mapData}
              radarImage={mapContainerRef.current}
              localTeam={localTeam}
              settings={settings}
              heroMap={heroMap}
              calibrationMode={calibrationMode}
              mapRotated={mapRotated}
              frozenPosition={
                player.m_is_dead
                  ? lastPositionsRef.current.get(player.m_idx) ||
                    getRadarPosition(bounds, player.m_position, mapData)
                  : null
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Radar;
