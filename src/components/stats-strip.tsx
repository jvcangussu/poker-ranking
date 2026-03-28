"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatsStripTone =
  | "secondary"
  | "default"
  | "primary"
  | "danger"
  | "highlight"
  | "stripTotal"
  | "stripOpen"
  | "stripReview"
  | "stripAdjustment"
  | "stripPayment"
  | "stripClosed";

const toneClass: Record<StatsStripTone, string> = {
  secondary:
    "border-secondary/35 bg-secondary/15 text-secondary ring-secondary/25",
  default: "border-border/60 bg-muted/30 text-muted-foreground",
  primary: "border-primary/35 bg-primary/15 text-primary ring-primary/25",
  danger: "border-primary/40 bg-primary/20 text-primary",
  highlight: "border-primary/30 bg-primary text-primary-foreground",
  stripTotal:
    "border-amber-400/50 bg-amber-500/25 text-amber-100 ring-amber-400/30",
  stripOpen:
    "border-blue-400/50 bg-blue-600/25 text-blue-100 ring-blue-400/25",
  stripReview:
    "border-fuchsia-400/65 bg-fuchsia-600/35 text-fuchsia-50 ring-fuchsia-400/40",
  stripAdjustment:
    "border-red-500/70 bg-red-700/40 text-red-50 ring-red-500/45",
  stripPayment:
    "border-emerald-400/45 bg-emerald-600/25 text-emerald-100 ring-emerald-400/25",
  stripClosed:
    "border-violet-400/45 bg-violet-600/25 text-violet-100 ring-violet-400/25",
};

const filterActiveShellClass: Partial<Record<StatsStripTone, string>> = {
  stripTotal:
    "border-amber-400/55 bg-amber-500/15 shadow-amber-500/10 ring-amber-400/45 lg:border-amber-400/50 lg:bg-amber-500/12",
  stripOpen:
    "border-blue-400/55 bg-blue-600/12 shadow-blue-500/10 ring-blue-400/45 lg:border-blue-400/50 lg:bg-blue-600/10",
  stripReview:
    "border-fuchsia-400/60 bg-fuchsia-600/18 shadow-fuchsia-500/15 ring-fuchsia-400/50 lg:border-fuchsia-400/55 lg:bg-fuchsia-600/14",
  stripAdjustment:
    "border-red-500/65 bg-red-700/22 shadow-red-600/15 ring-red-500/50 lg:border-red-500/60 lg:bg-red-700/16",
  stripPayment:
    "border-emerald-400/55 bg-emerald-600/12 shadow-emerald-500/10 ring-emerald-400/45 lg:border-emerald-400/50 lg:bg-emerald-600/10",
  stripClosed:
    "border-violet-400/55 bg-violet-600/12 shadow-violet-500/10 ring-violet-400/45 lg:border-violet-400/50 lg:bg-violet-600/10",
};

export type StatsStripItem = {
  title: string;
  "aria-label": string;
  icon: LucideIcon;
  tone?: StatsStripTone;
  children: ReactNode;
  onClick?: () => void;
  isActive?: boolean;
};

const stripGridCols: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

export function StatsStrip({ items }: { items: StatsStripItem[] }) {
  const n = items.length;
  const gridCols =
    stripGridCols[n] ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
  const useDenseMobileLayout = n === 6;

  return (
    <Card className="rounded-2xl border-border/70 bg-card/60 py-1 shadow-lg shadow-black/5 sm:rounded-[1.75rem]">
      <CardContent
        className={cn(
          "grid px-1 py-2 sm:px-2 sm:py-3",
          useDenseMobileLayout
            ? "gap-2 sm:gap-2 lg:gap-0 lg:divide-x lg:divide-border/60"
            : "gap-0 divide-x divide-border/60",
          gridCols
        )}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const tone = item.tone ?? "default";
          const interactive = Boolean(item.onClick);

          const iconBox = (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl border",
                useDenseMobileLayout ? "size-8 sm:size-9 lg:size-10" : "size-9 sm:size-10",
                toneClass[tone]
              )}
            >
              <Icon
                className={
                  useDenseMobileLayout
                    ? "size-[0.95rem] sm:size-[1.1rem] lg:size-5"
                    : "size-[1.1rem] sm:size-5"
                }
                aria-hidden
                strokeWidth={2}
              />
            </div>
          );

          const body = (
            <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 text-center">
              {item.children}
            </div>
          );

          const staticCellClass = cn(
            "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1.5 sm:px-1 sm:py-2",
            useDenseMobileLayout &&
              "rounded-xl border border-border/50 bg-background/20 lg:rounded-none lg:border-0 lg:bg-transparent"
          );

          const interactiveCellClass = cn(
            "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1.5 sm:px-1 sm:py-2",
            "w-full cursor-pointer text-inherit transition",
            "rounded-xl lg:rounded-2xl",
            "border border-transparent bg-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
            "hover:bg-background/30",
            useDenseMobileLayout &&
              "border-border/50 bg-background/20 lg:border-transparent lg:bg-background/15",
            item.isActive &&
              cn(
                "shadow-sm ring-2 ring-inset",
                filterActiveShellClass[tone] ??
                  "border-primary/50 bg-primary/15 shadow-primary/10 ring-primary/50"
              ),
            useDenseMobileLayout &&
              item.isActive &&
              !filterActiveShellClass[tone] &&
              "lg:border-primary/45 lg:bg-primary/10"
          );

          if (interactive) {
            return (
              <div key={index} className="min-w-0">
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-label={item["aria-label"]}
                  aria-pressed={item.isActive}
                  title={item.title}
                  className={interactiveCellClass}
                >
                  {iconBox}
                  {body}
                </button>
              </div>
            );
          }

          return (
            <div
              key={index}
              className={staticCellClass}
              title={item.title}
              aria-label={item["aria-label"]}
            >
              {iconBox}
              {body}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
