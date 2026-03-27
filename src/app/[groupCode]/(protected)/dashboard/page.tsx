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
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

export default function DashboardPage() {
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
    async function loadDashboard() {
      if (!session?.groupId) return;

      try {
        setLoading(true);
        setError(null);

        const [{ data: rankingData, error: rankingError }, { data: matchData, error: matchError }] =
          await Promise.all([
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
              .limit(5),
          ]);

        if (rankingError) throw rankingError;
        if (matchError) throw matchError;

        setRanking((rankingData ?? []) as GroupRankingRow[]);
        setRecentMatches((matchData ?? []) as MatchSummaryRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [session]);

  const totalPlayers = ranking.length;
  const totalMatches = recentMatches.length;
  const topPlayer = ranking[0] ?? null;
  const bottomPlayer = ranking.length > 0 ? ranking[ranking.length - 1] : null;
  const openMatches = recentMatches.filter((match) => match.status === "open").length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando dashboard...
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jogadores</p>
              <p className="font-heading text-2xl font-semibold">{totalPlayers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <Swords className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partidas recentes</p>
              <p className="font-heading text-2xl font-semibold">{totalMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary text-primary-foreground">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Líder atual</p>
              <p className="font-heading text-lg font-semibold">
                {topPlayer ? topPlayer.player_name : "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                {topPlayer ? formatCurrency(topPlayer.total_profit) : "Sem dados"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partidas abertas</p>
              <p className="font-heading text-2xl font-semibold">{openMatches}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="font-heading text-2xl">Ranking geral</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Desempenho acumulado dos jogadores do grupo.
              </p>
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
              <div className="overflow-hidden rounded-3xl border border-border/70">
                <div className="grid grid-cols-[72px_1.2fr_1fr_120px] border-b border-border/70 bg-background/30 px-4 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Pos.</span>
                  <span>Jogador</span>
                  <span>Saldo</span>
                  <span className="text-right">Partidas</span>
                </div>

                <div className="divide-y divide-border/70">
                  {ranking.map((player, index) => (
                    <div
                      key={player.player_id}
                      className="grid grid-cols-[72px_1.2fr_1fr_120px] items-center px-4 py-4 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>
                        {index === 0 && (
                          <Crown className="size-4 text-secondary" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{player.player_name}</p>
                          {player.is_admin && (
                            <span className="rounded-full border border-secondary/30 bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Média: {formatCurrency(player.avg_profit)}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "font-semibold",
                          Number(player.total_profit) > 0 && "text-secondary",
                          Number(player.total_profit) < 0 && "text-primary",
                          Number(player.total_profit) === 0 && "text-foreground"
                        )}
                      >
                        {formatCurrency(player.total_profit)}
                      </div>

                      <div className="text-right text-muted-foreground">
                        {player.matches_played}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Resumo rápido</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Maior lucro</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {topPlayer ? topPlayer.player_name : "-"}
                </p>
                <p className="text-sm text-secondary">
                  {topPlayer ? formatCurrency(topPlayer.total_profit) : "Sem dados"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Maior prejuízo</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {bottomPlayer ? bottomPlayer.player_name : "-"}
                </p>
                <p className="text-sm text-primary">
                  {bottomPlayer ? formatCurrency(bottomPlayer.total_profit) : "Sem dados"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Jogador atual</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {session?.playerName ?? "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session?.isAdmin ? "Administrador do grupo" : "Membro do grupo"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="font-heading text-2xl">
                  Últimas partidas
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  As partidas mais recentes registradas.
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
                          <p className="mt-1 text-sm text-muted-foreground">
                            Criada por {match.created_by_player_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.played_at)}
                          </p>
                        </div>

                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                            match.status === "open"
                              ? "border border-primary/30 bg-primary/10 text-foreground"
                              : "border border-secondary/30 bg-secondary text-secondary-foreground"
                          )}
                        >
                          {match.status === "open" ? "Aberta" : "Fechada"}
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