#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENSURE_SQL="supabase/migrations/20260331170000_ensure_group_auth_rpcs.sql"

if ! npx supabase projects list >/dev/null 2>&1; then
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "Rode: npx supabase login"
    echo "ou defina SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)"
    exit 1
  fi
fi

if [[ ! -f .env.local ]]; then
  echo "Arquivo .env.local não encontrado em $ROOT"
  exit 1
fi

# Extrai project ref de https://<ref>.supabase.co
REF=""
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ NEXT_PUBLIC_SUPABASE_URL=https://([^\.]+)\.supabase\.co ]]; then
    REF="${BASH_REMATCH[1]}"
    break
  fi
done < .env.local

if [[ -z "$REF" ]]; then
  echo "Não foi possível ler o project ref em NEXT_PUBLIC_SUPABASE_URL no .env.local"
  exit 1
fi

echo "Linkando projeto: $REF"
npx supabase link --project-ref "$REF" --yes

echo "Aplicando migrations (db push)..."
set +e
npx supabase db push --yes
PUSH_EXIT=$?
set -e

if [[ "$PUSH_EXIT" -eq 0 ]]; then
  echo "Concluído (db push)."
  exit 0
fi

echo ""
echo "db push falhou (histórico de migrations no remoto ≠ pasta local)."
echo "Aplicando RPCs de grupo/login via SQL (${ENSURE_SQL})..."
npx supabase db query --linked -f "$ENSURE_SQL" --yes
echo ""
echo "RPCs aplicadas. Se ainda precisar alinhar o histórico: supabase migration repair / db pull (veja mensagem do db push)."
echo "Concluído (modo fallback)."
