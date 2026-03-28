"use client";

import { Minus, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { MobileModal } from "@/components/mobile-modal";
import { PokerChipFace } from "@/components/poker-chip-face";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHIP_DENOMINATIONS,
  chipCountsToMoney,
  resolveInitialChipCounts,
  type ChipDenomination,
} from "@/lib/chip-denominations";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

type ChipCashoutModalProps = {
  open: boolean;
  playerName: string;
  initialCashOutMoney: number;
  initialChipCounts: Record<ChipDenomination, number> | null;
  onClose: () => void;
  onApply: (
    cashOutMoney: number,
    counts: Record<ChipDenomination, number>
  ) => Promise<void>;
  readOnly?: boolean;
};

export function ChipCashoutModal({
  open,
  playerName,
  initialCashOutMoney,
  initialChipCounts,
  onClose,
  onApply,
  readOnly = false,
}: ChipCashoutModalProps) {
  const [counts, setCounts] = useState<Record<ChipDenomination, number>>(() =>
    resolveInitialChipCounts(initialChipCounts, initialCashOutMoney)
  );

  const [applying, setApplying] = useState(false);

  const totalMoney = useMemo(() => chipCountsToMoney(counts), [counts]);

  function setCount(denom: ChipDenomination, value: number) {
    const n = Math.max(0, Math.min(9999, Math.floor(Number.isFinite(value) ? value : 0)));
    setCounts((prev) => ({ ...prev, [denom]: n }));
  }

  function bump(denom: ChipDenomination, delta: number) {
    setCount(denom, (counts[denom] ?? 0) + delta);
  }

  return (
    <MobileModal
      open={open}
      onClose={onClose}
      title={
        readOnly
          ? `Cash-out final — ${playerName}`
          : `Cash-out em fichas — ${playerName}`
      }
      description={
        readOnly
          ? "Combinação de fichas registrada nesta partida (leitura). Se não havia fichas cadastradas, os valores abaixo são apenas uma sugestão a partir do total em reais."
          : "Informe quantas fichas de cada valor você tem. O valor em dinheiro é (quantidade × Valor na Ficha) ÷ 100 — ex.: 10 fichas de 5 = R$ 0,50. A combinação é salva para você poder ajustar depois sem mudar sozinha."
      }
      className="max-w-xl sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-secondary/25 bg-gradient-to-br from-secondary/15 via-card/50 to-card/80 px-4 py-3 shadow-inner shadow-black/20">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5 text-secondary" />
            Total calculado
          </div>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-secondary sm:text-3xl">
            {formatCurrency(totalMoney)}
          </p>
        </div>

        <ul className="space-y-2.5">
          {CHIP_DENOMINATIONS.map((denom) => (
            <li
              key={denom}
              className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-background/40 px-2 py-2.5 sm:gap-3 sm:px-3"
            >
              <PokerChipFace denomination={denom} size="sm" className="sm:hidden" />
              <PokerChipFace denomination={denom} size="md" className="hidden sm:block" />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Ficha {denom}</p>
                <p className="truncate text-[11px] text-muted-foreground/80 sm:text-xs">
                  Valor em Reais: {(denom / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  cada
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-xl"
                    onClick={() => bump(denom, -1)}
                    aria-label={`Menos uma ficha ${denom}`}
                  >
                    <Minus className="size-4" />
                  </Button>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  readOnly={readOnly}
                  value={counts[denom] === 0 ? "" : String(counts[denom])}
                  onChange={(e) => {
                    if (readOnly) return;
                    const raw = e.target.value.replace(/\D/g, "");
                    setCount(denom, raw === "" ? 0 : Number(raw));
                  }}
                  className={cn(
                    "h-9 w-11 rounded-xl border border-input bg-background text-center font-heading text-sm font-semibold tabular-nums outline-none",
                    "focus:border-secondary focus:ring-2 focus:ring-secondary/30 sm:w-14 sm:text-base",
                    readOnly && "cursor-default border-border/60 bg-muted/20"
                  )}
                  aria-label={`Quantidade de fichas ${denom}`}
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-xl"
                    onClick={() => bump(denom, 1)}
                    aria-label={`Mais uma ficha ${denom}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          {readOnly ? (
            <Button
              type="button"
              className="h-12 w-full rounded-full font-semibold sm:w-auto"
              onClick={onClose}
            >
              Fechar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full"
                disabled={applying}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-12 rounded-full font-semibold shadow-lg shadow-secondary/15"
                disabled={applying}
                onClick={() => {
                  void (async () => {
                    try {
                      setApplying(true);
                      await onApply(totalMoney, counts);
                      onClose();
                    } catch {
                    } finally {
                      setApplying(false);
                    }
                  })();
                }}
              >
                {applying ? "Aplicando..." : "Aplicar ao cash-out"}
              </Button>
            </>
          )}
        </div>
      </div>
    </MobileModal>
  );
}
