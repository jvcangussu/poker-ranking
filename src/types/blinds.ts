export type BlindLevel = {
  id: string;
  label: string;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationSeconds: number;
};

export type BlindsTimerStatus = "idle" | "running" | "paused" | "finished";

export type BlindsTimerState = {
  levels: BlindLevel[];
  currentLevelIndex: number;
  remainingMs: number;
  status: BlindsTimerStatus;
  lastTickAt: number | null;
};

export type BlindsTimerConfig = {
  levels: BlindLevel[];
};

export type BlindsTimerSession = {
  currentLevelIndex: number;
  remainingMs: number;
  status: BlindsTimerStatus;
  lastTickAt: number | null;
};

export type PersistedBlindsTimerData = {
  version: 1;
  config: BlindsTimerConfig;
  session: BlindsTimerSession;
  savedAt: number;
};

export type BlindsTimerAction =
  | { type: "hydrate"; state: BlindsTimerState }
  | { type: "add_level"; level: BlindLevel }
  | {
      type: "update_level";
      levelId: string;
      patch: Partial<Omit<BlindLevel, "id">>;
    }
  | { type: "remove_level"; levelId: string }
  | { type: "move_level"; levelId: string; direction: "up" | "down" }
  | { type: "start"; now: number }
  | { type: "pause" }
  | { type: "resume"; now: number }
  | { type: "tick"; now: number }
  | { type: "next_level"; now: number }
  | { type: "previous_level"; now: number }
  | { type: "restart_level"; now: number }
  | { type: "reset_session" };
