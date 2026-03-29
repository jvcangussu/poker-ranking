"use client";

import { Download, Loader2, Share2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { captureShareCardToPng } from "@/lib/share-capture-png";
import { cn } from "@/lib/utils";

import type { MatchSummaryRow } from "@/types/database";
import type { ParticipantEntry } from "@/types/ui";

const EXPORT_W = 1080;
const EXPORT_H = 1920;

const APP_MARK = "Poker Ranking";

const INSTA_BG = "/insta_background.png";

const FALLBACK_BG = "#0a1628";

const EXPORT_PIXEL_RATIO = 1;

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

function isSecureShareContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

function buildShareablePngFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: "image/png",
    lastModified: Date.now(),
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ShareAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = photoUrl?.trim() ?? "";
  const showPhoto = Boolean(url) && !broken;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-zinc-600 to-zinc-900 ring-2 ring-white/30",
        className
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center text-center font-bold text-white">
        <span className="leading-none">{initials(name)}</span>
      </div>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- export PNG; URLs externas (Supabase)
        <img
          src={url}
          alt=""
          crossOrigin="anonymous"
          className="relative z-10 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
    </div>
  );
}

type MatchResultShareModalProps = {
  open: boolean;
  onClose: () => void;
  highlightPlayerId: string;
  rankedEntries: ParticipantEntry[];
  match: MatchSummaryRow;
};

function rankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function MatchResultShareModal({
  open,
  onClose,
  highlightPlayerId,
  rankedEntries,
  match,
}: MatchResultShareModalProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [scale, setScale] = useState(0.38);
  const [exporting, setExporting] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const highlightEntry = useMemo(
    () => rankedEntries.find((e) => e.playerId === highlightPlayerId),
    [rankedEntries, highlightPlayerId]
  );

  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / EXPORT_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const n = rankedEntries.length;
  const density = n > 16 ? "ultra" : n > 11 ? "dense" : n > 7 ? "normal" : "relaxed";

  const buildFileBaseName = useCallback(() => {
    const label =
      highlightEntry?.playerName.replace(/[^\w\u00C0-\u024f\s-]/gi, "").trim() || "ranking";
    return `poker-ranking-${match.group_code}-${label.replace(/\s+/g, "-").toLowerCase()}`;
  }, [highlightEntry?.playerName, match.group_code]);

  const captureRankingPng = useCallback(async (): Promise<string> => {
    const node = cardRef.current;
    if (!node) throw new Error("Card indisponível");
    return captureShareCardToPng(node, {
      width: EXPORT_W,
      height: EXPORT_H,
      pixelRatio: EXPORT_PIXEL_RATIO,
      backgroundColor: FALLBACK_BG,
    });
  }, []);

  const triggerDownload = useCallback(
    (dataUrl: string, baseName: string) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${baseName}.png`;
      a.click();
    },
    []
  );

  const handlePostInstagram = useCallback(async () => {
    setShareHint(null);
    setExporting(true);
    try {
      const dataUrl = await captureRankingPng();
      const baseName = buildFileBaseName();
      const blob = await dataUrlToBlob(dataUrl);
      const file = buildShareablePngFile(blob, `${baseName}.png`);

      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      const hasShare = typeof nav?.share === "function";

      if (!hasShare) {
        setShareHint(
          "Este navegador não oferece Compartilhar com arquivo. Use «Só salvar PNG» e envie pelo Instagram."
        );
        return;
      }

      try {
        await nav!.share({ files: [file] });
        setShareHint("Escolha Instagram ou Story na lista.");
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
      try {
        await nav!.share({ files: [file], title: APP_MARK });
        setShareHint("Escolha Instagram na lista.");
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }

      if (!isSecureShareContext()) {
        setShareHint(
          "Compartilhar com foto costuma falhar em HTTP. Abra o site em HTTPS ou use «Só salvar PNG»."
        );
      } else {
        setShareHint(
          "Não foi possível abrir o compartilhamento. Tente de novo ou use «Só salvar PNG»."
        );
      }
    } catch {
      setShareHint("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }, [buildFileBaseName, captureRankingPng]);

  const handleDownload = useCallback(async () => {
    setShareHint(null);
    setExporting(true);
    try {
      const dataUrl = await captureRankingPng();
      triggerDownload(dataUrl, buildFileBaseName());
    } catch {
      setShareHint("Erro ao gerar PNG.");
    } finally {
      setExporting(false);
    }
  }, [buildFileBaseName, captureRankingPng, triggerDownload]);

  if (!mounted || !open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-zinc-950/97 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-share-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2
            id="match-share-title"
            className="font-heading text-lg font-semibold text-white sm:text-xl"
          >
            Post do ranking
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
            PNG 1080×1920 (9:16) para Stories — encaixa sem corte no Instagram.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="size-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-4 sm:px-6">
        <div
          ref={wrapRef}
          className="relative w-full max-w-[min(92vw,480px)] shrink-0"
          style={{ height: EXPORT_H * scale }}
        >
          <div
            ref={cardRef}
            className={cn(
              "font-heading absolute left-0 top-0 overflow-hidden rounded-3xl",
              "text-white shadow-2xl shadow-black/60 ring-2 ring-amber-500/30"
            )}
            style={{
              width: EXPORT_W,
              height: EXPORT_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- asset local public/ */}
              <img
                src={INSTA_BG}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 min-h-[125%] min-w-[125%] -translate-x-1/2 -translate-y-1/2 object-cover object-[center_36%]"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/82" />
              <div className="absolute inset-0 bg-black/25" />
            </div>

            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.06]"
              aria-hidden
            >
              <span
                className="whitespace-nowrap font-heading text-[100px] font-bold tracking-tight text-white"
                style={{ transform: "rotate(-22deg)" }}
              >
                {APP_MARK}
              </span>
            </div>

            <div
              className={cn(
                "relative flex h-full min-h-0 flex-col",
                density === "ultra" && "px-7 pb-6 pt-7",
                density === "dense" && "px-8 pb-7 pt-8",
                density === "normal" && "px-9 pb-8 pt-9",
                density === "relaxed" && "px-10 pb-10 pt-10"
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-bold uppercase tracking-[0.2em] text-amber-200 drop-shadow-md",
                      density === "ultra" && "text-[16px]",
                      density === "dense" && "text-[18px]",
                      density === "normal" && "text-[20px]",
                      density === "relaxed" && "text-[22px]"
                    )}
                  >
                    Ranking da noite
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-bold leading-tight text-white drop-shadow-lg",
                      density === "ultra" && "text-[30px]",
                      density === "dense" && "text-[34px]",
                      density === "normal" && "text-[38px]",
                      density === "relaxed" && "text-[42px]"
                    )}
                  >
                    {match.group_name}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-medium text-zinc-200 drop-shadow",
                      density === "ultra" && "text-[18px]",
                      density === "dense" && "text-[19px]",
                      density === "normal" && "text-[21px]",
                      density === "relaxed" && "text-[23px]"
                    )}
                  >
                    {formatDateShort(match.played_at)}
                  </p>
                </div>
                <div
                  className={cn(
                    "shrink-0 rounded-2xl border border-amber-400/50 bg-black/50 px-2.5 py-1.5 text-right shadow-lg backdrop-blur-sm",
                    density === "relaxed" && "px-3 py-2"
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                    Mesa total
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-bold tabular-nums leading-none text-white drop-shadow",
                      density === "ultra" && "text-[17px]",
                      density === "dense" && "text-[19px]",
                      density === "normal" && "text-[21px]",
                      density === "relaxed" && "text-[23px]"
                    )}
                  >
                    {formatCurrency(match.total_buy_in)}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col justify-center gap-2",
                  density === "relaxed" && "gap-3"
                )}
              >
                {highlightEntry && (
                  <p
                    className={cn(
                      "shrink-0 rounded-xl border border-amber-400/50 bg-black/45 px-3 py-1.5 text-center font-semibold text-amber-50 shadow-md backdrop-blur-sm",
                      density === "ultra" ? "text-[15px]" : "text-[17px]",
                      density === "relaxed" && "text-[19px]"
                    )}
                  >
                    Destaque:{" "}
                    <span className="font-bold text-white">{highlightEntry.playerName}</span>
                  </p>
                )}

                <div
                  className={cn(
                    "min-h-0 shrink rounded-2xl border-2 border-white/20 bg-black/40 shadow-xl backdrop-blur-md"
                  )}
                >
                <div
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-white/15 bg-black/35 px-3 py-2 font-bold uppercase tracking-wide text-zinc-300",
                    density === "ultra" && "text-[13px]",
                    density === "dense" && "text-[14px]",
                    density === "normal" && "text-[16px]",
                    density === "relaxed" && "px-4 py-2.5 text-[17px]"
                  )}
                >
                  <span className="w-14 text-center sm:w-16">#</span>
                  <span>Jogador</span>
                  <span className="text-right">Resultado</span>
                </div>
                <div>
                  {rankedEntries.map((e, index) => {
                    const rank = index + 1;
                    const isHighlight = e.playerId === highlightPlayerId;
                    const medal = rankMedal(rank);
                    const profit = e.profit;
                    const pos = profit > 0;
                    const neg = profit < 0;

                    return (
                      <div
                        key={e.playerId}
                        className={cn(
                          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-white/[0.08] px-3 last:border-b-0",
                          density === "ultra" && "py-1.5",
                          density === "dense" && "py-2",
                          density === "normal" && "py-2.5",
                          density === "relaxed" && "gap-x-3 px-4 py-3",
                          isHighlight &&
                            "relative bg-gradient-to-r from-amber-500/35 via-amber-400/20 to-transparent ring-1 ring-inset ring-amber-300/60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex w-14 flex-col items-center justify-center gap-0 font-black tabular-nums text-zinc-200 drop-shadow sm:w-16",
                            density === "ultra" && "text-[22px]",
                            density === "dense" && "text-[24px]",
                            density === "normal" && "text-[28px]",
                            density === "relaxed" && "text-[32px]",
                            rank === 1 && "text-amber-300",
                            rank === 2 && "text-slate-200",
                            rank === 3 && "text-orange-300"
                          )}
                        >
                          <span className="leading-none">{rank}</span>
                          {medal && (
                            <span
                              className={cn(
                                "leading-none",
                                density === "ultra" ? "text-[18px]" : "text-[22px]"
                              )}
                            >
                              {medal}
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "flex min-w-0 items-center",
                            density === "ultra" ? "gap-2.5" : "gap-3",
                            density === "relaxed" && "gap-3.5"
                          )}
                        >
                          <ShareAvatar
                            name={e.playerName}
                            photoUrl={e.photoUrl}
                            className={cn(
                              density === "ultra" && "size-12 text-[15px]",
                              density === "dense" && "size-14 text-[17px]",
                              density === "normal" && "size-16 text-[19px]",
                              density === "relaxed" && "size-[72px] text-[22px]"
                            )}
                          />
                          <span
                            className={cn(
                              "min-w-0 truncate font-bold text-white drop-shadow",
                              density === "ultra" && "text-[20px]",
                              density === "dense" && "text-[23px]",
                              density === "normal" && "text-[26px]",
                              density === "relaxed" && "text-[30px]",
                              isHighlight && "text-amber-50"
                            )}
                          >
                            {e.playerName}
                            {isHighlight && (
                              <span
                                className={cn(
                                  "ml-2 font-bold uppercase tracking-wide text-amber-200",
                                  density === "ultra" ? "text-[11px]" : "text-[12px]"
                                )}
                              >
                                (você)
                              </span>
                            )}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-right font-black tabular-nums leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]",
                            density === "ultra" && "text-[22px]",
                            density === "dense" && "text-[26px]",
                            density === "normal" && "text-[30px]",
                            density === "relaxed" && "text-[34px]",
                            pos && "text-green-400",
                            neg && "text-red-500",
                            !pos && !neg && "text-zinc-200"
                          )}
                        >
                          {pos ? "+" : ""}
                          {formatCurrency(profit)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>

              <div
                className={cn(
                  "flex shrink-0 items-end justify-between border-t border-white/15 pt-3",
                  density === "relaxed" && "pt-4"
                )}
              >
                <div>
                  <p
                    className={cn(
                      "font-bold text-white drop-shadow-md",
                      density === "ultra" ? "text-[19px]" : "text-[23px]",
                      density === "relaxed" && "text-[26px]"
                    )}
                  >
                    {APP_MARK}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-zinc-300",
                      density === "ultra" ? "text-[13px]" : "text-[15px]"
                    )}
                  >
                    {n} {n === 1 ? "jogador" : "jogadores"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-zinc-950/80 px-4 py-4 sm:px-6">
        {shareHint && (
          <p className="mx-auto mb-3 max-w-lg rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs leading-relaxed text-zinc-300">
            {shareHint}
          </p>
        )}
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full border-zinc-600 bg-transparent text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
          >
            Fechar
          </Button>
          <Button
            type="button"
            className="h-12 rounded-full gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white hover:from-fuchsia-500 hover:to-pink-500"
            disabled={exporting}
            onClick={() => void handlePostInstagram()}
          >
            {exporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Share2 className="size-4" />
                Postar no Instagram
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-full gap-2 border border-white/10 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            disabled={exporting}
            onClick={() => void handleDownload()}
          >
            <Download className="size-4" />
            Só salvar PNG
          </Button>
        </div>
      </footer>
    </div>
  );

  return createPortal(content, document.body);
}
