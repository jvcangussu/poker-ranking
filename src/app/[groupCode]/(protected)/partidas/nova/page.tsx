"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Loader2, NotebookPen } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { PokerSession } from "@/types/session";
import type { CreateMatchRow } from "@/types/database";

function getDefaultLocalDateTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function NovaPartidaPage() {
  const router = useRouter();
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);

  const [notes, setNotes] = useState("");
  const [playedAt, setPlayedAt] = useState(getDefaultLocalDateTime());
  const [creatorBuyIn, setCreatorBuyIn] = useState("");

  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("poker-session");

    if (!stored) {
      setLoadingSession(false);
      setError("Sessão não encontrada.");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PokerSession;

      if (!parsed?.groupCode || parsed.groupCode !== groupCode) {
        setLoadingSession(false);
        setError("Sessão inválida para este grupo.");
        return;
      }

      setSession(parsed);
    } catch {
      setError("Não foi possível carregar a sessão.");
    } finally {
      setLoadingSession(false);
    }
  }, [groupCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.groupId || !session.playerId) {
      setError("Sessão inválida.");
      return;
    }

    if (!playedAt) {
      setError("Informe a data e hora da partida.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const playedAtIso = new Date(playedAt).toISOString();

      const { data, error } = await supabase.rpc("create_match", {
        p_group_id: session.groupId,
        p_created_by_player_id: session.playerId,
        p_notes: notes.trim() || null,
        p_played_at: playedAtIso,
      });

      if (error) throw error;

      const createdMatch = (data?.[0] as CreateMatchRow | undefined) ?? null;

      if (!createdMatch?.match_id) {
        throw new Error("Não foi possível criar a partida.");
      }

      const buyInValue = Number(creatorBuyIn || 0);

      const { error: entryError } = await supabase.rpc("upsert_match_entry", {
        p_match_id: createdMatch.match_id,
        p_player_id: session.playerId,
        p_buy_in: buyInValue,
        p_cash_out: 0,
      });

      if (entryError) throw entryError;

      router.push(`/${groupCode}/partidas/${createdMatch.match_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar partida.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (error && !session) {
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
      <div>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href={`/${groupCode}/partidas`}>
            <ArrowLeft className="mr-2 size-4" />
            Voltar para partidas
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Nova partida</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie a partida agora e preencha os resultados na próxima etapa.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="playedAt"
                  className="mb-2 block text-sm font-medium"
                >
                  Data e hora
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="playedAt"
                    type="datetime-local"
                    value={playedAt}
                    onChange={(e) => setPlayedAt(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium"
                >
                  Observação
                </label>

                <div className="relative">
                  <NotebookPen className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex.: rodada de sexta, mesa principal, buy-in especial..."
                    rows={5}
                    className="min-h-[140px] w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 pt-3 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <div>
                  <label
                    htmlFor="creatorBuyIn"
                    className="mb-2 block text-sm font-medium"
                  >
                    Seu buy-in inicial
                  </label>
                  <input
                    id="creatorBuyIn"
                    type="number"
                    min="0"
                    step="0.01"
                    value={creatorBuyIn}
                    onChange={(e) => setCreatorBuyIn(e.target.value)}
                    placeholder="Ex.: 100"
                    className="h-14 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-14 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Criando partida...
                  </>
                ) : (
                  <>
                    Criar partida
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

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
                {session?.playerName ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
              <p className="text-sm text-muted-foreground">Próximo passo</p>
              <p className="mt-1 text-sm leading-6 text-foreground">
                Depois de criar, você será redirecionado para a tela de detalhe da
                partida, onde poderá preencher os participantes e os resultados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}