import MaskedIcon from "./maskedicon";
import HeroPortrait from "./heroportrait";
import { getHeroImageForPlayer, getPlayerName, resolveHeroSlug, teamColors } from "../utilities/utilities";

const PlayerCard = ({ playerData, isOnRightSide, heroMap }) => {
  const heroImage = getHeroImageForPlayer(playerData, heroMap);
  const heroName = getPlayerName(playerData, heroMap);
  const healthPercent = playerData.m_health_max
    ? Math.round((playerData.m_health / playerData.m_health_max) * 100)
    : 0;
  const isDead = playerData.m_is_dead;

  return (
    <li
      style={{ opacity: isDead ? 0.55 : 1 }}
      className={`flex ${isOnRightSide ? "flex-row-reverse" : ""} gap-1.5`}
    >
      <div className="flex flex-col gap-0.5 justify-center items-center min-w-[3.25rem]">
        <div className="text-[11px] font-bold text-center leading-tight max-w-[4.5rem] truncate">
          {heroName}
        </div>
        <HeroPortrait
          heroImage={heroImage}
          heroName={heroName}
          variant="card"
          fallbackColor={teamColors[playerData.m_team] || "#4a9fd8"}
          fallbackSlug={resolveHeroSlug(playerData)}
          className="h-[3rem] w-[2.25rem] rounded-sm"
          style={isDead ? { filter: "grayscale(0.85)" } : undefined}
        />
      </div>

      <div
        className={`flex flex-col ${
          isOnRightSide ? "items-end" : "items-start"
        } justify-center gap-0.5 min-w-[4.5rem]`}
      >
        <div className={`flex ${isOnRightSide ? "flex-row-reverse" : ""} gap-1 items-center`}>
          <MaskedIcon
            path="./assets/icons/health.svg"
            height={12}
            color="bg-radar-secondary"
          />
          <span className="text-[11px] text-radar-primary leading-none">
            {isDead ? 0 : playerData.m_health}
            {playerData.m_health_max ? ` / ${playerData.m_health_max}` : ""}
          </span>
        </div>

        <div className="w-16 h-1 bg-radar-secondary/30 rounded overflow-hidden">
          <div
            className="h-full rounded"
            style={{
              width: `${Math.max(0, Math.min(100, isDead ? 0 : healthPercent))}%`,
              backgroundColor: isDead
                ? "#6b7280"
                : teamColors[playerData.m_team] || "#84c8ed",
            }}
          />
        </div>

        {isDead && (
          <span className="text-[9px] text-radar-red uppercase tracking-wide leading-none">
            Dead
          </span>
        )}
      </div>
    </li>
  );
};

export default PlayerCard;
