"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Crown,
  Loader2,
  Pencil,
  Shield,
  ShieldOff,
  Trash2,
  Users,
  Swords,
  Save,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { PokerSession } from "@/types/session";
import type { MatchSummaryRow, Player } from "@/types/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminPage() {
  const router = useRouter();
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchSummaryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editedPlayerName, setEditedPlayerName] = useState("");

  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [togglingAdminPlayerId, setTogglingAdminPlayerId] = useState<string | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

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

      if (!parsed.isAdmin) {
        setLoading(false);
        setPageError("Apenas administradores podem acessar esta página.");
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
      { data: playersData, error: playersError },
      { data: matchesData, error: matchesError },
    ] = await Promise.all([
      supabase
        .from("players")
        .select(
          "id, group_id, name, is_admin, photo_url, pix_key, created_at, updated_at"
        )
        .eq("group_id", currentSession.groupId)
        .order("name", { ascending: true }),
      supabase
        .from("v_match_summary")
        .select("*")
        .eq("group_id", currentSession.groupId)
        .order("played_at", { ascending: false }),
    ]);

    if (playersError) throw playersError;
    if (matchesError) throw matchesError;

    setPlayers((playersData ?? []) as Player[]);
    setMatches((matchesData ?? []) as MatchSummaryRow[]);
  }

  useEffect(() => {
    async function fetchPage() {
      if (!session?.groupId) return;

      try {
        setLoading(true);
        setPageError(null);
        await loadData(session);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Erro ao carregar dados administrativos."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPage();
  }, [session]);

  function startEditingPlayer(player: Player) {
    setEditingPlayerId(player.id);
    setEditedPlayerName(player.name);
    setFeedback(null);
  }

  function cancelEditingPlayer() {
    setEditingPlayerId(null);
    setEditedPlayerName("");
  }

  async function handleSavePlayerName(playerId: string) {
    const trimmedName = editedPlayerName.trim();

    if (!trimmedName) {
      setFeedback("Informe um nome válido para o jogador.");
      return;
    }

    try {
      setSavingPlayerId(playerId);
      setFeedback(null);

      const { error } = await supabase.rpc("admin_update_player_name", {
        p_player_id: playerId,
        p_name: trimmedName,
      });

      if (error) throw error;

      setPlayers((prev) =>
        prev.map((player) =>
          player.id === playerId ? { ...player, name: trimmedName } : player
        )
      );

      if (session?.playerId === playerId) {
        const stored = localStorage.getItem("poker-session");
        if (stored) {
          const parsed = JSON.parse(stored) as PokerSession;
          parsed.playerName = trimmedName;
          localStorage.setItem("poker-session", JSON.stringify(parsed));
          setSession(parsed);
        }
      }

      setEditingPlayerId(null);
      setEditedPlayerName("");
      setFeedback("Nome do jogador atualizado com sucesso.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao atualizar o nome do jogador."
      );
    } finally {
      setSavingPlayerId(null);
    }
  }

  async function handleToggleAdmin(player: Player) {
    try {
      setTogglingAdminPlayerId(player.id);
      setFeedback(null);

      const { error } = await supabase.rpc("admin_toggle_player_admin", {
        p_player_id: player.id,
        p_is_admin: !player.is_admin,
      });

      if (error) throw error;

      setPlayers((prev) =>
        prev.map((item) =>
          item.id === player.id ? { ...item, is_admin: !item.is_admin } : item
        )
      );

      setFeedback(
        player.is_admin
          ? "Permissão de administrador removida."
          : "Jogador promovido a administrador."
      );
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao alterar permissão do jogador."
      );
    } finally {
      setTogglingAdminPlayerId(null);
    }
  }

  async function handleDeletePlayer(player: Player) {
    const confirmed = window.confirm(
      `Tem certeza que deseja remover o jogador "${player.name}" do grupo?`
    );

    if (!confirmed) return;

    try {
      setDeletingPlayerId(player.id);
      setFeedback(null);

      const { error } = await supabase.rpc("admin_delete_player", {
        p_player_id: player.id,
      });

      if (error) throw error;

      setPlayers((prev) => prev.filter((item) => item.id !== player.id));
      setFeedback("Jogador removido do grupo com sucesso.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao remover jogador."
      );
    } finally {
      setDeletingPlayerId(null);
    }
  }

  async function handleDeleteMatch(matchId: string) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta partida? Esta ação não pode ser desfeita."
    );

    if (!confirmed) return;

    try {
      setDeletingMatchId(matchId);
      setFeedback(null);

      const { error } = await supabase.rpc("admin_delete_match", {
        p_match_id: matchId,
      });

      if (error) throw error;

      setMatches((prev) => prev.filter((match) => match.match_id !== matchId));
      setFeedback("Partida excluída com sucesso.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao excluir partida."
      );
    } finally {
      setDeletingMatchId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando painel administrativo...
        </div>
      </div>
    );
  }

  if (pageError) {
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
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Administração
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie jogadores e manutenção do grupo.
        </p>
      </div>

      {feedback && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/15 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jogadores</p>
              <p className="font-heading text-2xl font-semibold">{players.length}</p>
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
              <p className="font-heading text-2xl font-semibold">
                {players.filter((player) => player.is_admin).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <Swords className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partidas</p>
              <p className="font-heading text-2xl font-semibold">{matches.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary text-secondary-foreground">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Seu acesso</p>
              <p className="font-heading text-2xl font-semibold">Admin</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Jogadores do grupo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {players.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum jogador encontrado.
              </div>
            ) : (
              players.map((player) => {
                const isEditing = editingPlayerId === player.id;
                const isCurrentUser = session?.playerId === player.id;

                return (
                  <div
                    key={player.id}
                    className="rounded-3xl border border-border/70 bg-background/30 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedPlayerName}
                              onChange={(e) => setEditedPlayerName(e.target.value)}
                              className="h-11 w-full max-w-sm rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                            />
                          ) : (
                            <h3 className="font-heading truncate text-xl font-semibold">
                              {player.name}
                            </h3>
                          )}

                          {player.is_admin && (
                            <span className="rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
                              Admin
                            </span>
                          )}

                          {isCurrentUser && (
                            <span className="rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Você
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Pix
                            </p>
                            <p className="mt-1 truncate font-semibold">
                              {player.pix_key || "Não informado"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Perfil
                            </p>
                            <p className="mt-1 font-semibold">
                              {player.is_admin ? "Administrador" : "Jogador"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              onClick={() => handleSavePlayerName(player.id)}
                              disabled={savingPlayerId === player.id}
                              className="rounded-full"
                            >
                              {savingPlayerId === player.id ? (
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

                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEditingPlayer}
                              className="rounded-full"
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startEditingPlayer(player)}
                            className="rounded-full"
                          >
                            <Pencil className="mr-2 size-4" />
                            Editar nome
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleToggleAdmin(player)}
                          disabled={togglingAdminPlayerId === player.id}
                          className="rounded-full"
                        >
                          {togglingAdminPlayerId === player.id ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Atualizando...
                            </>
                          ) : player.is_admin ? (
                            <>
                              <ShieldOff className="mr-2 size-4" />
                              Remover admin
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 size-4" />
                              Tornar admin
                            </>
                          )}
                        </Button>

                        {!isCurrentUser && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeletePlayer(player)}
                            disabled={deletingPlayerId === player.id}
                            className="rounded-full"
                          >
                            {deletingPlayerId === player.id ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Removendo...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 size-4" />
                                Remover
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Partidas do grupo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {matches.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma partida registrada.
              </div>
            ) : (
              matches.map((match) => (
                <div
                  key={match.match_id}
                  className="rounded-3xl border border-border/70 bg-background/30 p-5"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-lg font-semibold">
                        {match.notes?.trim() || "Partida sem observação"}
                      </h3>

                      <span
                        className={
                          match.status === "open"
                            ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-foreground"
                            : "rounded-full border border-secondary/30 bg-secondary px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground"
                        }
                      >
                        {match.status === "open" ? "Aberta" : "Fechada"}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Criada por
                        </p>
                        <p className="mt-1 font-semibold">
                          {match.created_by_player_name}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Data
                        </p>
                        <p className="mt-1 font-semibold">
                          {formatDate(match.played_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push(`/${groupCode}/partidas/${match.match_id}`)}
                        className="rounded-full"
                      >
                        Ver partida
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteMatch(match.match_id)}
                        disabled={deletingMatchId === match.match_id}
                        className="rounded-full"
                      >
                        {deletingMatchId === match.match_id ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Excluindo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 size-4" />
                            Excluir partida
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}