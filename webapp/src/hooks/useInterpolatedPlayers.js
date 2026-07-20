import { useEffect, useRef, useState } from "react";

const SMOOTHING_MS = 85;
const STALE_SNAP_MS = 280;
const TELEPORT_UNITS = 4500;

function copyPosition(position) {
  return {
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    z: position?.z ?? 0,
  };
}

function positionDistance(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.hypot(dx, dy);
}

function smoothPosition(current, target, alpha) {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

export function useInterpolatedPlayers(
  playerArray,
  { enabled = true, resetToken = 0 } = {}
) {
  const [displayPlayers, setDisplayPlayers] = useState(playerArray);
  const targetsRef = useRef(new Map());
  const displayRef = useRef(new Map());
  const lastPacketAtRef = useRef(0);
  const frameRef = useRef(0);
  const lastFrameAtRef = useRef(0);

  useEffect(() => {
    targetsRef.current.clear();
    displayRef.current.clear();
    lastPacketAtRef.current = 0;
    setDisplayPlayers([]);
  }, [resetToken]);

  useEffect(() => {
    if (!enabled) {
      setDisplayPlayers(playerArray);
      return;
    }

    const now = performance.now();
    lastPacketAtRef.current = now;
    const activeIds = new Set();

    playerArray.forEach((player) => {
      activeIds.add(player.m_idx);
      const target = copyPosition(player.m_position);
      targetsRef.current.set(player.m_idx, player);

      const previous = displayRef.current.get(player.m_idx);
      if (
        !previous ||
        player.m_is_dead ||
        positionDistance(previous, target) >= TELEPORT_UNITS
      ) {
        displayRef.current.set(player.m_idx, target);
      }
    });

    for (const id of displayRef.current.keys()) {
      if (!activeIds.has(id)) {
        displayRef.current.delete(id);
        targetsRef.current.delete(id);
      }
    }

    if (displayRef.current.size === 0) {
      setDisplayPlayers(playerArray);
    }
  }, [playerArray, enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const tick = (now) => {
      const dt = Math.min(48, now - (lastFrameAtRef.current || now));
      lastFrameAtRef.current = now;
      const alpha = 1 - Math.exp(-dt / SMOOTHING_MS);
      const stale = now - lastPacketAtRef.current > STALE_SNAP_MS;
      const nextPlayers = [];

      targetsRef.current.forEach((player, id) => {
        const target = copyPosition(player.m_position);
        const current = displayRef.current.get(id) ?? target;
        const nextPosition =
          stale || player.m_is_dead
            ? target
            : smoothPosition(current, target, alpha);

        displayRef.current.set(id, nextPosition);
        nextPlayers.push({
          ...player,
          m_position: nextPosition,
        });
      });

      if (nextPlayers.length > 0) {
        setDisplayPlayers(nextPlayers);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [enabled]);

  if (!enabled) {
    return playerArray;
  }

  return displayPlayers.length > 0 ? displayPlayers : playerArray;
}
