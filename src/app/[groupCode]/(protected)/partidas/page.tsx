"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  Scale,
  SlidersHorizontal,
  Swords,
} from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { StatsStrip } from "@/components/stats-strip";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  labelMatchStatus,
  matchStatusBadgeClassName,
  type MatchStatus,
} from "@/lib/match-status";

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

const MATCHES_PAGE_SIZE = 5;

type MatchListFilter = "all" | MatchStatus;

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
  const [matchDetailsOpen, setMatchDetailsOpen] = useState<Record<string, boolean>>(
    {}
  );
  const [matchesPage, setMatchesPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<MatchListFilter>("all");

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

        const [
          { data, error },
          { data: playersPhotoData, error: playersPhotoError },
        ] = await Promise.all([
          supabase
            .from("v_match_summary")
            .select("*")
            .eq("group_id", session.groupId)
            .order("played_at", { ascending: false }),
          supabase
            .from("players")
            .select("id, photo_url")
            .eq("group_id", session.groupId),
        ]);

        if (error) throw error;
        if (playersPhotoError) throw playersPhotoError;

        const photoByPlayer = new Map(
          (playersPhotoData ?? []).map((p) => [
            p.id,
            (p.photo_url as string | null)?.trim() || null,
          ])
        );

        setMatches(
          (data ?? []).map((row) => {
            const m = row as MatchSummaryRow;
            const merged =
              m.created_by_photo_url?.trim() ||
              photoByPlayer.get(m.created_by_player_id) ||
              null;
            return { ...m, created_by_photo_url: merged };
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar partidas.");
      } finally {
        setLoading(false);
      }
    }

    loadMatches();
  }, [session]);

  useEffect(() => {
    setMatchesPage(1);
  }, [statusFilter]);

  const filteredMatches = useMemo(() => {
    if (statusFilter === "all") return matches;
    return matches.filter((m) => m.status === statusFilter);
  }, [matches, statusFilter]);

  const totalMatches = matches.length;
  const filteredTotal = filteredMatches.length;
  const totalMatchesPages = Math.max(
    1,
    Math.ceil(filteredTotal / MATCHES_PAGE_SIZE)
  );
  const safeMatchesPage = Math.min(matchesPage, totalMatchesPages);

  const matchesPageSlice = useMemo(() => {
    const page = Math.min(matchesPage, totalMatchesPages);
    const start = (page - 1) * MATCHES_PAGE_SIZE;
    return filteredMatches.slice(start, start + MATCHES_PAGE_SIZE);
  }, [filteredMatches, matchesPage, totalMatchesPages]);

  useEffect(() => {
    if (matchesPage > totalMatchesPages) {
      setMatchesPage(totalMatchesPages);
    }
  }, [matchesPage, totalMatchesPages]);
  const openMatches = matches.filter((m) => m.status === "open").length;
  const inReviewMatches = matches.filter((m) => m.status === "in_review").length;
  const inAdjustmentMatches = matches.filter(
    (m) => m.status === "in_adjustment"
  ).length;
  const inPaymentMatches = matches.filter((m) => m.status === "in_payment").length;
  const closedMatches = matches.filter((m) => m.status === "closed").length;

  const stripValueClass =
    "font-heading text-xs font-bold tabular-nums leading-none text-foreground sm:text-sm lg:text-base";
  const stripLabelClass =
    "max-w-[5.25rem] truncate text-center text-[0.58rem] font-medium leading-tight text-muted-foreground sm:max-w-[6.5rem] sm:text-[0.62rem]";

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
      <StatsStrip
        items={[
          {
            title: "Total de partidas",
            "aria-label": `Mostrar todas as partidas. Total: ${totalMatches}`,
            icon: Swords,
            tone: "stripTotal",
            isActive: statusFilter === "all",
            onClick: () => setStatusFilter("all"),
            children: (
              <>
                <p className={stripValueClass}>{totalMatches}</p>
                <p className={stripLabelClass}>Total</p>
              </>
            ),
          },
          {
            title: "Abertas",
            "aria-label": `Filtrar partidas abertas: ${openMatches}`,
            icon: Clock3,
            tone: "stripOpen",
            isActive: statusFilter === "open",
            onClick: () => setStatusFilter("open"),
            children: (
              <>
                <p className={stripValueClass}>{openMatches}</p>
                <p className={stripLabelClass}>Abertas</p>
              </>
            ),
          },
          {
            title: "Em análise",
            "aria-label": `Filtrar partidas em análise: ${inReviewMatches}`,
            icon: Scale,
            tone: "stripReview",
            isActive: statusFilter === "in_review",
            onClick: () => setStatusFilter("in_review"),
            children: (
              <>
                <p className={stripValueClass}>{inReviewMatches}</p>
                <p className={stripLabelClass}>Em análise</p>
              </>
            ),
          },
          {
            title: "Em ajuste",
            "aria-label": `Filtrar partidas em ajuste: ${inAdjustmentMatches}`,
            icon: SlidersHorizontal,
            tone: "stripAdjustment",
            isActive: statusFilter === "in_adjustment",
            onClick: () => setStatusFilter("in_adjustment"),
            children: (
              <>
                <p className={stripValueClass}>{inAdjustmentMatches}</p>
                <p className={stripLabelClass}>Em ajuste</p>
              </>
            ),
          },
          {
            title: "Em pagamento",
            "aria-label": `Filtrar partidas em pagamento: ${inPaymentMatches}`,
            icon: Banknote,
            tone: "stripPayment",
            isActive: statusFilter === "in_payment",
            onClick: () => setStatusFilter("in_payment"),
            children: (
              <>
                <p className={stripValueClass}>{inPaymentMatches}</p>
                <p className={stripLabelClass}>Em pagamento</p>
              </>
            ),
          },
          {
            title: "Finalizadas",
            "aria-label": `Filtrar partidas finalizadas: ${closedMatches}`,
            icon: CheckCircle2,
            tone: "stripClosed",
            isActive: statusFilter === "closed",
            onClick: () => setStatusFilter("closed"),
            children: (
              <>
                <p className={stripValueClass}>{closedMatches}</p>
                <p className={stripLabelClass}>Finalizadas</p>
              </>
            ),
          },
        ]}
      />

      <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-2xl">Partidas</CardTitle>
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
          ) : filteredMatches.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-12 text-center text-sm text-muted-foreground">
              <p>Nenhuma partida com este status.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-full"
                onClick={() => setStatusFilter("all")}
              >
                Ver todas as partidas
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {matchesPageSlice.map((match) => {
                const open = matchDetailsOpen[match.match_id] ?? false;
                return (
                  <div
                    key={match.match_id}
                    className="rounded-3xl border border-border/70 bg-background/30 p-4 sm:p-5"
                  >
                    <div className="flex gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setMatchDetailsOpen((prev) => ({
                            ...prev,
                            [match.match_id]: !open,
                          }))
                        }
                        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/50 text-muted-foreground transition hover:bg-card/80 hover:text-foreground"
                        aria-expanded={open}
                        aria-label={
                          open ? "Ocultar detalhes da partida" : "Mostrar detalhes da partida"
                        }
                      >
                        <ChevronDown
                          className={cn(
                            "size-5 transition-transform duration-200",
                            open && "rotate-180"
                          )}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading min-w-0 flex-1 truncate text-lg font-semibold sm:text-xl">
                            {match.notes?.trim() || "Partida sem observação"}
                          </h3>

                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
                              matchStatusBadgeClassName(match.status)
                            )}
                          >
                            {labelMatchStatus(match.status)}
                          </span>
                        </div>

                        {open && (
                          <div className="mt-4 grid w-full min-w-0 grid-cols-2 gap-2 sm:gap-3">
                            <div className="min-w-0 rounded-2xl border border-border/70 bg-card/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Data
                              </p>
                              <p className="mt-1 break-words font-semibold leading-snug">
                                {formatDate(match.played_at)}
                              </p>
                            </div>

                            <div className="min-w-0 rounded-2xl border border-border/70 bg-card/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Criada por
                              </p>
                              <div className="mt-1 flex min-w-0 items-center gap-2">
                                <PlayerAvatar
                                  name={match.created_by_player_name}
                                  photoUrl={match.created_by_photo_url}
                                  size="sm"
                                />
                                <p className="min-w-0 truncate font-semibold">
                                  {match.created_by_player_name}
                                </p>
                              </div>
                            </div>

                            <div className="min-w-0 rounded-2xl border border-border/70 bg-card/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Participantes
                              </p>
                              <p className="mt-1 font-semibold">{match.total_entries}</p>
                            </div>

                            <div className="min-w-0 rounded-2xl border border-border/70 bg-card/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Buy-in total
                              </p>
                              <p className="mt-1 font-semibold">
                                {formatCurrency(match.total_buy_in)}
                              </p>
                            </div>

                            <div className="min-w-0 rounded-2xl border border-border/70 bg-card/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Cash-out total
                              </p>
                              <p className="mt-1 font-semibold">
                                {formatCurrency(match.total_cash_out)}
                              </p>
                            </div>
                          </div>
                        )}

                        <div
                          className={cn(
                            "flex justify-end",
                            open ? "mt-4 border-t border-border/50 pt-3" : "mt-3"
                          )}
                        >
                          <Link
                            href={`/${groupCode}/partidas/${match.match_id}`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                          >
                            Ver detalhes
                            <ArrowRight className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {matches.length > 0 && filteredMatches.length > MATCHES_PAGE_SIZE ? (
            <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm text-muted-foreground sm:text-left">
                Página {safeMatchesPage} de {totalMatchesPages}
                <span className="max-sm:block max-sm:mt-0.5 sm:ml-1">
                  (
                  {statusFilter === "all"
                    ? `${totalMatches} partidas no total`
                    : `${filteredTotal} ${filteredTotal === 1 ? "partida" : "partidas"} neste filtro`}
                  )
                </span>
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={safeMatchesPage <= 1}
                  onClick={() => setMatchesPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={safeMatchesPage >= totalMatchesPages}
                  onClick={() =>
                    setMatchesPage((p) => Math.min(totalMatchesPages, p + 1))
                  }
                  aria-label="Próxima página"
                >
                  Próxima
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}