"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Crown,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { PokerSession } from "@/types/session";

import type { GroupRankingRow } from "@/types/database";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

export default function JogadoresPage() {
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [players, setPlayers] = useState<GroupRankingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newPlayerName, setNewPlayerName] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  async function loadPlayers(groupId: string) {
    const { data, error } = await supabase
      .from("v_group_ranking")
      .select("*")
      .eq("group_id", groupId)
      .order("total_profit", { ascending: false });

    if (error) throw error;

    setPlayers((data ?? []) as GroupRankingRow[]);
  }

  useEffect(() => {
    async function fetchData() {
      if (!session?.groupId) return;

      try {
        setLoading(true);
        setError(null);
        await loadPlayers(session.groupId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar os jogadores."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  async function handleCreatePlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.groupId) return;

    const trimmedName = newPlayerName.trim();

    if (!trimmedName) {
      setCreateError("Informe o nome do jogador.");
      return;
    }

    try {
      setCreatingPlayer(true);
      setCreateError(null);

      const { error } = await supabase.rpc("add_player_to_group", {
        p_group_id: session.groupId,
        p_player_name: trimmedName,
        p_is_admin: false,
      });

      if (error) throw error;

      setNewPlayerName("");
      await loadPlayers(session.groupId);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Erro ao adicionar jogador."
      );
    } finally {
      setCreatingPlayer(false);
    }
  }

  const totalPlayers = players.length;
  const admins = players.filter((player) => player.is_admin).length;
  const profitablePlayers = players.filter((player) => Number(player.total_profit) > 0).length;
  const losingPlayers = players.filter((player) => Number(player.total_profit) < 0).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando jogadores...
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
              <p className="text-sm text-muted-foreground">Total de jogadores</p>
              <p className="font-heading text-2xl font-semibold">{totalPlayers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <Crown className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Administradores</p>
              <p className="font-heading text-2xl font-semibold">{admins}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Com lucro</p>
              <p className="font-heading text-2xl font-semibold">{profitablePlayers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary text-primary-foreground">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Com prejuízo</p>
              <p className="font-heading text-2xl font-semibold">{losingPlayers}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Jogadores do grupo
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Lista completa dos membros e desempenho acumulado.
            </p>
          </CardHeader>

          <CardContent>
            {players.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum jogador encontrado neste grupo.
              </div>
            ) : (
              <div className="space-y-4">
                {players.map((player, index) => (
                  <div
                    key={player.player_id}
                    className="rounded-3xl border border-border/70 bg-background/30 p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>

                        <h3 className="font-heading truncate text-xl font-semibold">
                          {player.player_name}
                        </h3>

                        {index === 0 && (
                          <span className="rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                            Líder
                          </span>
                        )}

                        {player.is_admin && (
                          <span className="rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                            Admin
                          </span>
                        )}

                        {session?.playerId === player.player_id && (
                          <span className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Você
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Saldo total
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-semibold",
                              Number(player.total_profit) > 0 && "text-secondary",
                              Number(player.total_profit) < 0 && "text-primary",
                              Number(player.total_profit) === 0 && "text-foreground"
                            )}
                          >
                            {formatCurrency(player.total_profit)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Partidas
                          </p>
                          <p className="mt-1 font-semibold">{player.matches_played}</p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Melhor resultado
                          </p>
                          <p className="mt-1 font-semibold text-secondary">
                            {formatCurrency(player.best_result)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Pior resultado
                          </p>
                          <p className="mt-1 font-semibold text-primary">
                            {formatCurrency(player.worst_result)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Média por partida
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-semibold",
                              Number(player.avg_profit) > 0 && "text-secondary",
                              Number(player.avg_profit) < 0 && "text-primary",
                              Number(player.avg_profit) === 0 && "text-foreground"
                            )}
                          >
                            {formatCurrency(player.avg_profit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {session?.isAdmin && (
            <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-2xl">
                  <UserPlus className="size-5" />
                  Adicionar jogador
                </CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleCreatePlayer} className="space-y-4">
                  <div>
                    <label
                      htmlFor="newPlayerName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Nome do jogador
                    </label>
                    <input
                      id="newPlayerName"
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Ex.: Pedro"
                      className="h-14 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  {createError && (
                    <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                      {createError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={creatingPlayer}
                    className="h-14 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
                  >
                    {creatingPlayer ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Adicionando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 size-4" />
                        Adicionar jogador
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
                Resumo do grupo
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Nome do grupo</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {session?.groupName ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Seu jogador</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {session?.playerName ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                <p className="text-sm text-muted-foreground">Seu perfil</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  {session?.isAdmin ? "Administrador" : "Membro"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}