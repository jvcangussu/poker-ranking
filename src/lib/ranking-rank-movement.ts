import type { GroupRankingRow } from "@/types/database";

export type RankMovementDisplay =
  | { kind: "delta"; delta: number }
  | { kind: "debut" }
  | { kind: "none" };

/**
 * Compara a posição atual com o ranking «acumulado antes da última partida encerrada»:
 * para cada jogador, subtrai o lucro dessa partida do saldo total e reordena.
 */
export function computeRankMovements(
  ranking: GroupRankingRow[],
  lastMatchProfitByPlayer: Map<string, number> | null
): Map<string, RankMovementDisplay> {
  const out = new Map<string, RankMovementDisplay>();

  if (!lastMatchProfitByPlayer || ranking.length === 0) {
    ranking.forEach((r) => out.set(r.player_id, { kind: "none" }));
    return out;
  }

  const prevRows = ranking.map((r) => {
    const pid = r.player_id;
    const lastProfit = lastMatchProfitByPlayer.get(pid) ?? 0;
    const prevProfit = Number(r.total_profit) - lastProfit;
    return {
      player_id: pid,
      prevProfit,
    };
  });

  prevRows.sort((a, b) => {
    if (b.prevProfit !== a.prevProfit) return b.prevProfit - a.prevProfit;
    return a.player_id.localeCompare(b.player_id);
  });

  const prevRankByPlayer = new Map<string, number>();
  prevRows.forEach((row, index) => {
    prevRankByPlayer.set(row.player_id, index + 1);
  });

  ranking.forEach((r, index) => {
    const currentRank = index + 1;
    const prevRank = prevRankByPlayer.get(r.player_id) ?? currentRank;

    if (r.matches_played === 1 && lastMatchProfitByPlayer.has(r.player_id)) {
      out.set(r.player_id, { kind: "debut" });
      return;
    }

    const delta = prevRank - currentRank;
    out.set(r.player_id, { kind: "delta", delta });
  });

  return out;
}
