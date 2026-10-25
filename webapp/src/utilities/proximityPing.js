export const DEFAULT_PING_SETTINGS = {
  enabled: false,
  volume: 85,
  range: 1800,
  intervalSec: 4,
  sound: "chime",
};

export const PING_SOUNDS = [
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "pulse", label: "Pulse" },
  { id: "sonar", label: "Sonar" },
  { id: "alert", label: "Alert" },
];

const PING_STORAGE_KEY = "deadlockProximityPingSettings";
const FOLLOW_STORAGE_KEY = "deadlockPingFollow";

let audioContext = null;

const getAudioContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  return audioContext;
};

export const unlockProximityAudio = () => {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    context.resume();
  }
};

export const loadPingSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PING_STORAGE_KEY) || "null");
    const merged = { ...DEFAULT_PING_SETTINGS, ...(saved || {}) };
    if (!saved && localStorage.getItem("deadlockProximityPing") === "1") {
      merged.enabled = true;
    }
    if (!PING_SOUNDS.some((sound) => sound.id === merged.sound)) {
      merged.sound = DEFAULT_PING_SETTINGS.sound;
    }
    merged.volume = clamp(Number(merged.volume) || DEFAULT_PING_SETTINGS.volume, 15, 100);
    merged.range = clamp(Number(merged.range) || DEFAULT_PING_SETTINGS.range, 600, 4500);
    merged.intervalSec = clamp(Number(merged.intervalSec) || DEFAULT_PING_SETTINGS.intervalSec, 1, 20);
    return merged;
  } catch {
    return { ...DEFAULT_PING_SETTINGS };
  }
};

export const savePingSettings = (settings) => {
  localStorage.setItem(PING_STORAGE_KEY, JSON.stringify(settings));
};

export const loadPingFollow = () => localStorage.getItem(FOLLOW_STORAGE_KEY) || "";

export const savePingFollow = (key) => {
  if (key) {
    localStorage.setItem(FOLLOW_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(FOLLOW_STORAGE_KEY);
  }
};

export const pingSubjectKey = (player) =>
  player ? `${player.m_team}:${player.m_hero_id}` : "";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hasMapPosition = (player) => {
  const x = player?.m_position?.x;
  const y = player?.m_position?.y;
  return x != null && y != null && (x !== 0 || y !== 0) && player.m_has_pawn;
};

export const resolvePingSubject = (players, followKey, isHost) => {
  if (followKey) {
    const chosen = players.find((player) => pingSubjectKey(player) === followKey);
    if (chosen) {
      return chosen;
    }
  }

  if (isHost) {
    return players.find((player) => player.m_is_local) || null;
  }

  return null;
};

export const enemyIsNearSubject = (players, subject, range) => {
  if (!subject || subject.m_is_dead || !hasMapPosition(subject)) {
    return false;
  }

  return players.some((enemy) => {
    if (
      pingSubjectKey(enemy) === pingSubjectKey(subject) ||
      enemy.m_team === subject.m_team ||
      enemy.m_team === 1 ||
      enemy.m_is_dead ||
      !hasMapPosition(enemy)
    ) {
      return false;
    }

    const distance = Math.hypot(
      enemy.m_position.x - subject.m_position.x,
      enemy.m_position.y - subject.m_position.y
    );
    return distance <= range;
  });
};

const tone = (context, destination, start, frequency, offset, duration, type = "sine") => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start + offset);
  gain.gain.setValueAtTime(0.0001, start + offset);
  gain.gain.exponentialRampToValueAtTime(1, start + offset + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(start + offset);
  oscillator.stop(start + offset + duration + 0.03);
};

const playShape = (context, destination, start, sound) => {
  if (sound === "bell") {
    tone(context, destination, start, 1318, 0, 0.28, "sine");
    tone(context, destination, start, 1976, 0.02, 0.16, "triangle");
    return;
  }

  if (sound === "pulse") {
    tone(context, destination, start, 520, 0, 0.08, "square");
    tone(context, destination, start, 520, 0.12, 0.08, "square");
    return;
  }

  if (sound === "sonar") {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(980, start);
    oscillator.frequency.exponentialRampToValueAtTime(320, start + 0.32);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + 0.36);
    return;
  }

  if (sound === "alert") {
    tone(context, destination, start, 880, 0, 0.07, "square");
    tone(context, destination, start, 880, 0.1, 0.07, "square");
    tone(context, destination, start, 1174, 0.2, 0.12, "square");
    return;
  }

  tone(context, destination, start, 740, 0, 0.11, "sine");
  tone(context, destination, start, 1046, 0.09, 0.2, "sine");
};

export const playEnemyProximityPing = (sound = "chime", volumePercent = 85, emphasize = false) => {
  const context = getAudioContext();
  if (!context) {
    return;
  }
  if (context.state === "suspended") {
    context.resume();
  }

  const start = context.currentTime;
  const loudness = clamp(volumePercent, 15, 100) / 100;
  const peak = Math.min(1, loudness * (emphasize ? 1.35 : 1));
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.46);
  master.connect(context.destination);
  playShape(context, master, start, sound);
};
