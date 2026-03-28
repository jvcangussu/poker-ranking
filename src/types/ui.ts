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
  photoUrl: string | null;
  isAdmin: boolean;
  pixKey: string | null;
  buyIn: string;
  cashOut: string;
  profit: number;
  buyInEvents: { id: string; amount: number; created_at: string }[];
  cashOutChipCounts: Record<ChipDenomination, number> | null;
  submittedForReview: boolean;
  submittedAt: string | null;
  adjustmentResubmitUnlocked: boolean;
  hostConfirmedPaidAt: string | null;
};

export type AddParticipantForm = {
  playerId: string;
  buyIn: string;
};