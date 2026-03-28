-- Exclusão de partida por administrador do grupo.
-- match_buy_in_events já referencia matches com ON DELETE CASCADE.
-- Aqui garantimos CASCADE em match_entries para um DELETE em matches remover tudo
-- (ranking v_group_ranking / agregados passam a refletir só as partidas restantes).

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'match_entries'
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) LIKE '%REFERENCES %matches%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.match_entries DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.match_entries
  ADD CONSTRAINT match_entries_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.admin_delete_match(
  p_match_id uuid,
  p_admin_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT m.group_id INTO v_group_id
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_admin_player_id
      AND p.group_id = v_group_id
      AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Apenas administradores do grupo podem excluir partidas.';
  END IF;

  DELETE FROM public.matches WHERE id = p_match_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_match(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_match(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_match(uuid, uuid) TO service_role;
