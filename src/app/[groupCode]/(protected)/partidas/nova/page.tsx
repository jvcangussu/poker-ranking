"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Loader2,
  NotebookPen,
  Wallet,
} from "lucide-react";

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
  const [hostPixKey, setHostPixKey] = useState("");
  const [maxBuyIn, setMaxBuyIn] = useState("");

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

  useEffect(() => {
    if (!session?.playerId || !session.groupId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("players")
        .select("pix_key")
        .eq("id", session.playerId)
        .eq("group_id", session.groupId)
        .maybeSingle();

      if (cancelled || error) return;

      const key = data?.pix_key?.trim();
      if (key) {
        setHostPixKey((prev) => (prev === "" ? key : prev));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.playerId, session?.groupId]);

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

    if (!hostPixKey.trim()) {
      setError("Informe o PIX do organizador (conta que receberá os buy-ins).");
      return;
    }

    const maxParsed = maxBuyIn.trim()
      ? Number(String(maxBuyIn).replace(",", "."))
      : null;

    try {
      setSubmitting(true);
      setError(null);

      const playedAtIso = new Date(playedAt).toISOString();

      const { data, error } = await supabase.rpc("create_match", {
        p_group_id: session.groupId,
        p_created_by_player_id: session.playerId,
        p_notes: notes.trim() || null,
        p_played_at: playedAtIso,
        p_host_pix_key: hostPixKey.trim(),
        p_max_buy_in:
          maxParsed != null && Number.isFinite(maxParsed) && maxParsed > 0
            ? maxParsed
            : null,
      });

      if (error) throw error;

      const createdMatch = (data?.[0] as CreateMatchRow | undefined) ?? null;

      if (!createdMatch?.match_id) {
        throw new Error("Não foi possível criar a partida.");
      }

      const { error: entryError } = await supabase.rpc("upsert_match_entry", {
        p_match_id: createdMatch.match_id,
        p_player_id: session.playerId,
        p_buy_in: 0,
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
              Você entra na partida com buy-in zero e registra as compras de fichas na
              tela da partida.
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
              </div>

              <div>
                <label
                  htmlFor="hostPixKey"
                  className="mb-2 block text-sm font-medium"
                >
                  PIX do organizador
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Conta que receberá os buy-ins. Se você salvou uma chave em
                  Configurações, ela aparece aqui — pode editar ou trocar antes de
                  criar.
                </p>
                <div className="relative">
                  <Wallet className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="hostPixKey"
                    type="text"
                    value={hostPixKey}
                    onChange={(e) => setHostPixKey(e.target.value)}
                    placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
                    autoComplete="off"
                    className="h-14 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="maxBuyIn"
                  className="mb-2 block text-sm font-medium"
                >
                  Buy-in máximo (por compra)
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Limite para cada compra de fichas na mesa. Deixe vazio para não
                  limitar.
                </p>
                <input
                  id="maxBuyIn"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxBuyIn}
                  onChange={(e) => setMaxBuyIn(e.target.value)}
                  placeholder="Ex.: 200 — vazio = sem limite"
                  className="h-14 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                />
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
                Na partida, use &quot;Buy-in&quot; para registrar cada compra de fichas
                quando o jogo começar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}