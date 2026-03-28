"use client";

import { Loader2, Swords, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDeleteMatchModalProps = {
  open: boolean;
  matchTitle: string;
  playedAtLabel: string;
  createdByLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
};

export function ConfirmDeleteMatchModal({
  open,
  matchTitle,
  playedAtLabel,
  createdByLabel,
  onClose,
  onConfirm,
  confirming,
}: ConfirmDeleteMatchModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-match-title"
      aria-describedby="confirm-delete-match-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={confirming ? undefined : onClose}
        aria-label="Fechar"
        disabled={confirming}
      />

      <div
        className={cn(
          "relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-rose-500/25 bg-card shadow-2xl shadow-rose-950/40",
          "sm:rounded-[2rem] sm:border-border/70 sm:shadow-black/25",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(ellipse_at_20%_0%,rgba(244,63,94,0.14),transparent_55%)]"
        )}
      >
        <div className="relative flex items-start justify-between gap-3 border-b border-border/60 px-5 pb-4 pt-5">
          <div className="flex min-w-0 flex-1 gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-500/25 to-rose-600/10 text-rose-100 shadow-inner shadow-rose-950/30">
              <Trash2 className="size-6" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="confirm-delete-match-title"
                className="font-heading text-lg font-semibold leading-tight text-foreground"
              >
                Excluir esta partida?
              </h2>
              <p
                id="confirm-delete-match-desc"
                className="mt-1 text-sm leading-relaxed text-muted-foreground"
              >
                Esta ação é permanente. Entradas, compras e resultados serão apagados. O ranking e os saldos
                passam a considerar só as partidas que restarem.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={onClose}
            disabled={confirming}
            aria-label="Fechar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="relative space-y-3 px-5 py-4">
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="flex items-start gap-2">
              <Swords className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="font-heading break-words text-base font-semibold text-foreground">
                  {matchTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{playedAtLabel}</p>
                {createdByLabel ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Criada por <span className="font-medium text-foreground/90">{createdByLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/90">
            Não há como desfazer depois de confirmar.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-card/80 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full sm:w-auto"
            onClick={onClose}
            disabled={confirming}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full rounded-full border border-rose-600/50 bg-rose-600 text-white hover:bg-rose-600/90 sm:w-auto"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 size-4" />
                Excluir permanentemente
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
