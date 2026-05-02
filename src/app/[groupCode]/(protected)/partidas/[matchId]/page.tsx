"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Flag,
  FolderOpen,
  Gauge,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Scale,
  SendHorizontal,
  Share2,
  Shield,
  Swords,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { PlayerAvatar } from "@/components/player-avatar";
import { AddBuyInModal } from "@/components/add-buy-in-modal";
import { ChipCashoutModal } from "@/components/chip-cashout-modal";
import { MatchResultShareModal } from "@/components/match-result-share-modal";
import { MobileModal } from "@/components/mobile-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  chipCountsFromJson,
  chipCountsToJsonObject,
  type ChipDenomination,
} from "@/lib/chip-denominations";
import { computeHostAutoBalanceCashouts } from "@/lib/auto-balance-cashout-chips";
import { getSupabaseRpcErrorMessage } from "@/lib/supabase-error-message";
import { cn } from "@/lib/utils";
import {
  isMatchStatus,
  labelMatchStatus,
  matchAllowsPlayerFinancialEdit,
} from "@/lib/match-status";

import type { PokerSession } from "@/types/session";
import type {
  MatchSummaryRow,
  MatchEntryDetailedRow,
  MatchBuyInEventRow,
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

function entryCashOutValue(entry: ParticipantEntry): number {
  return toNumber(entry.cashOut);
}

function buildPlayerPixModalPayload(
  entry: ParticipantEntry,
  match: MatchSummaryRow
): {
  playerName: string;
  pixKey: string | null;
  description?: string;
} {
  const isCreator = entry.playerId === match.created_by_player_id;
  const host = match.host_pix_key?.trim() || null;
  const profile = entry.pixKey?.trim() || null;

  if (isCreator && host) {
    return {
      playerName: entry.playerName,
      pixKey: host,
      description:
        "PIX informado ao criar esta partida (conta para recebimento de buy-ins).",
    };
  }

  if (profile) {
    return {
      playerName: entry.playerName,
      pixKey: profile,
      description:
        "Chave cadastrada no perfil do jogador para esta partida.",
    };
  }

  return {
    playerName: entry.playerName,
    pixKey: null,
  };
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
  const [validatingMatch, setValidatingMatch] = useState(false);
  const [autoBalancing, setAutoBalancing] = useState(false);
  const [reopeningAll, setReopeningAll] = useState(false);
  const [unlockingPlayerId, setUnlockingPlayerId] = useState<string | null>(null);
  const [paidTogglingPlayerId, setPaidTogglingPlayerId] = useState<string | null>(null);
  const [finalizingMatch, setFinalizingMatch] = useState(false);

  const [hostPixInput, setHostPixInput] = useState("");
  const [savingHostPix, setSavingHostPix] = useState(false);

  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});

  const [joinPixKey, setJoinPixKey] = useState("");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joiningMatch, setJoiningMatch] = useState(false);
  const [resumoExpanded, setResumoExpanded] = useState(false);

  const [myPlayer, setMyPlayer] = useState<{
    name: string;
    photo_url: string | null;
    pix_key: string | null;
  } | null>(null);

  const [playerPixModal, setPlayerPixModal] = useState<{
    playerName: string;
    pixKey: string | null;
    description?: string;
  } | null>(null);

  const [shareEntry, setShareEntry] = useState<ParticipantEntry | null>(null);

  const [chipCashoutModal, setChipCashoutModal] = useState<{
    playerId: string;
    playerName: string;
    initialCashOut: number;
    initialChipCounts: Record<ChipDenomination, number> | null;
    readOnly?: boolean;
  } | null>(null);
  const [chipCashoutOpenKey, setChipCashoutOpenKey] = useState(0);

  const [addBuyInModal, setAddBuyInModal] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

  const [removeParticipantModal, setRemoveParticipantModal] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(
    null
  );

  const [creatorPhotoUrl, setCreatorPhotoUrl] = useState<string | null>(null);

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
      { data: meRow, error: meError },
      { data: buyInEventsData, error: buyInEventsError },
    ] = await Promise.all([
      supabase
        .from("v_match_summary")
        .select("*")
        .eq("match_id", matchId)
        .eq("group_id", currentSession.groupId)
        .maybeSingle(),
      supabase
        .from("players")
        .select("id, name, is_admin, photo_url")
        .eq("group_id", currentSession.groupId)
        .order("name", { ascending: true }),
      supabase
        .from("v_match_entries_detailed")
        .select("*")
        .eq("match_id", matchId)
        .order("player_name", { ascending: true }),
      supabase
        .from("players")
        .select("name, photo_url, pix_key")
        .eq("id", currentSession.playerId)
        .eq("group_id", currentSession.groupId)
        .maybeSingle(),
      supabase
        .from("match_buy_in_events")
        .select("id, player_id, amount, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
    ]);

    if (matchError) throw matchError;
    if (playersError) throw playersError;
    if (entriesError) throw entriesError;
    if (meError) throw meError;
    if (buyInEventsError) throw buyInEventsError;

    if (!matchData) {
      throw new Error("Partida não encontrada.");
    }

    const players = (playersData ?? []) as PlayerBasic[];
    const detailedEntries = (entriesData ?? []) as MatchEntryDetailedRow[];
    const rawEvents = (buyInEventsData ?? []) as MatchBuyInEventRow[];

    const photoByPlayerId = new Map<string, string | null>();
    for (const p of players) {
      const u = p.photo_url?.trim();
      photoByPlayerId.set(p.id, u ? u : null);
    }

    const eventsByPlayer = new Map<
      string,
      { id: string; amount: number; created_at: string }[]
    >();
    for (const ev of rawEvents) {
      const list = eventsByPlayer.get(ev.player_id) ?? [];
      list.push({
        id: ev.id,
        amount: Number(ev.amount),
        created_at: ev.created_at,
      });
      eventsByPlayer.set(ev.player_id, list);
    }

    const participantEntries: ParticipantEntry[] = detailedEntries.map((entry) => {
      const fromView = entry.player_photo_url?.trim();
      return {
      playerId: entry.player_id,
      playerName: entry.player_name,
      photoUrl: fromView ? fromView : photoByPlayerId.get(entry.player_id) ?? null,
      isAdmin: entry.is_admin,
      pixKey: entry.player_pix_key?.trim() ? entry.player_pix_key.trim() : null,
      buyIn: String(Number(entry.buy_in)),
      cashOut: String(Number(entry.cash_out)),
      profit: Number(entry.profit),
      buyInEvents: eventsByPlayer.get(entry.player_id) ?? [],
      cashOutChipCounts: chipCountsFromJson(entry.cash_out_chip_counts),
      submittedForReview: Boolean(entry.submitted_for_review_at),
      submittedAt: entry.submitted_for_review_at ?? null,
      adjustmentResubmitUnlocked: Boolean(entry.adjustment_resubmit_unlocked),
      hostConfirmedPaidAt: entry.host_confirmed_paid_at ?? null,
    };
    });

    setMyPlayer(
      meRow
        ? {
            name: meRow.name,
            photo_url: meRow.photo_url,
            pix_key: meRow.pix_key,
          }
        : null
    );

    const participantIds = new Set(detailedEntries.map((entry) => entry.player_id));
    const notInMatch = players.filter((player) => !participantIds.has(player.id));

    const md = matchData as MatchSummaryRow;
    const creatorFromView = md.created_by_photo_url?.trim();
    const creatorFromPlayers = photoByPlayerId.get(md.created_by_player_id) ?? null;
    setCreatorPhotoUrl(creatorFromView || creatorFromPlayers || null);

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

  useEffect(() => {
    if (!match) return;
    setHostPixInput(match.host_pix_key?.trim() ?? "");
  }, [match?.match_id, match?.host_pix_key]);

  async function applyChipCashOut(
    playerId: string,
    cashOutMoney: number,
    counts: Record<ChipDenomination, number>
  ) {
    if (!match || !session || playerId !== session.playerId) return;

    setPageError(null);

    const payload = chipCountsToJsonObject(counts);

    const { error } = await supabase.rpc("set_match_entry_cash_out_chips", {
      p_match_id: match.match_id,
      p_player_id: playerId,
      p_cash_out: cashOutMoney,
      p_chip_counts: payload,
    });

    if (error) throw new Error(error.message);

    await loadData(session);
  }

  async function submitEntryForReview(playerId: string) {
    if (!match || !session || playerId !== session.playerId) return;

    const entry = entries.find((item) => item.playerId === playerId);
    if (!entry) return;

    const cashOut = toNumber(entry.cashOut);

    if (cashOut < 0) {
      setRowErrors((prev) => ({
        ...prev,
        [playerId]: "O cash-out não pode ser negativo.",
      }));
      return;
    }

    try {
      setSavingMap((prev) => ({ ...prev, [playerId]: true }));
      setRowErrors((prev) => ({ ...prev, [playerId]: null }));

      const { error } = await supabase.rpc("submit_match_entry_for_review", {
        p_match_id: match.match_id,
        p_player_id: playerId,
        p_cash_out: cashOut,
      });

      if (error) throw error;

      if (session) {
        await loadData(session);
      }
    } catch (err) {
      let message = "Erro ao enviar resultado.";

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

  async function reopenEntryForEditing(playerId: string) {
    if (!match || !session || playerId !== session.playerId) return;

    try {
      setSavingMap((prev) => ({ ...prev, [playerId]: true }));
      setRowErrors((prev) => ({ ...prev, [playerId]: null }));

      const { error } = await supabase.rpc("reopen_match_entry_for_editing", {
        p_match_id: match.match_id,
        p_player_id: playerId,
      });

      if (error) throw error;

      if (session) {
        await loadData(session);
      }
    } catch (err) {
      let message = "Erro ao reabrir para edição.";

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

  async function copyPixLabel(value: string, token: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
    } catch {
      setPageError("Não foi possível copiar. Copie manualmente.");
    }
  }

  function openJoinModal() {
    if (!myPlayer) {
      setPageError("Não foi possível carregar seu perfil. Atualize a página.");
      return;
    }

    setJoinPixKey(myPlayer.pix_key?.trim() ?? "");
    setJoinModalOpen(true);
    setPageError(null);
  }

  async function handleJoinMatch() {
    if (!session || !match || !myPlayer) return;

    try {
      setJoiningMatch(true);
      setPageError(null);

      const trimmedPix = joinPixKey.trim();

      if (!trimmedPix) {
        setPageError("Informe sua chave Pix para entrar na partida.");
        return;
      }

      const { error: profileError } = await supabase.rpc("update_player_profile", {
        p_player_id: session.playerId,
        p_name: myPlayer.name.trim(),
        p_photo_url: myPlayer.photo_url?.trim() ?? "",
        p_pix_key: trimmedPix,
      });

      if (profileError) throw profileError;

      const { error } = await supabase.rpc("upsert_match_entry", {
        p_match_id: match.match_id,
        p_player_id: session.playerId,
        p_buy_in: 0,
        p_cash_out: 0,
      });

      if (error) throw error;

      setJoinPixKey("");
      setJoinModalOpen(false);
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

      const { error } = await supabase.rpc("upsert_match_entry", {
        p_match_id: match.match_id,
        p_player_id: selectedPlayerToAdd,
        p_buy_in: 0,
        p_cash_out: 0,
      });

      if (error) throw error;

      setSelectedPlayerToAdd("");
      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao adicionar jogador."
      );
    } finally {
      setAddingParticipant(false);
    }
  }

  async function handleConfirmAddBuyIn(amount: number) {
    if (!match || !session || !addBuyInModal) return;
    if (addBuyInModal.playerId !== session.playerId) return;

    const { error } = await supabase.rpc("add_match_buy_in", {
      p_match_id: match.match_id,
      p_player_id: addBuyInModal.playerId,
      p_amount: amount,
    });

    if (error) throw new Error(error.message);

    await loadData(session);
  }

  async function handleUpdateBuyInEvent(eventId: string, amount: number) {
    if (!session) return;

    const { error } = await supabase.rpc("update_match_buy_in_event", {
      p_event_id: eventId,
      p_amount: amount,
    });

    if (error) throw new Error(error.message);

    await loadData(session);
  }

  async function handleDeleteBuyInEvent(eventId: string) {
    if (!session) return;

    const { error } = await supabase.rpc("delete_match_buy_in_event", {
      p_event_id: eventId,
    });

    if (error) throw new Error(error.message);

    await loadData(session);
  }

  async function handleHostValidateTotals() {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setValidatingMatch(true);
      setPageError(null);

      const { data: freshSummary, error: freshErr } = await supabase
        .from("v_match_summary")
        .select("status")
        .eq("match_id", match.match_id)
        .eq("group_id", session.groupId)
        .maybeSingle();

      if (freshErr) throw freshErr;

      const liveStatus = freshSummary?.status;
      if (
        liveStatus !== "in_review" &&
        liveStatus !== "in_adjustment"
      ) {
        setPageError(
          `Não é possível validar agora: o estado da partida é «${labelMatchStatus(liveStatus)}». Só vale em «Em análise» ou «Em ajuste» (atualize a página se o fluxo mudou).`
        );
        await loadData(session);
        return;
      }

      const { error } = await supabase.rpc("host_validate_match_totals", {
        p_match_id: match.match_id,
        p_actor_player_id: session.playerId,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        getSupabaseRpcErrorMessage(err, "Erro ao validar os valores.")
      );
    } finally {
      setValidatingMatch(false);
    }
  }

  async function handleHostAutoBalanceCashouts() {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    const confirmMsg =
      "Reajustar automaticamente cash-out e fichas para fechar o total da mesa com os buy-ins?\n\n" +
      "• Se o cash-out total for maior que os buy-ins: desconto proporcional entre quem tem repasse (quem tem mais valor em fichas arca mais), em passos de 5 centavos.\n" +
      "• Se faltar cash-out: aumento distribuído priorizando quem tem menos fichas.\n" +
      "• Jogadores sem repasse (cash-out zero) ficam de fora.\n\n" +
      "As combinações de fichas serão recompostas com as denominações da mesa. Deseja continuar?";

    if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;

    try {
      setAutoBalancing(true);
      setPageError(null);

      const { data: freshSummary, error: freshErr } = await supabase
        .from("v_match_summary")
        .select("status")
        .eq("match_id", match.match_id)
        .eq("group_id", session.groupId)
        .maybeSingle();

      if (freshErr) throw freshErr;

      const liveStatus = freshSummary?.status;
      if (liveStatus !== "in_review" && liveStatus !== "in_adjustment") {
        setPageError(
          `Só é possível reajustar em «Em análise» ou «Em ajuste». Estado atual: «${labelMatchStatus(liveStatus)}».`
        );
        await loadData(session);
        return;
      }

      if (!entries.every((e) => e.submittedForReview)) {
        setPageError("Todos precisam ter enviado para análise antes do reajuste automático.");
        return;
      }

      const inputs = entries.map((e) => ({
        playerId: e.playerId,
        buyIn: toNumber(e.buyIn),
        cashOut: toNumber(e.cashOut),
        chipCounts: e.cashOutChipCounts,
      }));

      const plan = computeHostAutoBalanceCashouts(inputs);
      if (!plan) {
        setPageError("Buy-ins e cash-outs já fecham; não há o que reajustar.");
        await loadData(session);
        return;
      }

      const payload = plan.updates.map((u) => ({
        player_id: u.playerId,
        cash_out: u.cashOut,
        chip_counts: u.chipCountsJson,
      }));

      const { error } = await supabase.rpc("apply_host_auto_balance_cashouts", {
        p_match_id: match.match_id,
        p_actor_player_id: session.playerId,
        p_updates: payload,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        getSupabaseRpcErrorMessage(
          err,
          "Erro ao reajustar cash-outs automaticamente."
        )
      );
    } finally {
      setAutoBalancing(false);
    }
  }

  async function handleHostReopenAllAnalyses() {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setReopeningAll(true);
      setPageError(null);

      const { error } = await supabase.rpc("host_reopen_all_analyses", {
        p_match_id: match.match_id,
        p_actor_player_id: session.playerId,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao reabrir as análises."
      );
    } finally {
      setReopeningAll(false);
    }
  }

  async function handleHostUnlockPlayer(targetPlayerId: string) {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setUnlockingPlayerId(targetPlayerId);
      setPageError(null);

      const { error } = await supabase.rpc("host_unlock_player_resubmit", {
        p_match_id: match.match_id,
        p_target_player_id: targetPlayerId,
        p_actor_player_id: session.playerId,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao desbloquear o jogador."
      );
    } finally {
      setUnlockingPlayerId(null);
    }
  }

  async function handleHostSetPlayerPaid(targetPlayerId: string, paid: boolean) {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setPaidTogglingPlayerId(targetPlayerId);
      setPageError(null);

      const { error } = await supabase.rpc("host_set_player_paid", {
        p_match_id: match.match_id,
        p_target_player_id: targetPlayerId,
        p_actor_player_id: session.playerId,
        p_paid: paid,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao atualizar pagamento."
      );
    } finally {
      setPaidTogglingPlayerId(null);
    }
  }

  async function handleRemoveMatchParticipant(targetPlayerId: string) {
    if (!match || !session) return;

    try {
      setRemovingParticipantId(targetPlayerId);
      setPageError(null);

      const { error } = await supabase.rpc("remove_match_participant", {
        p_match_id: match.match_id,
        p_target_player_id: targetPlayerId,
        p_actor_player_id: session.playerId,
      });

      if (error) throw error;

      setRemoveParticipantModal(null);
      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao remover participante."
      );
    } finally {
      setRemovingParticipantId(null);
    }
  }

  async function handleFinalizeMatch() {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setFinalizingMatch(true);
      setPageError(null);

      const { error } = await supabase.rpc("finalize_match", {
        p_match_id: match.match_id,
        p_actor_player_id: session.playerId,
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Erro ao finalizar a partida."
      );
    } finally {
      setFinalizingMatch(false);
    }
  }

  async function handleSaveHostPix() {
    if (!match || !session) return;
    if (!session.isAdmin && session.playerId !== match.created_by_player_id) return;

    try {
      setSavingHostPix(true);
      setPageError(null);

      const { error } = await supabase.rpc("update_match_host_pix", {
        p_match_id: match.match_id,
        p_actor_player_id: session.playerId,
        p_host_pix_key: hostPixInput.trim(),
      });

      if (error) throw error;

      await loadData(session);
    } catch (err) {
      setPageError(
        getSupabaseRpcErrorMessage(err, "Erro ao salvar o PIX do organizador.")
      );
    } finally {
      setSavingHostPix(false);
    }
  }

  const currentUserIsParticipant = entries.some(
    (entry) => entry.playerId === session?.playerId
  );

  const canManageParticipants =
    !!session && !!match && (session.isAdmin || session.playerId === match.created_by_player_id);

  const matchStatus = useMemo(() => {
    if (!match?.status) return null;
    return isMatchStatus(match.status) ? match.status : null;
  }, [match?.status]);

  const canRemoveParticipants =
    canManageParticipants &&
    matchStatus !== null &&
    matchStatus !== "in_payment" &&
    matchStatus !== "closed";

  const canActAsMatchHost =
    !!session &&
    !!match &&
    (session.isAdmin || session.playerId === match.created_by_player_id);

  const showHostPixEditor =
    canActAsMatchHost && matchStatus !== null && matchStatus !== "closed";

  const entriesWithViewerFirst = useMemo(() => {
    const pid = session?.playerId;
    if (!pid || entries.length === 0) return entries;
    const idx = entries.findIndex((e) => e.playerId === pid);
    if (idx <= 0) return entries;
    const next = [...entries];
    const [self] = next.splice(idx, 1);
    return [self, ...next];
  }, [entries, session?.playerId]);

  const creatorDisplayPhoto = useMemo(() => {
    if (!match) return creatorPhotoUrl;
    const fromEntry = entries.find(
      (e) => e.playerId === match.created_by_player_id
    );
    return fromEntry?.photoUrl ?? creatorPhotoUrl;
  }, [match, entries, creatorPhotoUrl]);

  const allEntriesSubmitted =
    entries.length > 0 && entries.every((e) => e.submittedForReview);
  const allEntriesPaid =
    entries.length > 0 && entries.every((e) => e.hostConfirmedPaidAt);

  const totalBuyIn = entries.reduce((sum, entry) => sum + toNumber(entry.buyIn), 0);
  const totalCashOut = entries.reduce((sum, entry) => sum + toNumber(entry.cashOut), 0);
  const totalProfit = totalCashOut - totalBuyIn;
  const cashTotalsImbalanced = Math.abs(totalBuyIn - totalCashOut) > 0.02;

  const addBuyInEntry = useMemo(() => {
    if (!addBuyInModal) return null;
    return entries.find((e) => e.playerId === addBuyInModal.playerId) ?? null;
  }, [addBuyInModal, entries]);

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

      <Card className="rounded-2xl border-border/70 bg-card/60 py-1 shadow-lg shadow-black/5 sm:rounded-[1.75rem]">
        <CardContent className="grid grid-cols-2 gap-2 border-border/60 px-1 py-2 sm:px-2 sm:py-3 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-border/60">
          <div
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2"
            title="Status da partida"
            aria-label={`Status: ${labelMatchStatus(match?.status)}`}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-xl border sm:size-10",
                matchStatus === "in_adjustment"
                  ? "border-red-500/45 bg-red-500/15 text-red-400"
                  : "border-secondary/35 bg-secondary/15 text-secondary"
              )}
            >
              <Swords className="size-[1.1rem] sm:size-5" aria-hidden />
            </div>
            <p
              className={cn(
                "max-w-full truncate text-center font-heading text-[0.65rem] font-bold tabular-nums leading-tight sm:text-xs",
                matchStatus === "in_adjustment" ? "text-red-200" : "text-foreground"
              )}
            >
              {labelMatchStatus(match?.status)}
            </p>
          </div>

          <div
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2"
            title="Participantes"
            aria-label={`Participantes: ${entries.length}`}
          >
            <div className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground sm:size-10">
              <Users className="size-[1.1rem] sm:size-5" aria-hidden />
            </div>
            <p className="font-heading text-xs font-bold tabular-nums leading-none text-foreground sm:text-base">
              {entries.length}
            </p>
          </div>

          <div
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2"
            title="Buy-in total"
            aria-label={`Buy-in total: ${formatCurrency(totalBuyIn)}`}
          >
            <div className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground sm:size-10">
              <Banknote className="size-[1.1rem] sm:size-5" aria-hidden />
            </div>
            <p className="max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground sm:text-xs">
              {formatCurrency(totalBuyIn)}
            </p>
          </div>

          <div
            className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2"
            title="Cash-out total"
            aria-label={`Cash-out total: ${formatCurrency(totalCashOut)}`}
          >
            <div className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground sm:size-10">
              <Coins className="size-[1.1rem] sm:size-5" aria-hidden />
            </div>
            <p className="max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground sm:text-xs">
              {formatCurrency(totalCashOut)}
            </p>
          </div>

          <div
            className="col-span-2 flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 lg:col-span-1"
            title="Buy-in máximo por compra"
            aria-label={
              match?.max_buy_in != null && Number(match.max_buy_in) > 0
                ? `Buy-in máximo por compra: ${formatCurrency(Number(match.max_buy_in))}`
                : "Buy-in máximo: sem limite definido"
            }
          >
            <div className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground sm:size-10">
              <Gauge className="size-[1.1rem] sm:size-5" aria-hidden />
            </div>
            <p className="max-w-full text-center font-heading text-[0.58rem] font-medium leading-tight text-muted-foreground sm:text-[0.62rem]">
              Máx. / compra
            </p>
            <p className="max-w-full text-center font-heading text-[0.65rem] font-bold leading-tight text-foreground sm:text-xs">
              {match?.max_buy_in != null && Number(match.max_buy_in) > 0
                ? formatCurrency(Number(match.max_buy_in))
                : "Sem limite"}
            </p>
          </div>
        </CardContent>
      </Card>

      {matchStatus !== "closed" && (
        <>
          {match?.host_pix_key?.trim() ? (
            <>
              <div className="space-y-1.5 sm:hidden">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  PIX do organizador
                </p>
                <div
                  className="flex items-center gap-2 rounded-xl border border-secondary/30 bg-background/70 px-2.5 py-1.5 shadow-inner shadow-black/10"
                  title={`PIX do organizador: ${match.host_pix_key.trim()}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                    <Wallet className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] tabular-nums text-foreground">
                    {match.host_pix_key.trim()}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 shrink-0 gap-1 rounded-lg px-3 text-[11px] font-semibold"
                    onClick={() =>
                      copyPixLabel(match.host_pix_key!.trim(), "host-pix")
                    }
                  >
                    {copiedToken === "host-pix" ? (
                      <>
                        <Check className="size-3.5" />
                        <span className="max-w-[4rem] truncate">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                {showHostPixEditor && (
                  <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {session?.isAdmin &&
                      session.playerId !== match?.created_by_player_id
                        ? "Como admin do grupo, você pode corrigir o PIX exibido a todos."
                        : "Altere a chave de recebimento enquanto a partida estiver aberta."}
                    </p>
                    <div className="relative">
                      <Wallet className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="hostPixEditMobile"
                        type="text"
                        value={hostPixInput}
                        onChange={(e) => setHostPixInput(e.target.value)}
                        placeholder="E-mail, telefone, CPF/CNPJ..."
                        autoComplete="off"
                        className="h-11 w-full rounded-xl border border-input bg-background/70 pl-10 pr-3 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 w-full rounded-full text-xs font-semibold"
                      onClick={() => void handleSaveHostPix()}
                      disabled={savingHostPix}
                    >
                      {savingHostPix ? (
                        <>
                          <Loader2 className="mr-2 size-3.5 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 size-3.5" />
                          Salvar PIX
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <Card className="hidden overflow-hidden rounded-2xl border border-secondary/30 bg-gradient-to-b from-secondary/[0.12] to-card/95 shadow-xl shadow-black/15 ring-1 ring-secondary/20 sm:block sm:rounded-[2rem]">
                <CardHeader className="space-y-0.5 pb-2 pt-3 sm:space-y-1 sm:pb-3 sm:pt-5">
                  <CardTitle className="font-heading flex items-center gap-2 text-base sm:gap-2.5 sm:text-lg md:text-xl">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary/25 text-secondary ring-1 ring-secondary/40 sm:size-10 sm:rounded-2xl">
                      <Wallet className="size-4 sm:size-5" strokeWidth={2} />
                    </span>
                    <span>PIX do organizador</span>
                  </CardTitle>
                  <p className="pl-10 text-[0.65rem] leading-snug text-muted-foreground sm:pl-[3.25rem] sm:text-xs md:text-sm">
                    Chave para buy-ins — visível para todos.
                  </p>
                </CardHeader>
                <CardContent className="pb-3 sm:pb-6">
                  <div className="relative rounded-xl border border-secondary/25 bg-background/50 p-0.5 shadow-inner shadow-black/20 sm:rounded-2xl sm:p-1.5">
                    <div className="flex flex-row items-stretch gap-1.5 sm:gap-2">
                      <div className="min-w-0 flex-1 rounded-lg bg-background/80 px-2.5 py-2 ring-1 ring-border/60 sm:rounded-xl sm:px-4 sm:py-3 md:py-4 md:pl-5 md:pr-4">
                        <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:mb-1 sm:text-[10px] md:text-xs">
                          Copia e cola
                        </p>
                        <p className="break-all font-mono text-xs font-medium leading-snug tracking-wide text-foreground sm:text-base md:text-lg">
                          {match.host_pix_key.trim()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-auto min-w-[7.5rem] shrink-0 flex-row items-center justify-center gap-1 rounded-xl px-5 py-4 text-sm font-semibold shadow-md shadow-secondary/10"
                        onClick={() =>
                          copyPixLabel(match.host_pix_key!.trim(), "host-pix")
                        }
                      >
                        {copiedToken === "host-pix" ? (
                          <>
                            <Check className="mr-2 size-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 size-4" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {showHostPixEditor && (
                    <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {session?.isAdmin &&
                        session.playerId !== match?.created_by_player_id
                          ? "Como admin do grupo, você pode definir ou corrigir o PIX exibido a todos nesta partida."
                          : "Você pode alterar a chave de recebimento dos buy-ins enquanto a partida não estiver encerrada."}
                      </p>
                      <div className="relative">
                        <Wallet className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="hostPixEditDesktop"
                          type="text"
                          value={hostPixInput}
                          onChange={(e) => setHostPixInput(e.target.value)}
                          placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
                          autoComplete="off"
                          className="h-12 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30 sm:h-14 sm:text-base"
                        />
                      </div>
                      <Button
                        type="button"
                        className="rounded-full font-semibold"
                        onClick={() => void handleSaveHostPix()}
                        disabled={savingHostPix}
                      >
                        {savingHostPix ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <KeyRound className="mr-2 size-4" />
                            Salvar PIX do organizador
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="overflow-hidden rounded-2xl border border-secondary/30 bg-gradient-to-b from-secondary/[0.12] to-card/95 shadow-xl shadow-black/15 ring-1 ring-secondary/20 sm:rounded-[2rem]">
              <CardContent className="space-y-4 px-4 py-6 sm:px-6">
                <p className="text-center text-sm text-muted-foreground">
                  O organizador não cadastrou um PIX nesta partida (partidas antigas ou
                  rascunho).
                </p>
                {showHostPixEditor && (
                  <div className="space-y-3 border-t border-border/50 pt-4">
                    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {session?.isAdmin &&
                      session.playerId !== match?.created_by_player_id
                        ? "Como admin, cadastre a chave PIX que os jogadores devem usar nesta partida."
                        : "Cadastre a chave PIX de recebimento dos buy-ins."}
                    </p>
                    <div className="relative">
                      <Wallet className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="hostPixEditEmpty"
                        type="text"
                        value={hostPixInput}
                        onChange={(e) => setHostPixInput(e.target.value)}
                        placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
                        autoComplete="off"
                        className="h-12 w-full rounded-2xl border border-input bg-background/70 pl-11 pr-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30 sm:h-14 sm:text-base"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full rounded-full font-semibold sm:w-auto"
                      onClick={() => void handleSaveHostPix()}
                      disabled={savingHostPix}
                    >
                      {savingHostPix ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 size-4" />
                          Salvar PIX
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {matchStatus === "closed" && (
        <Card className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 py-1 shadow-lg shadow-black/10 sm:rounded-[1.75rem]">
          <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
            <p className="font-heading text-base font-semibold text-emerald-100 sm:text-lg">
              Partida encerrada
            </p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-200/80">
              Pagamentos confirmados. Abaixo está o resumo final, use{" "}
              <span className="font-medium text-emerald-100">Ver cash-out em fichas</span>{" "}
              para ver a combinação registrada por jogador.
            </p>
          </CardContent>
        </Card>
      )}

      {pageError && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          {pageError}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="font-heading text-xl sm:text-2xl">
                {matchStatus === "closed" ? "Resultados finais" : "Participantes"}
              </CardTitle>
              {matchStatus === "closed" && (
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Saldo final de cada jogador nesta partida. O resultado alimenta o ranking
                  do grupo.
                </p>
              )}
            </div>

            {canActAsMatchHost && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:justify-end">
                {(matchStatus === "in_review" ||
                  matchStatus === "in_adjustment") &&
                  allEntriesSubmitted && (
                    <Button
                      type="button"
                      onClick={() => void handleHostValidateTotals()}
                      disabled={validatingMatch || autoBalancing}
                      className="h-10 w-full shrink-0 rounded-full text-sm sm:h-9 sm:w-auto"
                    >
                      {validatingMatch ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        <>
                          <Scale className="mr-2 size-4 shrink-0" aria-hidden />
                          <span className="sm:hidden">Validar</span>
                          <span className="hidden sm:inline">Validar valores</span>
                        </>
                      )}
                    </Button>
                  )}

                {(matchStatus === "in_review" ||
                  matchStatus === "in_adjustment") &&
                  allEntriesSubmitted &&
                  cashTotalsImbalanced && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleHostAutoBalanceCashouts()}
                      disabled={autoBalancing || validatingMatch}
                      className="h-10 w-full shrink-0 rounded-full text-sm sm:h-9 sm:w-auto"
                    >
                      {autoBalancing ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Reajustando...
                        </>
                      ) : (
                        <>
                          <ArrowDownUp className="mr-2 size-4 shrink-0" aria-hidden />
                          <span className="sm:hidden">Auto fichas</span>
                          <span className="hidden sm:inline">Reajustar fichas (auto)</span>
                        </>
                      )}
                    </Button>
                  )}

                {matchStatus === "in_adjustment" && (
                  <Button
                    type="button"
                    onClick={() => void handleHostReopenAllAnalyses()}
                    disabled={reopeningAll}
                    variant="outline"
                    className="h-10 w-full shrink-0 rounded-full text-sm sm:h-9 sm:w-auto"
                  >
                    {reopeningAll ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Reabrindo...
                      </>
                    ) : (
                      <>
                        <FolderOpen className="mr-2 size-4 shrink-0" aria-hidden />
                        <span className="sm:hidden">Reabrir todos</span>
                        <span className="hidden sm:inline">Reabrir análise para todos</span>
                      </>
                    )}
                  </Button>
                )}

                {matchStatus === "in_payment" && allEntriesPaid && (
                  <Button
                    type="button"
                    onClick={() => void handleFinalizeMatch()}
                    disabled={finalizingMatch}
                    className="h-10 w-full shrink-0 rounded-full text-sm sm:h-9 sm:w-auto"
                  >
                    {finalizingMatch ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <Flag className="mr-2 size-4 shrink-0" aria-hidden />
                        Finalizar partida
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum participante entrou nesta partida ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {entriesWithViewerFirst.map((entry) => {
                  const isOwnRow = session?.playerId === entry.playerId;
                  const canFinancial =
                    !!matchStatus &&
                    matchAllowsPlayerFinancialEdit(
                      matchStatus,
                      entry.adjustmentResubmitUnlocked
                    );
                  const canEditOwn =
                    isOwnRow && canFinancial && !entry.submittedForReview;
                  const ownSubmittedOpen =
                    isOwnRow && canFinancial && entry.submittedForReview;
                  const cashOutVal = entryCashOutValue(entry);

                  return (
                    <div
                      key={entry.playerId}
                      className={cn(
                        "rounded-2xl border border-border/70 bg-background/30 p-4 sm:rounded-3xl sm:p-4",
                        matchStatus === "closed"
                          ? "border-emerald-500/25 bg-emerald-950/15 ring-1 ring-emerald-500/10"
                          : matchStatus === "in_payment"
                            ? entry.hostConfirmedPaidAt
                              ? "border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20"
                              : cashOutVal > 0
                                ? "border-sky-500/40 bg-sky-500/[0.07] ring-1 ring-sky-500/25"
                                : "border-border/70 bg-background/30"
                            : matchStatus === "in_adjustment"
                              ? "border-red-500/45 bg-red-950/35 ring-1 ring-red-500/30"
                              : entry.submittedForReview &&
                                  "border-amber-500/40 bg-amber-500/[0.07] ring-1 ring-amber-500/20"
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:gap-3">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2">
                          <PlayerAvatar
                            name={entry.playerName}
                            photoUrl={entry.photoUrl}
                            size="md"
                            className="row-start-1"
                          />

                          <h3 className="font-heading col-start-2 row-start-1 min-w-0 break-words text-base font-semibold leading-snug sm:text-lg md:text-xl">
                            {entry.playerName}
                          </h3>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="col-start-3 row-start-1 size-8 shrink-0 rounded-full sm:size-9"
                            onClick={() => {
                              if (!match) return;
                              setPlayerPixModal(
                                buildPlayerPixModalPayload(entry, match)
                              );
                            }}
                            aria-label={`Pix de ${entry.playerName}`}
                          >
                            <Info className="size-3.5 sm:size-4" />
                          </Button>

                          <div className="col-span-2 col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                          {entry.isAdmin && (
                            <span className="rounded-full border border-secondary/30 bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground sm:text-xs">
                              Admin
                            </span>
                          )}

                          {isOwnRow && (
                            <span className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">
                              Você
                            </span>
                          )}

                          {matchStatus === "closed" ? (
                            <span
                              className="rounded-full border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-100 sm:text-xs"
                              title="Partida finalizada, os valores abaixo são o fechamento oficial."
                            >
                              Encerrado
                            </span>
                          ) : matchStatus === "in_payment" ? (
                            entry.hostConfirmedPaidAt ? (
                              <span
                                className="rounded-full border border-emerald-500/55 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-100 sm:text-xs"
                                title="Organizador confirmou o pagamento deste jogador."
                              >
                                Pago
                              </span>
                            ) : cashOutVal > 0 ? (
                              <span
                                className="rounded-full border border-sky-500/50 bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-sky-100 sm:text-xs"
                                title="Aguardando o organizador pagar o valor de cash-out ao jogador."
                              >
                                Aguardando pagamento
                              </span>
                            ) : (
                              <span
                                className="rounded-full border border-zinc-500/45 bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-300 sm:text-xs"
                                title="Cash-out zero ou negativo: não há valor a pagar pelo organizador."
                              >
                                Sem repasse
                              </span>
                            )
                          ) : matchStatus === "in_adjustment" ? (
                            <span
                              className="rounded-full border border-red-500/55 bg-red-500/20 px-2 py-0.5 text-[10px] font-medium uppercase text-red-100 sm:text-xs"
                              title="Valores não fecharam; corrija buy-in/cash-out ou aguarde desbloqueio do organizador."
                            >
                              Em ajuste
                            </span>
                          ) : (
                            entry.submittedForReview && (
                              <span
                                className="rounded-full border border-amber-500/45 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-100 sm:text-xs"
                                title="Este jogador enviou buy-in e cash-out para validação."
                              >
                                Enviado para análise
                              </span>
                            )
                          )}

                          {!isOwnRow && matchStatus !== "closed" && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs"
                              title="Você não edita os dados deste jogador"
                            >
                              <Lock className="size-2.5 shrink-0 sm:size-3" />
                              <span className="hidden sm:inline">Leitura</span>
                            </span>
                          )}
                        </div>
                        </div>

                        {canRemoveParticipants && (
                          <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 min-h-8 rounded-full border-rose-500/35 px-3 text-[11px] font-medium text-rose-200 hover:bg-rose-500/10 hover:text-rose-100 sm:text-xs"
                              onClick={() =>
                                setRemoveParticipantModal({
                                  playerId: entry.playerId,
                                  playerName: entry.playerName,
                                })
                              }
                              aria-label={`Remover ${entry.playerName} da partida`}
                            >
                              <UserMinus className="mr-1 size-3.5 shrink-0" aria-hidden />
                              Remover da partida
                            </Button>
                          </div>
                        )}

                        {canActAsMatchHost &&
                          (matchStatus === "in_adjustment" ||
                            matchStatus === "in_payment") && (
                            <div className="flex flex-wrap items-center gap-2 max-sm:border-t max-sm:border-border/40 max-sm:pt-2">
                              {matchStatus === "in_adjustment" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 min-h-8 rounded-full px-3 text-[11px] font-medium sm:h-8 sm:text-xs"
                                  disabled={
                                    unlockingPlayerId === entry.playerId ||
                                    entry.adjustmentResubmitUnlocked
                                  }
                                  onClick={() =>
                                    void handleHostUnlockPlayer(entry.playerId)
                                  }
                                  title="Permitir que este jogador reabra e reenvie a análise"
                                >
                                  {unlockingPlayerId === entry.playerId ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : entry.adjustmentResubmitUnlocked ? (
                                    <>
                                      <LockOpen
                                        className="mr-1 size-3 shrink-0"
                                        aria-hidden
                                      />
                                      <span className="sm:hidden">Liberado</span>
                                      <span className="hidden sm:inline">
                                        Reenvio liberado
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <KeyRound
                                        className="mr-1 size-3 shrink-0"
                                        aria-hidden
                                      />
                                      Desbloquear
                                    </>
                                  )}
                                </Button>
                              )}

                              {matchStatus === "in_payment" && cashOutVal > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className={cn(
                                    "h-8 min-h-8 rounded-full px-3 text-[11px] font-semibold sm:text-xs",
                                    entry.hostConfirmedPaidAt
                                      ? "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90 hover:text-white"
                                      : "border border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-950/40 hover:bg-emerald-500 hover:text-white"
                                  )}
                                  disabled={paidTogglingPlayerId === entry.playerId}
                                  onClick={() =>
                                    void handleHostSetPlayerPaid(
                                      entry.playerId,
                                      !entry.hostConfirmedPaidAt
                                    )
                                  }
                                  title={
                                    entry.hostConfirmedPaidAt
                                      ? "Clique para desmarcar se o pagamento foi registrado por engano."
                                      : "Marcar que o jogador já recebeu o valor do cash-out."
                                  }
                                >
                                  {paidTogglingPlayerId === entry.playerId ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : entry.hostConfirmedPaidAt ? (
                                    <>
                                      <BadgeCheck
                                        className="mr-1 size-3 shrink-0"
                                        aria-hidden
                                      />
                                      Pago
                                    </>
                                  ) : (
                                    <>
                                      <Banknote
                                        className="mr-1 size-3 shrink-0"
                                        aria-hidden
                                      />
                                      Marcar pago
                                    </>
                                  )}
                                </Button>
                              )}

                              {matchStatus === "in_payment" && cashOutVal <= 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 min-h-8 rounded-full border-dashed px-3 text-[11px] font-medium text-muted-foreground sm:text-xs"
                                  disabled={paidTogglingPlayerId === entry.playerId}
                                  onClick={() =>
                                    void handleHostSetPlayerPaid(
                                      entry.playerId,
                                      !entry.hostConfirmedPaidAt
                                    )
                                  }
                                  title="Sem valor a pagar, confirme para liberar a finalização da partida."
                                >
                                  {paidTogglingPlayerId === entry.playerId ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : entry.hostConfirmedPaidAt ? (
                                    "Confirmado"
                                  ) : (
                                    <>
                                      <span className="sm:hidden">Sem repasse</span>
                                      <span className="hidden sm:inline">
                                        Confirmar sem repasse
                                      </span>
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}

                        {matchStatus === "in_payment" ? (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 to-background/80 px-4 py-3 sm:px-5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                                Valor a receber (cash-out)
                              </p>
                              <p className="mt-1 font-heading text-2xl font-bold tabular-nums tracking-tight text-emerald-50 sm:text-3xl">
                                {formatCurrency(cashOutVal)}
                              </p>
                              <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/75">
                                É o valor que o organizador deve pagar ao jogador. O resultado
                                abaixo é o saldo da sessão e entra no ranking do grupo.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-6">
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Buy-in
                                </p>
                                <p className="mt-0.5 font-heading text-base font-bold tabular-nums sm:text-lg">
                                  {formatCurrency(toNumber(entry.buyIn))}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Resultado
                                </p>
                                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/90">
                                  Saldo · ranking
                                </p>
                                <p
                                  className={cn(
                                    "mt-0.5 font-heading text-base font-bold tabular-nums sm:text-lg",
                                    entry.profit > 0 && "text-secondary",
                                    entry.profit < 0 && "text-primary",
                                    entry.profit === 0 && "text-muted-foreground"
                                  )}
                                >
                                  {formatCurrency(entry.profit)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Buy-in
                              </p>
                              <p className="mt-0.5 font-heading text-base font-bold tabular-nums sm:text-lg">
                                {formatCurrency(toNumber(entry.buyIn))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Cash-out
                              </p>
                              <p className="mt-0.5 font-heading text-base font-bold tabular-nums text-foreground sm:text-lg">
                                {formatCurrency(cashOutVal)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Resultado
                              </p>
                              {matchStatus === "closed" && (
                                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/90">
                                  Saldo · ranking
                                </p>
                              )}
                              <p
                                className={cn(
                                  "mt-0.5 font-heading text-base font-bold tabular-nums sm:text-lg",
                                  entry.profit > 0 && "text-secondary",
                                  entry.profit < 0 && "text-primary",
                                  entry.profit === 0 && "text-muted-foreground"
                                )}
                              >
                                {formatCurrency(entry.profit)}
                              </p>
                            </div>
                          </div>
                        )}

                        {matchStatus === "closed" && (
                          <div className="flex w-full flex-col gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full flex-1 gap-2 rounded-full border-emerald-500/40 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-950/55 hover:text-emerald-50 min-[400px]:w-auto"
                              onClick={() => {
                                setChipCashoutOpenKey((k) => k + 1);
                                setChipCashoutModal({
                                  playerId: entry.playerId,
                                  playerName: entry.playerName,
                                  initialCashOut: cashOutVal,
                                  initialChipCounts: entry.cashOutChipCounts,
                                  readOnly: true,
                                });
                              }}
                            >
                              <Coins className="size-3.5 shrink-0" aria-hidden />
                              Ver cash-out em fichas
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full flex-1 gap-2 rounded-full font-semibold shadow-md shadow-black/20 min-[400px]:w-auto"
                              onClick={() => setShareEntry(entry)}
                            >
                              <Share2 className="size-3.5 shrink-0" aria-hidden />
                              Compartilhar
                            </Button>
                          </div>
                        )}

                        {entry.buyInEvents.length > 0 && (
                          <details className="rounded-xl border border-border/50 bg-background/20 px-3 py-2 text-xs text-muted-foreground">
                            <summary className="cursor-pointer list-none font-medium text-foreground/80 [&::-webkit-details-marker]:hidden">
                              {entry.buyInEvents.length === 1
                                ? "Compra de fichas"
                                : `Histórico de compras (${entry.buyInEvents.length})`}
                            </summary>
                            <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                              {entry.buyInEvents.map((ev) => (
                                <li
                                  key={ev.id}
                                  className="flex justify-between gap-2 text-[11px]"
                                >
                                  <span>{formatDate(ev.created_at)}</span>
                                  <span className="font-medium text-foreground">
                                    +{formatCurrency(ev.amount)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {canEditOwn && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-10 flex-1 gap-1 rounded-full px-3 text-xs font-semibold min-[400px]:flex-none sm:h-11 sm:text-sm"
                              onClick={() =>
                                setAddBuyInModal({
                                  playerId: entry.playerId,
                                  playerName: entry.playerName,
                                })
                              }
                            >
                              <Plus className="size-3.5" />
                              Buy-in
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-10 flex-1 gap-1 rounded-full px-3 text-xs font-semibold min-[400px]:flex-none sm:h-11 sm:text-sm"
                              onClick={() => {
                                setChipCashoutOpenKey((k) => k + 1);
                                setChipCashoutModal({
                                  playerId: entry.playerId,
                                  playerName: entry.playerName,
                                  initialCashOut: toNumber(entry.cashOut),
                                  initialChipCounts: entry.cashOutChipCounts,
                                });
                              }}
                            >
                              <Coins className="size-3.5" />
                              Fichas
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void submitEntryForReview(entry.playerId)}
                              disabled={!!savingMap[entry.playerId]}
                              size="sm"
                              className="h-10 flex-1 gap-1 rounded-full px-4 text-xs font-semibold min-[400px]:min-w-[7rem] sm:h-11 sm:text-sm"
                            >
                              {savingMap[entry.playerId] ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <SendHorizontal className="size-3.5" />
                                  Enviar Resultado
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {ownSubmittedOpen && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-10 flex-1 gap-1 rounded-full px-4 text-xs font-semibold sm:h-11 sm:text-sm"
                              onClick={() => void reopenEntryForEditing(entry.playerId)}
                              disabled={!!savingMap[entry.playerId]}
                            >
                              {savingMap[entry.playerId] ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Reabrindo...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="size-3.5" />
                                  Reabrir para editar
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {rowErrors[entry.playerId] && (
                          <p className="text-xs text-primary">{rowErrors[entry.playerId]}</p>
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
          {(match?.status === "open" || match?.status === "in_review") &&
            session &&
            !currentUserIsParticipant && (
            <Card className="rounded-[2rem] border-border/70 bg-card/60 shadow-xl shadow-black/10">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-2xl">
                  <Users className="size-5" />
                  Entrar na partida
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Você informará sua chave Pix; os buy-ins são registrados na lista de
                  participantes.
                </p>
              </CardHeader>

              <CardContent>
                <Button
                  type="button"
                  onClick={openJoinModal}
                  className="h-12 w-full rounded-full"
                >
                  Abrir formulário para entrar
                </Button>
              </CardContent>
            </Card>
          )}

          {(match?.status === "open" || match?.status === "in_review") &&
            canManageParticipants &&
            availablePlayers.length > 0 && (
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

                  <p className="text-xs text-muted-foreground">
                    O jogador entra com buy-in zero; use Buy-in na lista para registrar
                    compras de fichas.
                  </p>

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
            <CardHeader className="pb-2">
              <button
                type="button"
                onClick={() => setResumoExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={resumoExpanded}
                aria-controls="match-resumo-panel"
                id="match-resumo-toggle"
              >
                <CardTitle className="font-heading text-2xl">Resumo</CardTitle>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/50 text-muted-foreground">
                  <ChevronDown
                    className={cn(
                      "size-5 transition-transform duration-200",
                      resumoExpanded && "rotate-180"
                    )}
                    aria-hidden
                  />
                </span>
              </button>
            </CardHeader>

            {resumoExpanded && (
              <CardContent
                id="match-resumo-panel"
                role="region"
                aria-labelledby="match-resumo-toggle"
                className="space-y-4 pt-0"
              >
                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <p className="text-sm text-muted-foreground">Grupo</p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    {session?.groupName ?? "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <p className="text-sm text-muted-foreground">Criada por</p>
                  <div className="mt-2 flex min-w-0 items-center gap-3">
                    <PlayerAvatar
                      name={match?.created_by_player_name ?? "?"}
                      photoUrl={creatorDisplayPhoto}
                      size="md"
                    />
                    <p className="min-w-0 flex-1 font-heading text-xl font-semibold leading-snug">
                      {match?.created_by_player_name ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    {match?.played_at ? formatDate(match.played_at) : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                  <p className="text-sm text-muted-foreground">Buy-in máx. (por compra)</p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    {match?.max_buy_in != null && Number(match.max_buy_in) > 0
                      ? formatCurrency(Number(match.max_buy_in))
                      : "Sem limite"}
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
            )}
          </Card>
        </div>
      </section>

      <MobileModal
        open={joinModalOpen}
        onClose={() => {
          if (!joiningMatch) setJoinModalOpen(false);
        }}
        title="Entrar na partida"
        description="Você entra com buy-in zero e registra as compras na partida (Buy-in). A chave Pix vem do perfil — pode alterar agora; é salva ao confirmar."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="join-pix">
              Sua chave Pix
            </label>
            <input
              id="join-pix"
              type="text"
              value={joinPixKey}
              onChange={(e) => setJoinPixKey(e.target.value)}
              placeholder="E-mail, telefone, CPF ou chave aleatória"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full"
              disabled={joiningMatch}
              onClick={() => setJoinModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full"
              disabled={joiningMatch || !myPlayer}
              onClick={() => void handleJoinMatch()}
            >
              {joiningMatch ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Confirmar e entrar"
              )}
            </Button>
          </div>
        </div>
      </MobileModal>

      <MobileModal
        open={!!playerPixModal}
        onClose={() => setPlayerPixModal(null)}
        title={
          playerPixModal ? `Pix — ${playerPixModal.playerName}` : "Pix do jogador"
        }
        description={playerPixModal?.description}
      >
        {playerPixModal?.pixKey ? (
          <div className="space-y-4">
            <p className="break-all rounded-2xl border border-border/70 bg-background/40 px-4 py-3 font-mono text-sm leading-relaxed">
              {playerPixModal.pixKey}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-full sm:w-auto"
              onClick={() =>
                copyPixLabel(
                  playerPixModal.pixKey!,
                  `player-${playerPixModal.playerName}`
                )
              }
            >
              {copiedToken === `player-${playerPixModal.playerName}` ? (
                <>
                  <Check className="mr-2 size-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" />
                  Copiar chave
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este jogador ainda não informou uma chave Pix no perfil ou ao entrar na
            partida.
          </p>
        )}
      </MobileModal>

      <MobileModal
        open={removeParticipantModal !== null}
        onClose={() => {
          if (!removingParticipantId) setRemoveParticipantModal(null);
        }}
        title="Remover jogador da partida?"
        description={
          removeParticipantModal
            ? `${removeParticipantModal.playerName} sai desta partida e os buy-ins / resultados dessa pessoa nesta rodada são apagados. Disponível para o dono da partida ou um administrador.`
            : undefined
        }
      >
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            disabled={removingParticipantId !== null}
            onClick={() => setRemoveParticipantModal(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full border border-rose-600/50 bg-rose-600 text-white hover:bg-rose-600/90"
            disabled={removingParticipantId !== null || !removeParticipantModal}
            onClick={() => {
              if (!removeParticipantModal) return;
              void handleRemoveMatchParticipant(removeParticipantModal.playerId);
            }}
          >
            {removingParticipantId ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Removendo...
              </>
            ) : (
              <>
                <UserMinus className="mr-2 size-4" />
                Remover
              </>
            )}
          </Button>
        </div>
      </MobileModal>

      <ChipCashoutModal
        key={
          chipCashoutModal
            ? `chip-cashout-${chipCashoutModal.playerId}-${chipCashoutOpenKey}`
            : "chip-cashout-idle"
        }
        open={!!chipCashoutModal}
        playerName={chipCashoutModal?.playerName ?? ""}
        initialCashOutMoney={chipCashoutModal?.initialCashOut ?? 0}
        initialChipCounts={chipCashoutModal?.initialChipCounts ?? null}
        readOnly={chipCashoutModal?.readOnly ?? false}
        onClose={() => setChipCashoutModal(null)}
        onApply={async (money, counts) => {
          if (!chipCashoutModal || chipCashoutModal.readOnly) return;
          try {
            await applyChipCashOut(chipCashoutModal.playerId, money, counts);
          } catch (err) {
            setPageError(
              err instanceof Error ? err.message : "Erro ao salvar cash-out em fichas."
            );
            throw err;
          }
        }}
      />

      <AddBuyInModal
        open={!!addBuyInModal}
        playerName={addBuyInModal?.playerName ?? ""}
        maxBuyIn={match?.max_buy_in != null ? Number(match.max_buy_in) : null}
        events={addBuyInEntry?.buyInEvents ?? []}
        onClose={() => setAddBuyInModal(null)}
        onAdd={handleConfirmAddBuyIn}
        onUpdateEvent={handleUpdateBuyInEvent}
        onDeleteEvent={handleDeleteBuyInEvent}
      />

      {shareEntry && match && (
        <MatchResultShareModal
          open
          onClose={() => setShareEntry(null)}
          highlightPlayerId={shareEntry.playerId}
          rankedEntries={[...entries].sort((a, b) => b.profit - a.profit)}
          match={match}
        />
      )}
    </div>
  );
}