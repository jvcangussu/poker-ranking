import type { ChipDenomination } from "@/lib/chip-denominations";

export type EditableEntry = {
  playerId: string;
  playerName: string;
  isAdmin: boolean;
  buyIn: string;
  cashOut: string;
  profit: number;
  hasSavedEntry: boolean;
};

export type ParticipantEntry = {
  playerId: string;
  playerName: string;
  /** URL da foto em `players.photo_url`; ausente = placeholder na UI */
  photoUrl: string | null;
  isAdmin: boolean;
  pixKey: string | null;
  buyIn: string;
  cashOut: string;
  profit: number;
  buyInEvents: { id: string; amount: number; created_at: string }[];
  /** Combinação de fichas persistida no cash-out (null = só valor legado). */
  cashOutChipCounts: Record<ChipDenomination, number> | null;
  /** Enviou cash-out para análise (saiu da mesa para validação). */
  submittedForReview: boolean;
  submittedAt: string | null;
  /** Em ajuste: dono liberou reenvio só para este jogador. */
  adjustmentResubmitUnlocked: boolean;
  /** Em pagamento: dono marcou como pago. */
  hostConfirmedPaidAt: string | null;
};

export type AddParticipantForm = {
  playerId: string;
  buyIn: string;
};