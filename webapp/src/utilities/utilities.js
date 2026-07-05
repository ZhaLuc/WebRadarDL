import heroIdMapData from "../data/hero-id-map.json";

export const teamEnum = {
  none: 0,
  spectator: 1,
  amber: 2,
  sapphire: 3,
};

export const teamColors = {
  [teamEnum.amber]: "#e8a838",
  [teamEnum.sapphire]: "#4a9fd8",
};

// Fallback when native reader sends slug "unknown" (keep in sync with hero-id-map.json).
const HERO_ID_SLUG = Object.fromEntries(
  Object.entries(heroIdMapData).map(([id, slug]) => [Number(id), slug])
);

export const resolveHeroSlug = (player) => {
  const slug = player?.m_hero_slug;
  if (slug && slug !== "unknown") {
    return slug;
  }

  return HERO_ID_SLUG[player?.m_hero_id] ?? slug;
};

// StatLocker art has amber (2) at the bottom. Sapphire (3) needs a 180° flip
// so your base always appears at the bottom like the in-game minimap.
export const isMapRotatedForTeam = (localTeam) =>
  localTeam === teamEnum.sapphire;

export const isRadarHost = () => {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

export const getWebSocketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/deadlock_webradar`;
};

export const SESSION_SHARE_TYPE = "session_share";

export const DEFAULT_CALIBRATION = {
  flipX: false,
  flipY: true,
  scaleX: 1.25,
  scaleY: 1.194,
  offsetX: 0.24,
  offsetY: 0.14,
  mapZoom: 0.82,
  useFixedBounds: false,
  minX: -8192,
  minY: -8192,
  maxX: 8192,
  maxY: 8192,
};

export const loadCalibration = () => {
  const saved = localStorage.getItem("deadlockMapCalibration");
  if (!saved) {
    return { ...DEFAULT_CALIBRATION };
  }

  return { ...DEFAULT_CALIBRATION, ...JSON.parse(saved) };
};

export const getActiveBounds = (bounds, calibration) => {
  if (calibration.useFixedBounds) {
    return {
      mins: { x: calibration.minX, y: calibration.minY },
      maxs: { x: calibration.maxX, y: calibration.maxY },
    };
  }

  return bounds;
};

export const getRadarPosition = (bounds, entityCoords, calibration = {}) => {
  const activeBounds = getActiveBounds(bounds, calibration);

  if (
    !activeBounds?.mins ||
    !activeBounds?.maxs ||
    entityCoords?.x == null ||
    entityCoords?.y == null
  ) {
    return { x: 0, y: 0 };
  }

  const rangeX = activeBounds.maxs.x - activeBounds.mins.x;
  const rangeY = activeBounds.maxs.y - activeBounds.mins.y;

  if (rangeX === 0 || rangeY === 0) {
    return { x: 0, y: 0 };
  }

  let x = (entityCoords.x - activeBounds.mins.x) / rangeX;
  let y = (entityCoords.y - activeBounds.mins.y) / rangeY;

  if (calibration.flipX) {
    x = 1 - x;
  }

  if (calibration.flipY !== false) {
    y = 1 - y;
  }

  const scaleX = calibration.scaleX ?? 1;
  const scaleY = calibration.scaleY ?? 1;
  const offsetX = calibration.offsetX ?? 0;
  const offsetY = calibration.offsetY ?? 0;

  x = (x - 0.5) * scaleX + 0.5 + offsetX;
  y = (y - 0.5) * scaleY + 0.5 + offsetY;

  return { x, y };
};

export const getHeroEntry = (heroSlug, heroMap) => {
  if (!heroSlug || !heroMap) {
    return null;
  }

  const entry = heroMap[heroSlug];
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    return { file: entry, name: heroSlug };
  }

  return entry;
};

export const getHeroImage = (heroSlug, heroMap) => {
  const entry = getHeroEntry(heroSlug, heroMap);
  return entry?.file ? `./heroes/${entry.file}` : null;
};

export const getHeroImageForPlayer = (player, heroMap) =>
  getHeroImage(resolveHeroSlug(player), heroMap);

export const getHeroName = (heroSlug, heroMap) => {
  const entry = getHeroEntry(heroSlug, heroMap);
  if (entry?.name) {
    return entry.name;
  }

  if (!heroSlug) {
    return "Unknown";
  }

  return heroSlug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getPlayerName = (player, heroMap) => {
  const heroName = getHeroName(resolveHeroSlug(player), heroMap);
  if (heroName && heroName !== "Unknown") {
    return heroName;
  }

  if (player?.m_name && player.m_name.trim() !== "" && player.m_name !== "Unknown Hero") {
    return player.m_name.trim();
  }

  return "Unknown";
};

export const calibrationToDataJson = (calibration) =>
  JSON.stringify(
    {
      flipX: calibration.flipX,
      flipY: calibration.flipY,
      scaleX: Number(calibration.scaleX.toFixed(4)),
      scaleY: Number(calibration.scaleY.toFixed(4)),
      offsetX: Number(calibration.offsetX.toFixed(4)),
      offsetY: Number(calibration.offsetY.toFixed(4)),
      mapZoom: Number((calibration.mapZoom ?? 0.82).toFixed(4)),
      useFixedBounds: calibration.useFixedBounds,
      minX: calibration.minX,
      minY: calibration.minY,
      maxX: calibration.maxX,
      maxY: calibration.maxY,
    },
    null,
    2
  );

export const nudgeCalibration = (calibration, axis, amount) => ({
  ...calibration,
  [axis]: Number(((calibration[axis] ?? 0) + amount).toFixed(4)),
});
