"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { MobileModal } from "@/components/mobile-modal";
import { Button } from "@/components/ui/button";

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

export type BuyInEventLine = {
  id: string;
  amount: number;
  created_at: string;
};

type AddBuyInModalProps = {
  open: boolean;
  playerName: string;
  maxBuyIn: number | null | undefined;
  events: BuyInEventLine[];
  onClose: () => void;
  onAdd: (amount: number) => Promise<void>;
  onUpdateEvent: (eventId: string, amount: number) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
};

export function AddBuyInModal({
  open,
  playerName,
  maxBuyIn,
  events,
  onClose,
  onAdd,
  onUpdateEvent,
  onDeleteEvent,
}: AddBuyInModalProps) {
  const [newAmount, setNewAmount] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewAmount("");
    setError(null);
    setBusy(null);
    const next: Record<string, string> = {};
    for (const ev of events) {
      next[ev.id] = String(ev.amount);
    }
    setDrafts(next);
  }, [open, events]);

  function parseAmount(raw: string): number | null {
    const n = Number(String(raw).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function validateMax(n: number): string | null {
    if (maxBuyIn != null && n > maxBuyIn) {
      return `O valor não pode ser maior que ${formatCurrency(maxBuyIn)} (limite por compra).`;
    }
    return null;
  }

  async function handleAdd() {
    const n = parseAmount(newAmount);
    if (n == null) {
      setError("Informe um valor positivo.");
      return;
    }
    const v = validateMax(n);
    if (v) {
      setError(v);
      return;
    }
    try {
      setBusy("add");
      setError(null);
      await onAdd(n);
      setNewAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar buy-in.");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(eventId: string) {
    const n = parseAmount(drafts[eventId] ?? "");
    if (n == null) {
      setError("Informe um valor positivo em cada compra.");
      return;
    }
    const v = validateMax(n);
    if (v) {
      setError(v);
      return;
    }
    try {
      setBusy(`u:${eventId}`);
      setError(null);
      await onUpdateEvent(eventId, n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar compra.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(eventId: string) {
    if (
      !window.confirm(
        "Remover esta compra de fichas? O total de buy-in será recalculado."
      )
    ) {
      return;
    }
    try {
      setBusy(`d:${eventId}`);
      setError(null);
      await onDeleteEvent(eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover compra.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <MobileModal
      open={open}
      onClose={() => !busy && onClose()}
      title={`Buy-in — ${playerName}`}
      description={
        maxBuyIn != null
          ? `Cada compra não pode passar de ${formatCurrency(maxBuyIn)} nesta partida. Você pode corrigir valores ou remover compras incorretas.`
          : "Adicione compras de fichas, ou edite/remova registros incorretos."
      }
      className="max-w-md"
    >
      <div className="space-y-4">
        {events.length > 0 && (
          <ul className="max-h-[min(50vh,22rem)] space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-background/30 p-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-xl border border-border/50 bg-background/40 p-3"
              >
                <p className="text-[11px] text-muted-foreground">{formatDate(ev.created_at)}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                      htmlFor={`buyin-${ev.id}`}
                    >
                      Valor
                    </label>
                    <input
                      id={`buyin-${ev.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[ev.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [ev.id]: e.target.value }))
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background/70 px-3 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 rounded-full px-3"
                      disabled={!!busy}
                      onClick={() => void handleUpdate(ev.id)}
                    >
                      {busy === `u:${ev.id}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 shrink-0 rounded-full"
                      disabled={!!busy}
                      onClick={() => void handleDelete(ev.id)}
                      aria-label="Remover compra"
                    >
                      {busy === `d:${ev.id}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Nova compra de fichas
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Ex.: 50"
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background/70 px-3 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
            />
            <Button
              type="button"
              className="h-11 shrink-0 rounded-full gap-1.5 px-4"
              disabled={!!busy}
              onClick={() => void handleAdd()}
            >
              {busy === "add" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Plus className="size-4" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full"
            disabled={!!busy}
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </div>
    </MobileModal>
  );
}
