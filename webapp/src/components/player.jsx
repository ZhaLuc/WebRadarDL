import { useRef } from "react";
import HeroPortrait from "./heroportrait";
import {
  getRadarPosition,
  getHeroImage,
  getPlayerName,
  teamColors,
} from "../utilities/utilities";

const Player = ({
  playerData,
  bounds,
  mapData,
  radarImage,
  localTeam,
  settings,
  heroMap,
  calibrationMode,
  mapRotated,
  frozenPosition,
}) => {
  const radarPosition =
    frozenPosition ||
    getRadarPosition(bounds, playerData.m_position, mapData) ||
    { x: 0, y: 0 };

  const missingPawn =
    !playerData.m_is_dead &&
    !playerData.m_has_pawn &&
    playerData.m_position?.x === 0 &&
    playerData.m_position?.y === 0;

  const hasRenderablePosition =
    radarPosition.x !== 0 || radarPosition.y !== 0 || playerData.m_is_dead;

  const playerRef = useRef();
  const playerBounding = (playerRef.current &&
    playerRef.current.getBoundingClientRect()) || { width: 0, height: 0 };

  const radarImageBounding = (radarImage !== undefined &&
    radarImage.getBoundingClientRect()) || { width: 0, height: 0 };

  const isLocal = playerData.m_is_local;
  const isCalibrating = calibrationMode && isLocal;
  const iconSize = (isCalibrating ? 3.4 : 2.8) * settings.dotSize;
  const isTeammate = playerData.m_team === localTeam;
  const teamColor = isTeammate
    ? teamColors[playerData.m_team] || "#4a9fd8"
    : "#e74c3c";
  const heroImage = getHeroImage(playerData.m_hero_slug, heroMap);
  const heroName = getPlayerName(playerData, heroMap);
  const isDead = playerData.m_is_dead;
  const borderColor = isCalibrating ? "#fbbf24" : isDead ? "#9ca3af" : teamColor;
  const uprightStyle = mapRotated ? { transform: "rotate(180deg)" } : undefined;

  const radarImageTranslation = {
    x: radarImageBounding.width * radarPosition.x - playerBounding.width * 0.5,
    y: radarImageBounding.height * radarPosition.y - playerBounding.height * 0.5,
  };

  if (!hasRenderablePosition && missingPawn) {
    return null;
  }

  return (
    <div
      className="absolute left-0 top-0 flex flex-col items-center"
      ref={playerRef}
      style={{
        transform: `translate(${radarImageTranslation.x}px, ${radarImageTranslation.y}px)`,
        transition: "none",
        zIndex: isCalibrating ? 20 : isDead ? 6 : 12,
        opacity: missingPawn ? 0 : 1,
      }}
    >
      <div
        className="relative flex flex-col items-center"
        style={{ opacity: isDead ? 0.55 : 1 }}
      >
        <div
          className="relative"
          style={{
            width: `${iconSize}vw`,
            height: `${iconSize}vw`,
          }}
        >
          {isCalibrating && (
            <>
              <div
                className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping"
                style={{ animationDuration: "1.5s" }}
              />
              <div className="absolute inset-0 rounded-full border-[3px] border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.9)]" />
            </>
          )}
          <div
            className="rounded-full overflow-hidden border-2 shadow-lg bg-black/40 w-full h-full relative z-[1]"
            style={{
              borderColor,
              borderStyle: isDead ? "dashed" : "solid",
              filter: isDead ? "grayscale(0.85)" : undefined,
            }}
          >
            <div className="w-full h-full" style={uprightStyle}>
              <HeroPortrait
                heroImage={heroImage}
                heroName={heroName}
                variant="radar"
                fallbackColor={teamColor}
                fallbackSlug={playerData.m_hero_slug}
              />
            </div>
          </div>
        </div>

        <span
          className="mt-0.5 px-1 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow"
          style={{
            ...uprightStyle,
            backgroundColor: isCalibrating
              ? "rgba(251, 191, 36, 0.95)"
              : isDead
                ? "rgba(40, 20, 20, 0.92)"
                : "rgba(7, 20, 30, 0.9)",
            color: isCalibrating ? "#1a1200" : isDead ? "#fca5a5" : "#ffffff",
            border: `1px solid ${borderColor}`,
          }}
        >
          {isCalibrating ? "YOU" : isDead ? `${heroName} · 0 HP` : heroName}
        </span>
        {isCalibrating && (
          <span
            className="text-[9px] text-amber-300/90 font-mono mt-0.5"
            style={uprightStyle}
          >
            {heroName} · {radarPosition.x.toFixed(3)}, {radarPosition.y.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
};

export default Player;
