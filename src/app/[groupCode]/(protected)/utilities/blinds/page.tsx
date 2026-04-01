"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  blindsTimerReducer,
  createBlindLevel,
  createInitialBlindsTimerState,
} from "@/lib/blinds-timer/reducer";
import {
  clearBlindsTimerFromLocalStorage,
  loadBlindsTimerFromLocalStorage,
  saveBlindsTimerToLocalStorage,
} from "@/lib/blinds-timer/storage";
import { cn } from "@/lib/utils";

import type { BlindLevel } from "@/types/blinds";

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${padTime(minutes)}:${padTime(seconds)}`;
}

function formatBlind(level: BlindLevel | null) {
  if (!level) return "-";
  const anteLabel = level.ante > 0 ? ` / ante ${level.ante}` : "";
  return `${level.smallBlind}/${level.bigBlind}${anteLabel}`;
}

function minutesFromSeconds(seconds: number) {
  return Math.max(1, Math.floor(seconds / 60));
}

export default function BlindsUtilityPage() {
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [state, dispatch] = useReducer(
    blindsTimerReducer,
    undefined,
    createInitialBlindsTimerState
  );
  const hydratedRef = useRef(false);
  const skipFirstPersistRef = useRef(true);

  useEffect(() => {
    const restoredState = loadBlindsTimerFromLocalStorage(groupCode);

    if (restoredState) {
      dispatch({ type: "hydrate", state: restoredState });
    }

    hydratedRef.current = true;
  }, [groupCode]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }

    if (state.levels.length === 0) {
      clearBlindsTimerFromLocalStorage(groupCode);
      return;
    }

    saveBlindsTimerToLocalStorage(groupCode, state);
  }, [groupCode, state]);

  useEffect(() => {
    if (state.status !== "running") return;

    const intervalId = window.setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [state.status]);

  const currentLevel = state.levels[state.currentLevelIndex] ?? null;
  const nextLevel = state.levels[state.currentLevelIndex + 1] ?? null;
  const totalLevels = state.levels.length;
  const currentLevelDurationMs = currentLevel
    ? currentLevel.durationSeconds * 1000
    : 0;
  const progressPercent =
    currentLevelDurationMs > 0
      ? Math.min(100, Math.max(0, (state.remainingMs / currentLevelDurationMs) * 100))
      : 0;
  const totalMinutes = Math.floor(
    state.levels.reduce((sum, level) => sum + level.durationSeconds, 0) / 60
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href={`/${groupCode}/utilities`}>
            <ArrowLeft className="mr-2 size-4" />
            Voltar para Utilities
          </Link>
        </Button>
      </div>

      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-2xl">
            <Timer className="size-5" />
            Cronometro de Big Blinds
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background/30 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estado atual</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
                      state.status === "running" &&
                        "border-secondary/30 bg-secondary text-secondary-foreground",
                      state.status === "paused" &&
                        "border-amber-500/35 bg-amber-500/10 text-amber-100",
                      state.status === "idle" &&
                        "border-border/70 bg-card text-muted-foreground",
                      state.status === "finished" &&
                        "border-primary/40 bg-primary/10 text-foreground"
                    )}
                  >
                    {state.status === "idle" && "Parado"}
                    {state.status === "running" && "Rodando"}
                    {state.status === "paused" && "Pausado"}
                    {state.status === "finished" && "Finalizado"}
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
                    Grupo: {groupCode}
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
                    Niveis: {totalLevels}
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
                    Tempo total: {totalMinutes} min
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {state.status === "running" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => dispatch({ type: "pause" })}
                  >
                    <Pause className="mr-2 size-4" />
                    Pausar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() =>
                      dispatch({
                        type: state.status === "paused" ? "resume" : "start",
                        now: Date.now(),
                      })
                    }
                    disabled={state.levels.length === 0}
                  >
                    <Play className="mr-2 size-4" />
                    {state.status === "paused" ? "Retomar" : "Iniciar"}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => dispatch({ type: "reset_session" })}
                  disabled={state.levels.length === 0}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-border/70 bg-card/40 p-5">
                <p className="text-sm text-muted-foreground">Tempo restante</p>
                <p className="mt-2 font-heading text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
                  {formatRemainingTime(state.remainingMs)}
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-background/80">
                  <div
                    className="h-full rounded-full bg-secondary transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-border/70 bg-card/40 p-4">
                  <p className="text-sm text-muted-foreground">Nivel atual</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {currentLevel
                      ? `${state.currentLevelIndex + 1}. ${currentLevel.label}`
                      : "-"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBlind(currentLevel)}
                  </p>
                </div>

                <div className="rounded-3xl border border-border/70 bg-card/40 p-4">
                  <p className="text-sm text-muted-foreground">Proximo nivel</p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    {nextLevel ? nextLevel.label : "Fim da estrutura"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBlind(nextLevel)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={state.levels.length === 0 || state.currentLevelIndex === 0}
                onClick={() => dispatch({ type: "previous_level", now: Date.now() })}
              >
                <SkipBack className="mr-2 size-4" />
                Nivel anterior
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={
                  state.levels.length === 0 ||
                  state.currentLevelIndex >= Math.max(0, state.levels.length - 1)
                }
                onClick={() => dispatch({ type: "next_level", now: Date.now() })}
              >
                <SkipForward className="mr-2 size-4" />
                Proximo nivel
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={state.levels.length === 0}
                onClick={() => dispatch({ type: "restart_level", now: Date.now() })}
              >
                <RotateCcw className="mr-2 size-4" />
                Reiniciar nivel
              </Button>
            </div>
          </div>

          <Card className="rounded-[2rem] border-border/70 bg-background/30 shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Estrutura de blinds
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {state.levels.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum nivel configurado ainda.
                </div>
              ) : (
                state.levels.map((level, index) => (
                  <div
                    key={level.id}
                    className={cn(
                      "rounded-3xl border border-border/70 bg-card/40 p-4",
                      index === state.currentLevelIndex &&
                        "border-secondary/40 shadow-lg shadow-secondary/10"
                    )}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Nivel {index + 1}
                          </p>
                          <p className="font-medium text-foreground">{level.label}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={index === 0}
                            onClick={() =>
                              dispatch({
                                type: "move_level",
                                levelId: level.id,
                                direction: "up",
                              })
                            }
                            aria-label="Mover nivel para cima"
                          >
                            <ChevronUp className="size-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={index === state.levels.length - 1}
                            onClick={() =>
                              dispatch({
                                type: "move_level",
                                levelId: level.id,
                                direction: "down",
                              })
                            }
                            aria-label="Mover nivel para baixo"
                          >
                            <ChevronDown className="size-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            disabled={state.levels.length === 1}
                            onClick={() =>
                              dispatch({ type: "remove_level", levelId: level.id })
                            }
                          >
                            Remover
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div className="xl:col-span-2">
                          <label className="mb-2 block text-sm font-medium">
                            Nome do nivel
                          </label>
                          <input
                            type="text"
                            value={level.label}
                            onChange={(event) =>
                              dispatch({
                                type: "update_level",
                                levelId: level.id,
                                patch: { label: event.target.value },
                              })
                            }
                            className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Small blind
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={level.smallBlind}
                            onChange={(event) =>
                              dispatch({
                                type: "update_level",
                                levelId: level.id,
                                patch: {
                                  smallBlind: Number(event.target.value || 0),
                                },
                              })
                            }
                            className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Big blind
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={level.bigBlind}
                            onChange={(event) =>
                              dispatch({
                                type: "update_level",
                                levelId: level.id,
                                patch: {
                                  bigBlind: Number(event.target.value || 0),
                                },
                              })
                            }
                            className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Ante
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={level.ante}
                            onChange={(event) =>
                              dispatch({
                                type: "update_level",
                                levelId: level.id,
                                patch: {
                                  ante: Number(event.target.value || 0),
                                },
                              })
                            }
                            className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Duracao (min)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={minutesFromSeconds(level.durationSeconds)}
                            onChange={(event) =>
                              dispatch({
                                type: "update_level",
                                levelId: level.id,
                                patch: {
                                  durationSeconds: Number(event.target.value || 1) * 60,
                                },
                              })
                            }
                            className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  dispatch({
                    type: "add_level",
                    level: createBlindLevel({
                      label: `Nivel ${state.levels.length + 1}`,
                      smallBlind: state.levels[state.levels.length - 1]?.bigBlind ?? 25,
                      bigBlind:
                        (state.levels[state.levels.length - 1]?.bigBlind ?? 25) * 2,
                    }),
                  })
                }
              >
                <Plus className="mr-2 size-4" />
                Adicionar nivel
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
