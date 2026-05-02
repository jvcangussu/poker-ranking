import {
  CHIP_DENOMINATIONS,
  type ChipDenomination,
  chipCountsToMoney,
  chipCountsToJsonObject,
  emptyChipCounts,
  moneyToChipCounts,
} from "@/lib/chip-denominations";

const MONEY_EPS = 0.02;
const CENTS_TOLERANCE = 2;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function toCents(m: number): number {
  return Math.round(Number(m) * 100);
}

function roundDiffToStep5Cents(cents: number): number {
  if (cents === 0) return 0;
  const sign = cents > 0 ? 1 : -1;
  const a = Math.abs(cents);
  const r = Math.round(a / 5) * 5;
  return sign * Math.max(5, r);
}

export type AutoBalanceEntryInput = {
  playerId: string;
  buyIn: number;
  cashOut: number;
  chipCounts: Record<ChipDenomination, number> | null;
};

export type AutoBalanceUpdate = {
  playerId: string;
  cashOut: number;
  chipCountsJson: Record<string, number>;
};

export type AutoBalanceResult = {
  updates: AutoBalanceUpdate[];
  totalBuyIn: number;
  totalCashOutBefore: number;
  totalCashOutAfter: number;
  diffCentsBefore: number;
  diffCentsRounded: number;
};

function hasRepasse(cashOut: number): boolean {
  return roundMoney(cashOut) > 0;
}

function chipValueCents(
  cashOut: number,
  chipCounts: Record<ChipDenomination, number> | null
): number {
  if (chipCounts && CHIP_DENOMINATIONS.some((d) => (chipCounts[d] ?? 0) > 0)) {
    const m = chipCountsToMoney(chipCounts);
    return toCents(m);
  }
  return toCents(cashOut);
}

/**
 * Reduz totais em diffCents (múltiplo de 5) entre jogadores com repasse,
 * proporcional ao valor em fichas (ou cash-out quando não há fichas).
 */
function allocateReductionCents(
  diffCents: number,
  caps: number[],
  weights: number[]
): number[] {
  const n = caps.length;
  const out = new Array<number>(n).fill(0);
  if (diffCents <= 0 || n === 0) return out;

  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    throw new Error(
      "Não há base proporcional (fichas/cash-out) para distribuir o desconto."
    );
  }

  const targets = weights.map((w) => (diffCents * w) / sumW);

  for (let i = 0; i < n; i++) {
    out[i] = Math.min(Math.floor(targets[i] / 5) * 5, caps[i]);
  }

  let rem = diffCents - out.reduce((a, b) => a + b, 0);

  while (rem >= 5) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < n; i++) {
      if (out[i] + 5 <= caps[i]) {
        const slack = targets[i] - out[i];
        if (slack > bestScore) {
          bestScore = slack;
          best = i;
        }
      }
    }
    if (best < 0) break;
    out[best] += 5;
    rem -= 5;
  }

  if (rem !== 0) {
    throw new Error(
      "Não foi possível distribuir o desconto só com fichas válidas; algum jogador teria cash-out negativo ou falta capacidade."
    );
  }

  return out;
}

/**
 * Distribui shortfallCents em passos de 5 centavos, priorizando quem tem menos fichas/cash.
 */
function allocateSurplusCentsMinFirst(
  shortfallCents: number,
  startCents: number[]
): number[] {
  const n = startCents.length;
  const add = new Array<number>(n).fill(0);
  if (shortfallCents <= 0 || n === 0) return add;

  let rem = shortfallCents;
  const totals = [...startCents];

  while (rem >= 5) {
    let minVal = Infinity;
    for (const t of totals) {
      if (t < minVal) minVal = t;
    }
    const idxs: number[] = [];
    for (let i = 0; i < n; i++) {
      if (totals[i] === minVal) idxs.push(i);
    }
    const pick = idxs[0]!;
    totals[pick] += 5;
    add[pick] += 5;
    rem -= 5;
  }

  if (rem !== 0) {
    throw new Error("Sobra de centavos não múltipla de 5 ao distribuir valor.");
  }

  return add;
}

function recomputeSnappedUpdate(out: AutoBalanceUpdate, cents: number): void {
  if (cents <= 0) {
    out.cashOut = 0;
    out.chipCountsJson = chipCountsToJsonObject(emptyChipCounts());
    return;
  }
  const co0 = roundMoney(cents / 100);
  const chips = moneyToChipCounts(co0);
  out.cashOut = roundMoney(chipCountsToMoney(chips));
  out.chipCountsJson = chipCountsToJsonObject(chips);
}

