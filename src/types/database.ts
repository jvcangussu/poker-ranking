export type Group = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at?: string;
};

export type Player = {
  id: string;
  group_id: string;
  name: string;
  is_admin: boolean;
  photo_url?: string | null;
  pix_key?: string | null;
  created_at: string;
  updated_at?: string;
};

export type PlayerBasic = Pick<Player, "id" | "name" | "is_admin" | "photo_url" | "pix_key">;

export type Match = {
  id: string;
  group_id: string;
  created_by_player_id: string;
  status: "open" | "closed";
  notes: string | null;
  played_at: string;
  created_at: string;
  updated_at?: string;
};

export type MatchEntry = {
  id: string;
  match_id: string;
  player_id: string;
  buy_in: number;
  cash_out: number;
  profit: number;
  created_at: string;
  updated_at?: string;
};

export type GroupRankingRow = {
  group_id: string;
  group_code: string;
  group_name: string;
  player_id: string;
  player_name: string;
  is_admin: boolean;
  total_profit: number;
  matches_played: number;
  avg_profit: number;
  best_result: number;
  worst_result: number;
};

export type MatchSummaryRow = {
  match_id: string;
  group_id: string;
  group_code: string;
  group_name: string;
  created_by_player_id: string;
  created_by_player_name: string;
  status: "open" | "closed";
  notes: string | null;
  played_at: string;
  total_entries: number;
  total_buy_in: number;
  total_cash_out: number;
  total_profit_balance: number;
};

export type MatchEntryDetailedRow = {
  entry_id: string;
  match_id: string;
  group_id: string;
  group_code: string;
  player_id: string;
  player_name: string;
  is_admin: boolean;
  buy_in: number;
  cash_out: number;
  profit: number;
  match_status: "open" | "closed";
  played_at: string;
  notes: string | null;
};

export type VerifyGroupAccessRow = {
  group_id: string;
  group_code: string;
  group_name: string;
  player_id: string;
  player_name: string;
  is_admin: boolean;
  access_granted: boolean;
};

export type CreateGroupWithAdminRow = {
  group_id: string;
  group_code: string;
  group_name: string;
  admin_player_id: string;
  admin_player_name: string;
};

export type CreateMatchRow = {
  match_id: string;
  group_id: string;
  created_by_player_id: string;
  status: string;
  notes: string | null;
  played_at: string;
};