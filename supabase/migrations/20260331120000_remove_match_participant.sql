-- Remove um jogador da partida (entrada + eventos de buy-in).
-- Permitido apenas para administrador do grupo ou dono da partida (criador).
-- Bloqueado em in_payment e closed.

CREATE OR REPLACE FUNCTION public.remove_match_participant(
  p_match_id uuid,
  p_target_player_id uuid,
  p_actor_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_group_id uuid;
  v_status text;
  v_creator uuid;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.group_id, m.status, m.created_by_player_id
  INTO v_group_id, v_status, v_creator
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_status IN ('in_payment', 'closed') THEN
    RAISE EXCEPTION 'Não é possível remover participantes nesta fase da partida.';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO v_actor_is_admin
  FROM public.players p
  WHERE p.id = p_actor_player_id
    AND p.group_id = v_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogador não encontrado neste grupo.';
  END IF;

  IF NOT (v_actor_is_admin OR p_actor_player_id = v_creator) THEN
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode remover participantes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_entries me
    WHERE me.match_id = p_match_id AND me.player_id = p_target_player_id
  ) THEN
    RAISE EXCEPTION 'Este jogador não está nesta partida.';
  END IF;

  DELETE FROM public.match_buy_in_events e
  WHERE e.match_id = p_match_id AND e.player_id = p_target_player_id;

  DELETE FROM public.match_entries me
  WHERE me.match_id = p_match_id AND me.player_id = p_target_player_id;

  PERFORM public.downgrade_match_if_not_all_submitted(p_match_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remove_match_participant(uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.remove_match_participant(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_match_participant(uuid, uuid, uuid) TO service_role;