function refineUpdatesToTotalBuy(
  updatesById: Map<string, AutoBalanceUpdate>,
  entries: AutoBalanceEntryInput[],
  totalBuyCents: number
): void {
  const sumCashCents = (): number => {
    let s = 0;
    for (const e of entries) {
      if (hasRepasse(e.cashOut)) {
        const u = updatesById.get(e.playerId)!;
        s += toCents(u.cashOut);
      } else {
        s += toCents(e.cashOut);
      }
    }
    return s;
  };

  let drift = totalBuyCents - sumCashCents();

  while (drift >= 5) {
    let bestId: string | null = null;
    let bestVal = Infinity;
    for (const e of entries) {
      if (!hasRepasse(e.cashOut)) continue;
      const u = updatesById.get(e.playerId)!;
      const v = toCents(u.cashOut);
      if (v < bestVal) {
        bestVal = v;
        bestId = e.playerId;
      }
    }
    if (!bestId) throw new Error("Sem jogador elegível para completar o ajuste.");
    const u = updatesById.get(bestId)!;
    recomputeSnappedUpdate(u, toCents(u.cashOut) + 5);
    drift = totalBuyCents - sumCashCents();
  }

  while (drift <= -5) {
    let bestId: string | null = null;
    let bestVal = -Infinity;
    for (const e of entries) {
      if (!hasRepasse(e.cashOut)) continue;
      const u = updatesById.get(e.playerId)!;
      const v = toCents(u.cashOut);
      if (v > bestVal && v >= 5) {
        bestVal = v;
        bestId = e.playerId;
      }
    }
    if (!bestId) {
      throw new Error(
        "Não foi possível reduzir mais fichas para alinhar o total; ajuste manualmente."
      );
    }
    const u = updatesById.get(bestId)!;
    recomputeSnappedUpdate(u, toCents(u.cashOut) - 5);
    drift = totalBuyCents - sumCashCents();
  }

  if (Math.abs(drift) > CENTS_TOLERANCE) {
    throw new Error(
      "Não foi possível fechar o total só com passos de 5 centavos mantendo fichas válidas."
    );
  }
}

/**
 * Calcula novos cash-outs e composição de fichas para fechar buy-in total vs cash-out (±2 centavos de tolerância final).
 * Ignora jogadores sem repasse (cash-out ≤ 0).
 */
export function computeHostAutoBalanceCashouts(
  entries: AutoBalanceEntryInput[]
): AutoBalanceResult | null {
  if (entries.length === 0) return null;

  let totalBuyCents = 0;
  let totalCashCents = 0;

  for (const e of entries) {
    totalBuyCents += toCents(e.buyIn);
    totalCashCents += toCents(e.cashOut);
  }

  const diffRaw = totalCashCents - totalBuyCents;
  if (Math.abs(diffRaw) <= CENTS_TOLERANCE) {
    return null;
  }

  const eligibleIdx: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (hasRepasse(entries[i]!.cashOut)) eligibleIdx.push(i);
  }

  if (eligibleIdx.length === 0) {
    throw new Error(
      "Ninguém saiu com valor em fichas para ajustar; corrija manualmente ou altere buy-ins."
    );
  }

  const diffRounded = roundDiffToStep5Cents(diffRaw);
  if (diffRounded === 0) {
    throw new Error(
      "O descompasso é ínfimo; use validação manual ou arredonde buy-ins/cash-outs."
    );
  }

  const weights = eligibleIdx.map((i) =>
    chipValueCents(entries[i]!.cashOut, entries[i]!.chipCounts)
  );
  const caps = eligibleIdx.map((i) => toCents(entries[i]!.cashOut));

  const newCashByIndex = new Map<number, number>();
  for (let i = 0; i < entries.length; i++) {
    newCashByIndex.set(i, toCents(entries[i]!.cashOut));
  }

  if (diffRounded > 0) {
    const red = allocateReductionCents(diffRounded, caps, weights);
    for (let j = 0; j < eligibleIdx.length; j++) {
      const i = eligibleIdx[j]!;
      const prev = newCashByIndex.get(i)!;
      newCashByIndex.set(i, prev - red[j]!);
    }
  } else {
    const shortfall = -diffRounded;
    const start = eligibleIdx.map((i) => newCashByIndex.get(i)!);
    const add = allocateSurplusCentsMinFirst(shortfall, start);
    for (let j = 0; j < eligibleIdx.length; j++) {
      const i = eligibleIdx[j]!;
      const prev = newCashByIndex.get(i)!;
      newCashByIndex.set(i, prev + add[j]!);
    }
  }

  const updates: AutoBalanceUpdate[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (!hasRepasse(entries[i]!.cashOut)) continue;

    const cents = newCashByIndex.get(i)!;
    if (cents < 0) {
      throw new Error("Ajuste automático geraria cash-out negativo.");
    }

    const chips =
      cents === 0 ? emptyChipCounts() : moneyToChipCounts(roundMoney(cents / 100));
    const u: AutoBalanceUpdate = {
      playerId: entries[i]!.playerId,
      cashOut: roundMoney(chipCountsToMoney(chips)),
      chipCountsJson: chipCountsToJsonObject(chips),
    };
    updates.push(u);
  }

  const updatesById = new Map(updates.map((u) => [u.playerId, u]));
  refineUpdatesToTotalBuy(updatesById, entries, totalBuyCents);

  let totalAfterCents = 0;
  for (const e of entries) {
    if (hasRepasse(e.cashOut)) {
      const u = updates.find((x) => x.playerId === e.playerId);
      if (!u) {
        throw new Error("Erro interno: atualização ausente para jogador com repasse.");
      }
      totalAfterCents += toCents(u.cashOut);
    } else {
      totalAfterCents += toCents(e.cashOut);
    }
  }

  const sumBuy = totalBuyCents / 100;
  const totalAfter = totalAfterCents / 100;
  if (Math.abs(totalAfter - sumBuy) > MONEY_EPS) {
    throw new Error(
      "Erro interno ao balancear totais. Tente novamente ou ajuste manualmente."
    );
  }

  return {
    updates,
    totalBuyIn: roundMoney(sumBuy),
    totalCashOutBefore: roundMoney(totalCashCents / 100),
    totalCashOutAfter: roundMoney(totalAfter),
    diffCentsBefore: diffRaw,
    diffCentsRounded: diffRounded,
  };
}
