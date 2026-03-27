"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  Plus,
  Swords,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { PokerSession } from "@/types/session";
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

export default function PartidasPage() {
  const params = useParams<{ groupCode: string }>();

  const rawGroupCode = Array.isArray(params?.groupCode)
    ? params.groupCode[0]
    : params?.groupCode;

  const groupCode = useMemo(() => (rawGroupCode ?? "").toLowerCase(), [rawGroupCode]);

  const [session, setSession] = useState<PokerSession | null>(null);
  const [matches, setMatches] = useState<MatchSummaryRow[]>([]);

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
    async function loadMatches() {
      if (!session?.groupId) return;

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("v_match_summary")
          .select("*")
          .eq("group_id", session.groupId)
          .order("played_at", { ascending: false });

        if (error) throw error;

        setMatches((data ?? []) as MatchSummaryRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar partidas.");
      } finally {
        setLoading(false);
      }
    }

    loadMatches();
  }, [session]);

  const totalMatches = matches.length;
  const openMatches = matches.filter((match) => match.status === "open").length;
  const closedMatches = matches.filter((match) => match.status === "closed").length;
  const totalEntries = matches.reduce(
    (acc, match) => acc + Number(match.total_entries ?? 0),
    0
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-5 py-3 text-sm text-muted-foreground backdrop-blur">
          <Loader2 className="size-4 animate-spin" />
          Carregando partidas...
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
              <Swords className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de partidas</p>
              <p className="font-heading text-2xl font-semibold">{totalMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary text-primary-foreground">
              <Clock3 className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partidas abertas</p>
              <p className="font-heading text-2xl font-semibold">{openMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partidas fechadas</p>
              <p className="font-heading text-2xl font-semibold">{closedMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/50 text-foreground">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participações</p>
              <p className="font-heading text-2xl font-semibold">{totalEntries}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-2xl">Partidas do grupo</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Histórico das sessões registradas no grupo.
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
          {matches.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhuma partida registrada ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <Link
                  key={match.match_id}
                  href={`/${groupCode}/partidas/${match.match_id}`}
                  className="block rounded-3xl border border-border/70 bg-background/30 p-5 transition hover:border-secondary/40 hover:bg-background/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading truncate text-xl font-semibold">
                          {match.notes?.trim() || "Partida sem observação"}
                        </h3>

                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
                            match.status === "open"
                              ? "border border-primary/30 bg-primary/10 text-foreground"
                              : "border border-secondary/30 bg-secondary text-secondary-foreground"
                          )}
                        >
                          {match.status === "open" ? "Aberta" : "Fechada"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Data
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatDate(match.played_at)}
                          </p>
                        </div>

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
                            Participantes
                          </p>
                          <p className="mt-1 font-semibold">{match.total_entries}</p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Buy-in total
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatCurrency(match.total_buy_in)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Cash-out total
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatCurrency(match.total_cash_out)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end text-sm font-medium text-muted-foreground lg:self-center">
                      Ver detalhes
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}