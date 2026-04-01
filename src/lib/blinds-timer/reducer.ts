import type {
  BlindLevel,
  BlindsTimerAction,
  BlindsTimerSession,
  BlindsTimerState,
} from "@/types/blinds";

const DEFAULT_LEVEL_DURATION_SECONDS = 20 * 60;

export function createBlindLevel(overrides?: Partial<BlindLevel>): BlindLevel {
  return {
    id: crypto.randomUUID(),
    label: "Novo nivel",
    smallBlind: 25,
    bigBlind: 50,
    ante: 0,
    durationSeconds: DEFAULT_LEVEL_DURATION_SECONDS,
    ...overrides,
  };
}

export function createDefaultBlindLevels(): BlindLevel[] {
  return [
    createBlindLevel({ label: "Nivel 1", smallBlind: 25, bigBlind: 50 }),
    createBlindLevel({ label: "Nivel 2", smallBlind: 50, bigBlind: 100 }),
    createBlindLevel({ label: "Nivel 3", smallBlind: 100, bigBlind: 200 }),
    createBlindLevel({ label: "Nivel 4", smallBlind: 200, bigBlind: 400 }),
  ];
}

function sanitizeLevel(level: BlindLevel): BlindLevel {
  const smallBlind = Math.max(0, Math.floor(Number(level.smallBlind) || 0));
  const bigBlind = Math.max(smallBlind, Math.floor(Number(level.bigBlind) || 0));
  const ante = Math.max(0, Math.floor(Number(level.ante) || 0));
  const durationSeconds = Math.max(
    60,
    Math.floor(Number(level.durationSeconds) || DEFAULT_LEVEL_DURATION_SECONDS)
  );

  return {
    ...level,
    label: level.label.trim() || "Nivel",
    smallBlind,
    bigBlind,
    ante,
    durationSeconds,
  };
}

export function sanitizeLevels(levels: BlindLevel[]): BlindLevel[] {
  return levels.map(sanitizeLevel);
}

export function getLevelDurationMs(levels: BlindLevel[], index: number): number {
  const level = levels[index];
  if (!level) return 0;
  return level.durationSeconds * 1000;
}

export function createSessionState(levels: BlindLevel[]): BlindsTimerState {
  const sanitizedLevels = sanitizeLevels(levels);

  return {
    levels: sanitizedLevels,
    currentLevelIndex: 0,
    remainingMs: getLevelDurationMs(sanitizedLevels, 0),
    status: "idle",
    lastTickAt: null,
  };
}

export function createInitialBlindsTimerState(
  levels = createDefaultBlindLevels()
): BlindsTimerState {
  return createSessionState(levels);
}

function moveLevel(
  levels: BlindLevel[],
  levelId: string,
  direction: "up" | "down"
): BlindLevel[] {
  const index = levels.findIndex((level) => level.id === levelId);
  if (index === -1) return levels;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= levels.length) return levels;

  const next = [...levels];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function advanceTimer(state: BlindsTimerState, now: number): BlindsTimerState {
  if (state.status !== "running" || state.lastTickAt === null) return state;

  const elapsedMs = Math.max(0, now - state.lastTickAt);
  if (elapsedMs <= 0) return state;

  let currentLevelIndex = state.currentLevelIndex;
  let remainingMs = state.remainingMs - elapsedMs;

  while (remainingMs <= 0) {
    const nextLevelIndex = currentLevelIndex + 1;

    if (nextLevelIndex >= state.levels.length) {
      return {
        ...state,
        currentLevelIndex: Math.max(0, state.levels.length - 1),
        remainingMs: 0,
        status: "finished",
        lastTickAt: null,
      };
    }

    currentLevelIndex = nextLevelIndex;
    remainingMs += getLevelDurationMs(state.levels, currentLevelIndex);
  }

  return {
    ...state,
    currentLevelIndex,
    remainingMs,
    lastTickAt: now,
  };
}

function jumpToLevel(
  state: BlindsTimerState,
  targetIndex: number,
  status: BlindsTimerState["status"],
  now: number
): BlindsTimerState {
  if (state.levels.length === 0) return state;

  const boundedIndex = Math.min(
    Math.max(targetIndex, 0),
    Math.max(0, state.levels.length - 1)
  );

  return {
    ...state,
    currentLevelIndex: boundedIndex,
    remainingMs: getLevelDurationMs(state.levels, boundedIndex),
    status,
    lastTickAt: status === "running" ? now : null,
  };
}

export function createSessionSnapshot(
  state: BlindsTimerState
): BlindsTimerSession {
  return {
    currentLevelIndex: state.currentLevelIndex,
    remainingMs: state.remainingMs,
    status: state.status,
    lastTickAt: state.lastTickAt,
  };
}

export function blindsTimerReducer(
  state: BlindsTimerState,
  action: BlindsTimerAction
): BlindsTimerState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "add_level":
      return createSessionState([...state.levels, sanitizeLevel(action.level)]);

    case "update_level":
      return createSessionState(
        state.levels.map((level) =>
          level.id === action.levelId
            ? sanitizeLevel({ ...level, ...action.patch })
            : level
        )
      );

    case "remove_level": {
      const nextLevels = state.levels.filter((level) => level.id !== action.levelId);
      if (nextLevels.length === 0) {
        return {
          levels: [],
          currentLevelIndex: 0,
          remainingMs: 0,
          status: "idle",
          lastTickAt: null,
        };
      }
      return createSessionState(nextLevels);
    }

    case "move_level":
      return createSessionState(moveLevel(state.levels, action.levelId, action.direction));

    case "start":
      if (state.levels.length === 0) return state;
      return {
        ...state,
        currentLevelIndex: 0,
        remainingMs: getLevelDurationMs(state.levels, 0),
        status: "running",
        lastTickAt: action.now,
      };

    case "pause":
      if (state.status !== "running") return state;
      return { ...state, status: "paused", lastTickAt: null };

    case "resume":
      if (state.status !== "paused" || state.levels.length === 0) return state;
      return { ...state, status: "running", lastTickAt: action.now };

    case "tick":
      return advanceTimer(state, action.now);

    case "next_level":
      return jumpToLevel(
        state,
        state.currentLevelIndex + 1,
        state.status === "running" ? "running" : "paused",
        action.now
      );

    case "previous_level":
      return jumpToLevel(
        state,
        state.currentLevelIndex - 1,
        state.status === "running" ? "running" : "paused",
        action.now
      );

    case "restart_level":
      if (state.levels.length === 0) return state;
      return {
        ...state,
        remainingMs: getLevelDurationMs(state.levels, state.currentLevelIndex),
        lastTickAt: state.status === "running" ? action.now : null,
      };

    case "reset_session":
      return createSessionState(state.levels);

    default:
      return state;
  }
}
