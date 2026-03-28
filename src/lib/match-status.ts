export type MatchStatus =
  | "open"
  | "in_review"
  | "in_adjustment"
  | "in_payment"
  | "closed";

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  open: "Aberta",
  in_review: "Em análise",
  in_adjustment: "Em ajuste",
  in_payment: "Em pagamento",
  closed: "Fechada",
};

export function isMatchStatus(value: string | null | undefined): value is MatchStatus {
  return (
    value === "open" ||
    value === "in_review" ||
    value === "in_adjustment" ||
    value === "in_payment" ||
    value === "closed"
  );
}

export function matchAllowsPlayerFinancialEdit(
  status: MatchStatus,
  adjustmentResubmitUnlocked: boolean
): boolean {
  return (
    status === "open" ||
    status === "in_review" ||
    (status === "in_adjustment" && adjustmentResubmitUnlocked)
  );
}

export function labelMatchStatus(status: string | null | undefined): string {
  if (status && isMatchStatus(status)) return MATCH_STATUS_LABEL[status];
  return status?.trim() ? status : "—";
}

export function matchStatusBadgeClassName(status: string): string {
  if (status === "open") {
    return "border border-primary/30 bg-primary/10 text-foreground";
  }
  if (status === "closed") {
    return "border border-secondary/30 bg-secondary text-secondary-foreground";
  }
  if (status === "in_adjustment") {
    return "border border-red-500/40 bg-red-500/15 text-red-100";
  }
  if (status === "in_review" || status === "in_payment") {
    return "border border-amber-500/35 bg-amber-500/10 text-amber-100";
  }
  return "border border-border/70 bg-muted/30 text-muted-foreground";
}
