/** Mensagem legível a partir do erro retornado por RPC/PostgREST (Supabase). */
export function getSupabaseRpcErrorMessage(
  err: unknown,
  fallback: string
): string {
  if (!err || typeof err !== "object") return fallback;
  const o = err as {
    message?: string;
    details?: string;
    hint?: string;
  };
  const parts = [o.message, o.details, o.hint].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
  if (parts.length === 0) return fallback;
  return parts.join(" ").trim();
}
