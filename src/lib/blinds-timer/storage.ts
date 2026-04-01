import {
  blindsTimerReducer,
  createSessionSnapshot,
  createSessionState,
  getLevelDurationMs,
  sanitizeLevels,
} from "@/lib/blinds-timer/reducer";

import type {
  BlindsTimerConfig,
  BlindsTimerState,
  PersistedBlindsTimerData,
} from "@/types/blinds";

function getStorageKey(groupCode: string) {
  return `poker-blinds-timer:${groupCode}`;
}

export function buildPersistedBlindsTimerData(
  state: BlindsTimerState
): PersistedBlindsTimerData {
  return {
    version: 1,
    config: {
      levels: state.levels,
    },
    session: createSessionSnapshot(state),
    savedAt: Date.now(),
  };
}

export function saveBlindsTimerToLocalStorage(
  groupCode: string,
  state: BlindsTimerState
) {
  if (typeof window === "undefined") return;

  const payload = buildPersistedBlindsTimerData(state);
  window.localStorage.setItem(getStorageKey(groupCode), JSON.stringify(payload));
}

function restoreStateFromPayload(payload: PersistedBlindsTimerData): BlindsTimerState {
  const levels = sanitizeLevels(payload.config?.levels ?? []);
  const baseState = createSessionState(levels);

  if (levels.length === 0) {
    return baseState;
  }

  const maxIndex = Math.max(0, levels.length - 1);
  const currentLevelIndex = Math.min(
    Math.max(payload.session.currentLevelIndex ?? 0, 0),
    maxIndex
  );
  const levelDurationMs = getLevelDurationMs(levels, currentLevelIndex);
  const remainingMs = Math.min(
    Math.max(0, Number(payload.session.remainingMs) || 0),
    levelDurationMs
  );

  let restored: BlindsTimerState = {
    levels,
    currentLevelIndex,
    remainingMs,
    status: payload.session.status ?? "idle",
    lastTickAt: payload.session.lastTickAt ?? null,
  };

  if (restored.status === "running" && restored.lastTickAt != null) {
    restored = blindsTimerReducer(restored, {
      type: "tick",
      now: Date.now(),
    });
  }

  if (restored.status === "paused") {
    restored = {
      ...restored,
      lastTickAt: null,
    };
  }

  return restored;
}

export function loadBlindsTimerFromLocalStorage(
  groupCode: string
): BlindsTimerState | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(getStorageKey(groupCode));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedBlindsTimerData;
    if (parsed?.version !== 1 || !parsed.config || !parsed.session) {
      return null;
    }

    return restoreStateFromPayload(parsed);
  } catch {
    return null;
  }
}

export function clearBlindsTimerFromLocalStorage(groupCode: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getStorageKey(groupCode));
}

export function buildBlindsTimerConfig(levels: BlindsTimerState["levels"]): BlindsTimerConfig {
  return { levels };
}
