"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, LockKeyhole, Users } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import type { Group, PlayerBasic, VerifyGroupAccessRow } from "@/types/database";

export default function GroupAccessPage() {
  const router = useRouter();
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [group, setGroup] = useState<Group | null>(null);
  const [players, setPlayers] = useState<PlayerBasic[]>([]);
  const [selectedPlayerName, setSelectedPlayerName] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGroupData() {
      if (!groupCode || groupCode.length !== 6) {
        setPageError("Código de grupo inválido.");
        setInitialLoading(false);
        return;
      }

      try {
        setPageError(null);
        setInitialLoading(true);

        const { data: groupRpcData, error: groupError } = await supabase.rpc(
          "get_group_public_by_code",
          {
            p_group_code: groupCode,
          }
        );

        if (groupError) {
          console.error("Erro ao buscar grupo:", groupError);
          setPageError(`Erro ao buscar grupo: ${groupError.message}`);
          setInitialLoading(false);
          return;
        }

        const groupData = groupRpcData?.[0] ?? null;

        if (!groupData) {
          setPageError("Grupo não encontrado.");
          setInitialLoading(false);
          return;
        }

        setGroup(groupData);

        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("id, name, is_admin")
          .eq("group_id", groupData.id)
          .order("name", { ascending: true });

        if (playersError) {
          throw playersError;
        }

        const normalizedPlayers = playersData ?? [];
        setPlayers(normalizedPlayers);

        if (normalizedPlayers.length > 0) {
          setSelectedPlayerName(normalizedPlayers[0].name);
        }
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados do grupo."
        );
      } finally {
        setInitialLoading(false);
      }
    }

    loadGroupData();
  }, [groupCode]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.name === selectedPlayerName),
    [players, selectedPlayerName]
  );
  const needsAdminPassword = selectedPlayer?.is_admin === true;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!group) {
      setSubmitError("Grupo não carregado.");
      return;
    }

    if (!selectedPlayerName) {
      setSubmitError("Selecione um jogador.");
      return;
    }

    if (!groupPassword.trim()) {
      setSubmitError("Informe a senha do grupo.");
      return;
    }

    if (needsAdminPassword && !adminPassword.trim()) {
      setSubmitError("Informe também a senha de administrador.");
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase.rpc("verify_group_access", {
        p_group_code: group.code,
        p_player_name: selectedPlayerName,
        p_group_password: groupPassword,
        p_admin_password: needsAdminPassword ? adminPassword : "",
      });

      if (error) {
        throw error;
      }

      const result = (data?.[0] as VerifyGroupAccessRow | undefined) ?? null;

      if (!result) {
        setSubmitError("Não foi possível validar o acesso.");
        return;
      }

      if (!result.access_granted) {
        setSubmitError(
          needsAdminPassword
            ? "Senha do grupo ou senha de administrador incorreta."
            : "Senha incorreta para este grupo."
        );
        return;
      }

      localStorage.setItem(
        "poker-session",
        JSON.stringify({
          groupId: result.group_id,
          groupCode: result.group_code,
          groupName: result.group_name,
          playerId: result.player_id,
          playerName: result.player_name,
          isAdmin: result.is_admin,
        })
      );

      router.push(`/${result.group_code}/ranking`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Erro ao validar o acesso."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,149,0,0.10),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

      <section className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl flex-col px-6 py-8 md:px-10">
        <div className="mb-8">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/entrar">
              <ArrowLeft className="mr-2 size-4" />
              Voltar
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 text-sm text-muted-foreground">
                <Users className="size-4 text-secondary" />
                Acesso ao grupo
              </div>

              {initialLoading ? (
                <div className="space-y-4">
                  <div className="h-6 w-40 animate-pulse rounded-full bg-card/70" />
                  <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-card/70" />
                  <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-card/50" />
                </div>
              ) : pageError ? (
                <div className="space-y-4">
                  <h1 className="font-heading text-4xl font-semibold tracking-tight">
                    Não foi possível acessar este grupo.
                  </h1>
                  <p className="max-w-xl text-muted-foreground">{pageError}</p>
                </div>
              ) : (
                <>
                  <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                    {group?.name}
                  </h1>

                  <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
                    Escolha seu nome na lista. Todos usam a senha do grupo;
                    administradores informam também a senha de administrador.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-card/50 px-4 py-2">
                      Código: <span className="font-medium text-foreground">{group?.code}</span>
                    </span>
                    <span className="rounded-full border border-border/70 bg-card/50 px-4 py-2">
                      Jogadores:{" "}
                      <span className="font-medium text-foreground">{players.length}</span>
                    </span>
                  </div>
                </>
              )}
            </div>

            <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10 backdrop-blur">
              <CardHeader className="space-y-2 pb-2">
                <CardTitle className="font-heading text-2xl">
                  Entrar no grupo
                </CardTitle>
                <CardDescription>
                  Use o nome que já foi cadastrado pelo administrador.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                {initialLoading ? (
                  <div className="flex h-56 items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Carregando grupo...
                  </div>
                ) : pageError ? (
                  <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
                    {pageError}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label
                        htmlFor="player"
                        className="mb-2 block text-sm font-medium"
                      >
                        Jogador
                      </label>

                      <div className="relative">
                        <select
                          id="player"
                          value={selectedPlayerName}
                          onChange={(e) => {
                            setSelectedPlayerName(e.target.value);
                            setAdminPassword("");
                          }}
                          className="h-14 w-full appearance-none rounded-2xl border border-input bg-background/70 px-4 pr-11 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                        >
                          {players.length === 0 ? (
                            <option value="">Nenhum jogador disponível</option>
                          ) : (
                            players.map((player) => (
                              <option key={player.id} value={player.name}>
                                {player.name}
                                {player.is_admin ? " (admin)" : ""}
                              </option>
                            ))
                          )}
                        </select>

                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-sm font-medium"
                      >
                        Senha do grupo
                      </label>

                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="password"
                          type="password"
                          value={groupPassword}
                          onChange={(e) => setGroupPassword(e.target.value)}
                          placeholder="Senha do grupo"
                          autoComplete="current-password"
                          className="h-14 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                        />
                      </div>
                    </div>

                    {needsAdminPassword && (
                      <div>
                        <label
                          htmlFor="adminPassword"
                          className="mb-2 block text-sm font-medium"
                        >
                          Senha de administrador
                        </label>

                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            id="adminPassword"
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Senha extra para perfil de administrador"
                            autoComplete="new-password"
                            className="h-14 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                          />
                        </div>
                      </div>
                    )}

                    {submitError && (
                      <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                        {submitError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      disabled={submitting || players.length === 0}
                      className="h-14 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        "Entrar no grupo"
                      )}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                      O seu nome precisa ter sido cadastrado anteriormente pelo
                      administrador do grupo.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}