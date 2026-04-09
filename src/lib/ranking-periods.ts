import type {
  GroupRankingRow,
  MatchEntryDetailedRow,
  MatchStatusDb,
} from "@/types/database";

export type RankingPeriodMode = "all" | "month" | "week";

export type RankingMonthOption = {
  value: string;
  label: string;
  start: Date;
  endExclusive: Date;
};

export type RankingMatchMeta = {
  matchId: string;
  createdAt: string;
  playedAt: string;
  status: MatchStatusDb;
};

type RankingAggregateInput = {
  entries: MatchEntryDetailedRow[];
  matches: RankingMatchMeta[];
  groupCode: string;
  groupName: string;
  mode: RankingPeriodMode;
  monthKey: string | null;
  now?: Date;
};

type AggregatedPlayer = GroupRankingRow;

const RANKING_INCLUDED_STATUSES = new Set<MatchStatusDb>(["in_payment", "closed"]);

function parseValidDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRankingWeekRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 7);

  const endInclusive = new Date(endExclusive.getTime() - 1);

  return {
    start,
    endExclusive,
    endInclusive,
  };
}

export function formatRankingWeekLabel(now = new Date()) {
  const { start, endInclusive } = getRankingWeekRange(now);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${formatter.format(start)} a ${formatter.format(endInclusive)}`;
}

export function getRecentRankingMonthOptions(
  matches: RankingMatchMeta[],
  limit = 6
): RankingMonthOption[] {
  const months = new Map<string, RankingMonthOption>();

  matches.forEach((match) => {
    if (!RANKING_INCLUDED_STATUSES.has(match.status)) return;

    const createdAt = parseValidDate(match.createdAt);
    if (!createdAt) return;

    const start = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    const endExclusive = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

    if (months.has(key)) return;

    months.set(key, {
      value: key,
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
      }).format(start),
      start,
      endExclusive,
    });
  });

  return [...months.values()]
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, limit);
}

function sortRankingRows<T extends Pick<GroupRankingRow, "player_id" | "player_name" | "total_profit">>(
  rows: T[]
) {
  rows.sort((a, b) => {
    const profitDiff = Number(b.total_profit) - Number(a.total_profit);
    if (profitDiff !== 0) return profitDiff;

    const nameDiff = a.player_name.localeCompare(b.player_name, "pt-BR", {
      sensitivity: "base",
    });
    if (nameDiff !== 0) return nameDiff;

    return a.player_id.localeCompare(b.player_id);
  });

  return rows;
}

function buildRange(
  mode: RankingPeriodMode,
  monthKey: string | null,
  now: Date
): { start: Date; endExclusive: Date } | null {
  if (mode === "all") return null;

  if (mode === "week") {
    const { start, endExclusive } = getRankingWeekRange(now);
    return { start, endExclusive };
  }

  if (!monthKey) return null;

  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return null;

  return {
    start: new Date(year, month - 1, 1),
    endExclusive: new Date(year, month, 1),
  };
}

function isMatchIncluded(
  match: RankingMatchMeta,
  range: { start: Date; endExclusive: Date } | null
) {
  if (!RANKING_INCLUDED_STATUSES.has(match.status)) return false;
  if (!range) return true;

  const createdAt = parseValidDate(match.createdAt);
  if (!createdAt) return false;

  return createdAt >= range.start && createdAt < range.endExclusive;
}

export function buildRankingForPeriod({
  entries,
  matches,
  groupCode,
  groupName,
  mode,
  monthKey,
  now = new Date(),
}: RankingAggregateInput): {
  ranking: GroupRankingRow[];
  lastClosedProfits: Map<string, number> | null;
  lastClosedMatchPlayedAt: string | null;
} {
  const range = buildRange(mode, monthKey, now);
  const includedMatchIds = new Set(
    matches.filter((match) => isMatchIncluded(match, range)).map((match) => match.matchId)
  );

  const playerMap = new Map<string, AggregatedPlayer>();

  entries.forEach((entry) => {
    if (!includedMatchIds.has(entry.match_id)) return;

    const profit = Number(entry.profit);
    const current = playerMap.get(entry.player_id);

    if (!current) {
      playerMap.set(entry.player_id, {
        group_id: entry.group_id,
        group_code: groupCode,
        group_name: groupName,
        player_id: entry.player_id,
        player_name: entry.player_name,
        is_admin: entry.is_admin,
        total_profit: profit,
        matches_played: 1,
        avg_profit: profit,
        best_result: profit,
        worst_result: profit,
        photo_url: entry.player_photo_url ?? null,
      });
      return;
    }

    current.total_profit += profit;
    current.matches_played += 1;
    current.best_result = Math.max(current.best_result, profit);
    current.worst_result = Math.min(current.worst_result, profit);
    current.avg_profit = current.total_profit / current.matches_played;
    current.photo_url = current.photo_url ?? entry.player_photo_url ?? null;
  });

  const ranking = sortRankingRows([...playerMap.values()]);

  const lastClosedMatch = matches
    .filter((match) => match.status === "closed" && isMatchIncluded(match, range))
    .sort((a, b) => {
      const bDate = parseValidDate(b.createdAt);
      const aDate = parseValidDate(a.createdAt);
      return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
    })[0];

  if (!lastClosedMatch) {
    return {
      ranking,
      lastClosedProfits: null,
      lastClosedMatchPlayedAt: null,
    };
  }

  const lastClosedProfits = new Map<string, number>();

  entries.forEach((entry) => {
    if (entry.match_id !== lastClosedMatch.matchId) return;
    lastClosedProfits.set(entry.player_id, Number(entry.profit));
  });

  return {
    ranking,
    lastClosedProfits,
    lastClosedMatchPlayedAt: lastClosedMatch.playedAt,
  };
}
