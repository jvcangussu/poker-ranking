"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Save,
  Shield,
  Swords,
  UserPlus,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { PokerSession } from "@/types/session";
import type {
  MatchSummaryRow,
  MatchEntryDetailedRow,
  PlayerBasic,
} from "@/types/database";

import type { ParticipantEntry } from "@/types/ui";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toNumber(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MatchDetailsPage() {
  const params = useParams<{ groupCode: string; matchId: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const rawMatchId = Array.isArray(params?.matchId)
    ? params.matchId[0]
    : params?.matchId;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);
  const matchId = rawMatchId ?? "";

  const [session, setSession] = useState<PokerSession | null>(null);
  const [match, setMatch] = useState<MatchSummaryRow | null>(null);
  const [entries, setEntries] = useState<ParticipantEntry[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerBasic[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [closingMatch, setClosingMatch] = useState(false);

  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});

  const [joinBuyIn, setJoinBuyIn] = useState("");
  const [joiningMatch, setJoiningMatch] = useState(false);

  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState("");
  const [addPlayerBuyIn, setAddPlayerBuyIn] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("poker-session");

    if (!stored) {
      setLoading(false);
      setPageError("Sessão não encontrada.");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PokerSession;

      if (!parsed?.groupCode || parsed.groupCode !== groupCode) {
        setLoading(false);
        setPageError("Sessão inválida para este grupo.");
        return;
      }

      setSession(parsed);
    } catch {
      setLoading(false);
      setPageError("Não foi possível carregar a sessão.");
    }
  }, [groupCode]);

  async function loadData(currentSession: PokerSession) {
    const [
      { data: matchData, error: matchError },
      { data: playersData, error: playersError },
      { data: entriesData, error: entriesError },
    ] = await Promise.all([
      supabase
        .from("v_match_summary")
        .select("*")
        .eq("match_id", matchId)
        .eq("group_id", currentSession.groupId)
        .maybeSingle(),
      supabase
        .from("players")
        .select("id, name, is_admin")
        .eq("group_id", currentSession.groupId)
        .order("name", { ascending: true }),
      supabase
        .from("v_match_entries_detailed")
        .select("*")
        .eq("match_id", matchId)
        .order("player_name", { ascending: true }),
    ]);

    if (matchError) throw matchError;
    if (playersError) throw playersError;
    if (entriesError) throw entriesError;

    if (!matchData) {
      throw new Error("Partida não encontrada.");
    }

    const players = (playersData ?? []) as PlayerBasic[];
    const detailedEntries = (entriesData ?? []) as MatchEntryDetailedRow[];

    const participantEntries: ParticipantEntry[] = detailedEntries.map((entry) => ({
      playerId: entry.player_id,
      playerName: entry.player_name,
      isAdmin: entry.is_admin,
      buyIn: String(Number(entry.buy_in)),
      cashOut: String(Number(entry.cash_out)),
      profit: Number(entry.profit),
    }));

    const participantIds = new Set(detailedEntries.map((entry) => entry.player_id));
    const notInMatch = players.filter((player) => !participantIds.has(player.id));

    setMatch(matchData as MatchSummaryRow);
    setEntries(participantEntries);
    setAvailablePlayers(notInMatch);
  }

  useEffect(() => {
    async function fetchPage() {
      if (!session?.groupId || !matchId) return;

      try {
        setLoading(true);
        setPageError(null);
        await loadData(session);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Erro ao carregar a partida."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPage();
  }, [session, matchId]);

  function updateEntry(playerId: string, field: "buyIn" | "cashOut", value: string) {
    setSavedMap((prev) => ({ ...prev, [playerId]: false }));
    setRowErrors((prev) => ({ ...prev, [playerId]: null }));

    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.playerId !== playerId) return entry;

        const updated = {
          ...entry,
          [field]: value,
        };

        return {
          ...updated,
          profit: toNumber(updated.cashOut) - toNumber(updated.buyIn),
        };
      })
    );
  }

  async function saveEntry(playerId: string) {
    if (!match) return;

    const entry = entries.find((item) => item.playerId === playerId);
    if (!entry) return;

    const buyIn = toNumber(entry.buyIn);
    const cashOut = toNumber(entry.cashOut);

    if (buyIn < 0 || cashOut < 0) {
      setRowErrors((prev) => ({
        ...prev,
        [playerId]: "Os valores não podem ser negativos.",
      }));
      return;
    }

    try {
      setSavingMap((prev) => ({ ...prev, [playerId]: true }));
      setRowErrors((prev) => ({ ...prev, [playerId]: null }));
      setSavedMap((prev) => ({ ...prev, [playerId]: false }));

      const { error } = await supabase.rpc("upsert_match_entry", {
        p_match_id: match.match_id,
        p_player_id: playerId,
        p_buy_in: buyIn,
        p_cash_out: cashOut,
      });

      if (error) throw error;

      setSavedMap((prev) => ({ ...prev, [playerId]: true }));

      if (session) {
        await loadData(session);
      }
    } catch (err) {
      let message = "Erro ao salvar este jogador.";

      if (err && typeof err === "object") {
        const maybeError = err as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        message = [
          maybeError.message,
          maybeError.details,
          maybeError.hint,
          maybeError.code ? `Código: ${maybeError.code}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
      }

      setRowErrors((prev) => ({
        ...prev,
        [playerId]: message,
      }));
    } finally {
      setSavingMap((prev) => ({ ...prev, [playerId]: false }));
    }
  }

  async function handleJoinMatch() {
    if (!session || !match) return;

    try {
      setJoiningMatch(true);
      setPageError(null);

      const buyInValue = toNumber(joinBuyIn);

      if (buyInValue < 0) {
        setPageError("O buy-in não pode ser negativo.");
        return;
      }

      const { error } = await supabase.rpc("upsert_match_entry", {
        p_match_id: match.match_id,
        p_player_id: session.playerId,
        p_buy_in: buyInValue,
        p_cash_out: 0,
      });

      if (error) throw error;

      setJoinBuyIn("");
      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao entrar na partida."
      );
    } finally {
      setJoiningMatch(false);
    }
  }

  async function handleAddParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!match || !session) return;

    if (!selectedPlayerToAdd) {
      setPageError("Selecione um jogador para adicionar.");
      return;
    }

    try {
      setAddingParticipant(true);
      setPageError(null);

      const buyInValue = toNumber(addPlayerBuyIn);

      if (buyInValue < 0) {
        setPageError("O buy-in não pode ser negativo.");
        return;
      }

      const { error } = await supabase.rpc("upsert_match_entry", {
        p_match_id: match.match_id,
        p_player_id: selectedPlayerToAdd,
        p_buy_in: buyInValue,
        p_cash_out: 0,
      });

      if (error) throw error;

      setSelectedPlayerToAdd("");
      setAddPlayerBuyIn("");
      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao adicionar jogador."
      );
    } finally {
      setAddingParticipant(false);
    }
  }

  async function handleCloseMatch() {
    if (!match || !session?.isAdmin) return;

    try {
      setClosingMatch(true);
      setPageError(null);

      const { error } = await supabase.rpc("close_match", {
        p_match_id: match.match_id,
      });

      if (error) throw error;

      if (session) {
        await loadData(session);
      }
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao fechar a partida."
      );
    } finally {
      setClosingMatch(false);
    }
  }

  const currentUserIsParticipant = entries.some(
    (entry) => entry.playerId === session?.playerId
  );

  const canManageParticipants =
    !!session && !!match && (session.isAdmin || session.playerId === match.created_by_player_id);

  const totalBuyIn = entries.reduce((sum, entry) => sum + toNumber(entry.buyIn), 0);
  const totalCashOut = entries.reduce((sum, entry) => sum + toNumber(entry.cashOut), 0);
  const totalProfit = totalCashOut - totalBuyIn;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando partida...
        </div>
      </div>
    );
  }

  if (pageError && !match) {
    return (
      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardContent className="p-8">
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {pageError}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href={`/${groupCode}/partidas`}>
            <ArrowLeft className="mr-2 size-4" />
            Voltar para partidas
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
              <Swords className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-heading text-2xl font-semibold">
                {match?.status === "closed" ? "Fechada" : "Aberta"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Participantes</p>
            <p className="font-heading mt-1 text-2xl font-semibold">
              {entries.length}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Buy-in total</p>
            <p className="font-heading mt-1 text-2xl font-semibold">
              {formatCurrency(totalBuyIn)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Cash-out total</p>
            <p className="font-heading mt-1 text-2xl font-semibold">
              {formatCurrency(totalCashOut)}
            </p>
          </CardContent>
        </Card>
      </section>

      {pageError && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          {pageError}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-heading text-2xl">
                Participantes da partida
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Apenas quem entrou na partida aparece nesta lista.
              </p>
            </div>

            {session?.isAdmin && match?.status === "open" && (
              <Button
                type="button"
                onClick={handleCloseMatch}
                disabled={closingMatch}
                variant="outline"
                className="rounded-full"
              >
                {closingMatch ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Fechando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    Fechar partida
                  </>
                )}
              </Button>
            )}
          </CardHeader>

          <CardContent>
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum participante entrou nesta partida ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => {
                  const canEdit =
                    match?.status === "open" &&
                    (session?.isAdmin || session?.playerId === entry.playerId);

                  return (
                    <div
                      key={entry.playerId}
                      className="rounded-3xl border border-border/70 bg-background/30 p-5"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading text-xl font-semibold">
                            {entry.playerName}
                          </h3>

                          {entry.isAdmin && (
                            <span className="rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                              Admin
                            </span>
                          )}

                          {session?.playerId === entry.playerId && (
                            <span className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Você
                            </span>
                          )}

                          {!canEdit && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              <Lock className="size-3" />
                              Somente leitura
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                              Buy-in
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={entry.buyIn}
                              onChange={(e) =>
                                updateEntry(entry.playerId, "buyIn", e.target.value)
                              }
                              disabled={!canEdit}
                              className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                              Cash-out
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={entry.cashOut}
                              onChange={(e) =>
                                updateEntry(entry.playerId, "cashOut", e.target.value)
                              }
                              disabled={!canEdit}
                              className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Resultado
                            </p>
                            <p
                              className={cn(
                                "mt-1 font-semibold",
                                entry.profit > 0 && "text-secondary",
                                entry.profit < 0 && "text-primary"
                              )}
                            >
                              {formatCurrency(entry.profit)}
                            </p>
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={() => saveEntry(entry.playerId)}
                              disabled={!canEdit || !!savingMap[entry.playerId]}
                              className="h-12 w-full rounded-2xl"
                            >
                              {savingMap[entry.playerId] ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 size-4" />
                                  Salvar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {savedMap[entry.playerId] && !rowErrors[entry.playerId] && (
                          <div className="rounded-2xl border border-secondary/30 bg-secondary/15 px-4 py-3 text-sm text-foreground">
                            Linha salva com sucesso.
                          </div>
                        )}

                        {rowErrors[entry.playerId] && (
                          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                            {rowErrors[entry.playerId]}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {match?.status === "open" && session && !currentUserIsParticipant && (
            <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-2xl">
                  <Users className="size-5" />
                  Entrar na partida
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Seu buy-in inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={joinBuyIn}
                    onChange={(e) => setJoinBuyIn(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleJoinMatch}
                  disabled={joiningMatch}
                  className="h-12 w-full rounded-full"
                >
                  {joiningMatch ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar na partida"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {match?.status === "open" && canManageParticipants && availablePlayers.length > 0 && (
            <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-2xl">
                  <UserPlus className="size-5" />
                  Adicionar jogador à partida
                </CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleAddParticipant} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Jogador
                    </label>
                    <select
                      value={selectedPlayerToAdd}
                      onChange={(e) => setSelectedPlayerToAdd(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    >
                      <option value="">Selecione um jogador</option>
                      {availablePlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                          {player.is_admin ? " (admin)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Buy-in inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={addPlayerBuyIn}
                      onChange={(e) => setAddPlayerBuyIn(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={addingParticipant}
                    className="h-12 w-full rounded-full"
                  >
                    {addingParticipant ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Adicionando...
                      </>
                    ) : (
                      "Adicionar participante"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Resumo</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Grupo</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {session?.groupName ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Criada por</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {match?.created_by_player_name ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {match?.played_at ? formatDate(match.played_at) : "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Observação</p>
                <p className="mt-1 text-sm leading-6 text-foreground">
                  {match?.notes?.trim() || "Sem observação informada."}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Seu acesso</p>
                <div className="mt-1 flex items-center gap-2">
                  {session?.isAdmin ? (
                    <>
                      <Shield className="size-4 text-secondary" />
                      <span className="font-medium">Administrador</span>
                    </>
                  ) : (
                    <span className="font-medium">Jogador padrão</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}