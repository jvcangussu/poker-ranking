"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-9 [&_svg]:size-4",
  lg: "size-11 [&_svg]:size-[1.15rem]",
};

export function PlayerAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = photoUrl?.trim() ?? "";
  const showPhoto = Boolean(url) && !broken;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/55",
        sizeStyles[size],
        className
      )}
      title={name}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- URLs externas (Supabase etc.); evita configurar todos os hosts no next/image
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <UserRound className="text-muted-foreground/90" strokeWidth={2} aria-hidden />
      )}
    </span>
  );
}
