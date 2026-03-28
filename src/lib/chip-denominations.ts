/** Valores de face das fichas (unidades inteiras). O valor em dinheiro é (quantidade × face) / 100. */
export const CHIP_DENOMINATIONS = [
  5, 10, 25, 50, 100, 500, 1000, 5000,
] as const;

export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

export function chipCountsToMoney(
  counts: Partial<Record<number, number>>
): number {
  const raw =
    CHIP_DENOMINATIONS.reduce(
      (sum, d) => sum + Math.max(0, Math.floor(counts[d] ?? 0)) * d,
      0
    ) / 100;
  return Math.round(raw * 100) / 100;
}

export function emptyChipCounts(): Record<ChipDenomination, number> {
  return Object.fromEntries(
    CHIP_DENOMINATIONS.map((d) => [d, 0])
  ) as Record<ChipDenomination, number>;
}

/** Serializa contagens para JSON no banco (só faces com quantidade > 0). */
export function chipCountsToJsonObject(
  counts: Record<ChipDenomination, number>
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const d of CHIP_DENOMINATIONS) {
    const n = Math.max(0, Math.min(9999, Math.floor(counts[d] ?? 0)));
    if (n > 0) o[String(d)] = n;
  }
  return o;
}

/** Lê o JSON salvo no banco de volta para o mapa de faces. */
export function chipCountsFromJson(
  json: unknown
): Record<ChipDenomination, number> | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }
  const o = json as Record<string, unknown>;
  const out = emptyChipCounts();
  let has = false;
  for (const d of CHIP_DENOMINATIONS) {
    const raw = o[String(d)];
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : 0;
    if (Number.isFinite(n) && n > 0) {
      out[d] = Math.min(9999, Math.floor(n));
      has = true;
    }
  }
  return has ? out : null;
}

/**
 * Ao reabrir o modal: usa as fichas salvas no banco; senão reconstrói a partir do valor (legado).
 */
export function resolveInitialChipCounts(
  saved: Record<ChipDenomination, number> | null | undefined,
  cashOutMoney: number
): Record<ChipDenomination, number> {
  if (saved && CHIP_DENOMINATIONS.some((d) => (saved[d] ?? 0) > 0)) {
    const merged = emptyChipCounts();
    for (const d of CHIP_DENOMINATIONS) {
      merged[d] = Math.min(
        9999,
        Math.max(0, Math.floor(saved[d] ?? 0))
      );
    }
    return merged;
  }
  const n = Number(cashOutMoney);
  if (Number.isFinite(n) && n > 0) {
    return moneyToChipCounts(n);
  }
  return emptyChipCounts();
}

/**
 * Reconstrói uma contagem de fichas cujo total em dinheiro coincide com `money`
 * (em R$), usando algoritmo guloso do maior para o menor valor de face.
 * Valores que não são múltiplos de 5 centavos são arredondados para o múltiplo
 * de 5 centavos mais próximo antes da decomposição.
 */
export function moneyToChipCounts(money: number): Record<ChipDenomination, number> {
  const counts = emptyChipCounts();
  let cents = Math.round(Number(money) * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    return counts;
  }

  // Faces são múltiplas de 5 centavos; ajusta para o múltiplo de 5 imediatamente inferior.
  cents -= cents % 5;

  const denomsDesc = [...CHIP_DENOMINATIONS].sort((a, b) => b - a);
  let remaining = cents;

  for (const d of denomsDesc) {
    const n = Math.min(9999, Math.floor(remaining / d));
    counts[d] = n;
    remaining -= n * d;
  }

  return counts;
}
