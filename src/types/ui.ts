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
  isAdmin: boolean;
  buyIn: string;
  cashOut: string;
  profit: number;
};

export type AddParticipantForm = {
  playerId: string;
  buyIn: string;
};