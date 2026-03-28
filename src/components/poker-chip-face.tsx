"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { ChipDenomination } from "@/lib/chip-denominations";

const FALLBACK_STYLES: Record<
  ChipDenomination,
  { outer: string; inner: string; text: string }
> = {
  5: {
    outer: "from-zinc-100 to-zinc-300",
    inner: "border-zinc-400/80",
    text: "text-zinc-900",
  },
  10: {
    outer: "from-rose-500 to-red-700",
    inner: "border-red-900/40",
    text: "text-white",
  },
  25: {
    outer: "from-emerald-500 to-green-800",
    inner: "border-emerald-950/40",
    text: "text-white",
  },
  50: {
    outer: "from-sky-500 to-blue-800",
    inner: "border-blue-950/40",
    text: "text-white",
  },
  100: {
    outer: "from-zinc-700 to-zinc-950",
    inner: "border-black/50",
    text: "text-zinc-100",
  },
  500: {
    outer: "from-fuchsia-500 to-purple-900",
    inner: "border-purple-950/40",
    text: "text-white",
  },
  1000: {
    outer: "from-amber-400 to-orange-700",
    inner: "border-amber-950/40",
    text: "text-amber-950",
  },
  5000: {
    outer: "from-violet-600 to-indigo-950",
    inner: "border-indigo-950/50",
    text: "text-violet-100",
  },
};

type PokerChipFaceProps = {
  denomination: ChipDenomination;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function PokerChipFace({
  denomination,
  size = "md",
  className,
}: PokerChipFaceProps) {
  const [step, setStep] = useState<"png" | "webp" | "css">("png");
  const dim =
    size === "sm" ? 44 : size === "lg" ? 72 : 56;
  const styles = FALLBACK_STYLES[denomination];

  if (step === "png") {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: dim, height: dim }}
      >
        <Image
          src={`/chips/${denomination}.png`}
          alt=""
          width={dim}
          height={dim}
          className="size-full object-cover"
          onError={() => setStep("webp")}
        />
      </div>
    );
  }

  if (step === "webp") {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: dim, height: dim }}
      >
        <Image
          src={`/chips/${denomination}.webp`}
          alt=""
          width={dim}
          height={dim}
          className="size-full object-cover"
          onError={() => setStep("css")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br p-1 shadow-md ring-2 ring-black/20",
        styles.outer,
        className
      )}
      style={{ width: dim, height: dim }}
    >
      <div
        className={cn(
          "flex size-[82%] items-center justify-center rounded-full border-[3px] bg-black/10",
          styles.inner
        )}
      >
        <span
          className={cn(
            "font-heading text-sm font-black tabular-nums drop-shadow-sm sm:text-base",
            styles.text,
            size === "sm" && "text-xs sm:text-sm",
            size === "lg" && "text-lg sm:text-xl"
          )}
        >
          {denomination}
        </span>
      </div>
    </div>
  );
}
