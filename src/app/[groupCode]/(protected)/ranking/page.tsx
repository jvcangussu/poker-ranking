"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Crown,
  Loader2,
  Plus,
  Swords,
  TrendingDown,
  Users,
} from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { StatsStrip } from "@/components/stats-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { labelMatchStatus, matchStatusBadgeClassName } from "@/lib/match-status";

import type { PokerSession } from "@/types/session";
import type { GroupRankingRow } from "@/types/database";
import type { MatchSummaryRow } from "@/types/database";

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

/** Quantidade exibida no card «Últimas partidas» (alinhado à query Supabase). */
const RANKING_RECENT_MATCHES_LIMIT = 5;

export default function RankingPage() {
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [ranking, setRanking] = useState<GroupRankingRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchSummaryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("poker-session");

    if (!stored) {
      setLoading(false);
      setError("Sessão não encontrada.");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PokerSession;

      if (!parsed?.groupCode || parsed.groupCode !== groupCode) {
        setLoading(false);
        setError("Sessão inválida para este grupo.");
        return;
      }

      setSession(parsed);
    } catch {
      setLoading(false);
      setError("Não foi possível carregar a sessão.");
    }
  }, [groupCode]);

  useEffect(() => {
    async function loadRanking() {
      if (!session?.groupId) return;

      try {
        setLoading(true);
        setError(null);

        const [
          { data: rankingData, error: rankingError },
          { data: matchData, error: matchError },
          { data: playersPhotoData, error: playersPhotoError },
        ] = await Promise.all([
          supabase
            .from("v_group_ranking")
            .select("*")
            .eq("group_id", session.groupId)
            .order("total_profit", { ascending: false }),
          supabase
            .from("v_match_summary")
            .select("*")
            .eq("group_id", session.groupId)
            .order("played_at", { ascending: false })
            .limit(RANKING_RECENT_MATCHES_LIMIT),
          supabase
            .from("players")
            .select("id, photo_url")
            .eq("group_id", session.groupId),
        ]);

        if (rankingError) throw rankingError;
        if (matchError) throw matchError;
        if (playersPhotoError) throw playersPhotoError;

        const photoByPlayer = new Map(
          (playersPhotoData ?? []).map((p) => [p.id, p.photo_url as string | null])
        );
        setRanking(
          (rankingData ?? []).map((row) => ({
            ...(row as GroupRankingRow),
            photo_url: photoByPlayer.get((row as GroupRankingRow).player_id) ?? null,
          }))
        );
        setRecentMatches((matchData ?? []) as MatchSummaryRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar o ranking.");
      } finally {
        setLoading(false);
      }
    }

    loadRanking();
  }, [session]);

  const totalPlayers = ranking.length;
  const topPlayer = ranking[0] ?? null;
  const lastPlacePlayer =
    ranking.length > 1 ? ranking[ranking.length - 1] : null;

  const mostMatchesPlayer = useMemo(() => {
    if (ranking.length === 0) return null;
    return [...ranking].sort(
      (a, b) => b.matches_played - a.matches_played
    )[0];
  }, [ranking]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando ranking...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardContent className="p-8">
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StatsStrip
        items={[
          {
            title: "Jogadores",
            "aria-label": `Jogadores: ${totalPlayers}`,
            icon: Users,
            tone: "secondary",
            children: (
              <p className="font-heading text-xs font-bold tabular-nums leading-none text-foreground sm:text-base">
                {totalPlayers}
              </p>
            ),
          },
          {
            title: "Líder do ranking",
            "aria-label": topPlayer
              ? `Líder: ${topPlayer.player_name}, ${formatCurrency(topPlayer.total_profit)}`
              : "Sem líder",
            icon: Crown,
            tone: "highlight",
            children: topPlayer ? (
              <>
                <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                  <PlayerAvatar
                    name={topPlayer.player_name}
                    photoUrl={topPlayer.photo_url}
                    size="sm"
                    className="hidden ring-primary/25 sm:inline-flex"
                  />
                  <p className="min-w-0 max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xs sm:truncate">
                    {topPlayer.player_name}
                  </p>
                </div>
                <p className="text-[0.6rem] font-medium tabular-nums leading-none text-muted-foreground sm:text-[0.65rem]">
                  {formatCurrency(topPlayer.total_profit)}
                </p>
              </>
            ) : (
              <p className="font-heading text-xs font-bold text-muted-foreground">—</p>
            ),
          },
          {
            title: "Último no ranking",
            "aria-label": lastPlacePlayer
              ? `Último colocado: ${lastPlacePlayer.player_name}, ${formatCurrency(lastPlacePlayer.total_profit)}`
              : "Sem último colocado",
            icon: TrendingDown,
            tone: "danger",
            children: lastPlacePlayer ? (
              <>
                <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                  <PlayerAvatar
                    name={lastPlacePlayer.player_name}
                    photoUrl={lastPlacePlayer.photo_url}
                    size="sm"
                    className="hidden sm:inline-flex"
                  />
                  <p className="min-w-0 max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xs sm:truncate">
                    {lastPlacePlayer.player_name}
                  </p>
                </div>
                <p className="text-[0.6rem] font-medium tabular-nums leading-none text-muted-foreground sm:text-[0.65rem]">
                  {formatCurrency(lastPlacePlayer.total_profit)}
                </p>
              </>
            ) : (
              <p className="font-heading text-xs font-bold text-muted-foreground">—</p>
            ),
          },
          {
            title: "Mais partidas jogadas",
            "aria-label": mostMatchesPlayer
              ? `Mais partidas: ${mostMatchesPlayer.player_name}, ${mostMatchesPlayer.matches_played} partidas`
              : "Sem dados",
            icon: Swords,
            tone: "default",
            children: mostMatchesPlayer ? (
              <>
                <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                  <PlayerAvatar
                    name={mostMatchesPlayer.player_name}
                    photoUrl={mostMatchesPlayer.photo_url}
                    size="sm"
                    className="hidden sm:inline-flex"
                  />
                  <p className="min-w-0 max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xs sm:truncate">
                    {mostMatchesPlayer.player_name}
                  </p>
                </div>
                <p className="text-[0.6rem] font-medium tabular-nums leading-none text-muted-foreground sm:text-[0.65rem]">
                  {mostMatchesPlayer.matches_played}{" "}
                  {mostMatchesPlayer.matches_played === 1 ? "partida" : "partidas"}
                </p>
              </>
            ) : (
              <p className="font-heading text-xs font-bold text-muted-foreground">—</p>
            ),
          },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="font-heading text-2xl">Ranking</CardTitle>
            </div>

            <Button asChild className="rounded-full">
              <Link href={`/${groupCode}/partidas/nova`}>
                <Plus className="mr-2 size-4" />
                Nova partida
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {ranking.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Ainda não há dados suficientes para exibir o ranking.
              </div>
            ) : (
              <>
                {/* Mobile: cartões empilhados (evita colunas quebradas) */}
                <div className="space-y-3 md:hidden">
                  {ranking.map((player, index) => (
                    <div
                      key={`m-${player.player_id}`}
                      className="rounded-2xl border border-border/70 bg-background/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>
                        {index === 0 && (
                          <Crown className="size-4 shrink-0 text-secondary" />
                        )}
                        <PlayerAvatar
                          name={player.player_name}
                          photoUrl={player.photo_url}
                          size="md"
                        />
                        <p className="min-w-0 flex-1 font-medium">{player.player_name}</p>
                        {player.is_admin && (
                          <span className="rounded-full border border-secondary/30 bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                            Admin
                          </span>
                        )}
                      </div>

                      <p
                        className={cn(
                          "mt-3 font-heading text-lg font-bold tabular-nums",
                          Number(player.total_profit) > 0 && "text-secondary",
                          Number(player.total_profit) < 0 && "text-primary",
                          Number(player.total_profit) === 0 && "text-foreground"
                        )}
                      >
                        Saldo: {formatCurrency(player.total_profit)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Média: {formatCurrency(player.avg_profit)}</span>
                        <span>{player.matches_played} partidas</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabela */}
                <div className="hidden overflow-hidden rounded-3xl border border-border/70 md:block">
                  <div className="grid grid-cols-[minmax(4rem,5rem)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(5rem,6rem)] gap-x-3 border-b border-border/70 bg-background/30 px-4 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Pos.</span>
                    <span className="min-w-0">Jogador</span>
                    <span className="min-w-0">Saldo</span>
                    <span className="text-right">Partidas</span>
                  </div>

                  <div className="divide-y divide-border/70">
                    {ranking.map((player, index) => (
                      <div
                        key={player.player_id}
                        className="grid grid-cols-[minmax(4rem,5rem)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(5rem,6rem)] items-center gap-x-3 px-4 py-4 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-muted-foreground">
                            #{index + 1}
                          </span>
                          {index === 0 && (
                            <Crown className="size-4 shrink-0 text-secondary" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <PlayerAvatar
                              name={player.player_name}
                              photoUrl={player.photo_url}
                              size="sm"
                            />
                            <p className="truncate font-medium">{player.player_name}</p>
                            {player.is_admin && (
                              <span className="shrink-0 rounded-full border border-secondary/30 bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Média: {formatCurrency(player.avg_profit)}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "min-w-0 font-semibold tabular-nums",
                            Number(player.total_profit) > 0 && "text-secondary",
                            Number(player.total_profit) < 0 && "text-primary",
                            Number(player.total_profit) === 0 && "text-foreground"
                          )}
                        >
                          {formatCurrency(player.total_profit)}
                        </div>

                        <div className="text-right tabular-nums text-muted-foreground">
                          {player.matches_played}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="font-heading text-2xl">
                  Últimas partidas
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Até as {RANKING_RECENT_MATCHES_LIMIT} partidas mais recentes do grupo.
                </p>
              </div>

              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/${groupCode}/partidas`}>
                  Ver todas
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent>
              {recentMatches.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma partida registrada ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match) => (
                    <Link
                      key={match.match_id}
                      href={`/${groupCode}/partidas/${match.match_id}`}
                      className="block rounded-2xl border border-border/70 bg-background/30 p-4 transition hover:border-secondary/40 hover:bg-background/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {match.notes?.trim() || "Partida sem observação"}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Criada por</span>
                            <PlayerAvatar
                              name={match.created_by_player_name}
                              photoUrl={match.created_by_photo_url}
                              size="sm"
                            />
                            <span className="font-medium text-foreground/90">
                              {match.created_by_player_name}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.played_at)}
                          </p>
                        </div>

                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                            matchStatusBadgeClassName(match.status)
                          )}
                        >
                          {labelMatchStatus(match.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}