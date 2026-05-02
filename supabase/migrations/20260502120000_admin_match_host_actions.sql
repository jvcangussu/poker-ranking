-- Dono da partida OU administrador do grupo pode: validar totais, reabrir análises,
-- desbloquear reenvio, marcar pagamentos, finalizar — e atualizar o PIX do organizador.
-- Edição de PIX bloqueada após partida fechada.

CREATE OR REPLACE FUNCTION public.host_validate_match_totals(
  p_match_id uuid,
  p_actor_player_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_buy numeric;
  v_cash numeric;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode validar os valores.';
  END IF;

  IF v_status NOT IN ('in_review', 'in_adjustment') THEN
    RAISE EXCEPTION
      'Validação só está disponível com a partida em análise ou em ajuste (estado atual: %).',
      v_status;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.match_entries me
    WHERE me.match_id = p_match_id
      AND me.submitted_for_review_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Todos os participantes precisam ter enviado para análise antes de validar. Confira se alguém ainda não confirmou o envio.';
  END IF;

  SELECT coalesce(sum(me.buy_in), 0), coalesce(sum(me.cash_out), 0)
  INTO v_buy, v_cash
  FROM public.match_entries me
  WHERE me.match_id = p_match_id;

  IF abs(round(v_buy::numeric, 2) - round(v_cash::numeric, 2)) <= 0.02 THEN
    UPDATE public.matches
    SET status = 'in_payment', updated_at = now()
    WHERE id = p_match_id;
    RETURN 'in_payment';
  ELSE
    UPDATE public.matches
    SET status = 'in_adjustment', updated_at = now()
    WHERE id = p_match_id;

    UPDATE public.match_entries
    SET adjustment_resubmit_unlocked = false
    WHERE match_id = p_match_id;

    RETURN 'in_adjustment';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_reopen_all_analyses(
  p_match_id uuid,
  p_actor_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode reabrir as análises.';
  END IF;

  IF v_status <> 'in_adjustment' THEN
    RAISE EXCEPTION 'Só é possível reabrir todos durante o ajuste.';
  END IF;

  UPDATE public.match_entries
  SET
    submitted_for_review_at = NULL,
    adjustment_resubmit_unlocked = false,
    updated_at = now()
  WHERE match_id = p_match_id;

  UPDATE public.matches
  SET status = 'open', updated_at = now()
  WHERE id = p_match_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_unlock_player_resubmit(
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
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_updated int;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode desbloquear jogadores.';
  END IF;

  IF v_status <> 'in_adjustment' THEN
    RAISE EXCEPTION 'Desbloqueio individual só em ajuste.';
  END IF;

  UPDATE public.match_entries
  SET
    adjustment_resubmit_unlocked = true,
    updated_at = now()
  WHERE match_id = p_match_id AND player_id = p_target_player_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Participante não encontrado.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_set_player_paid(
  p_match_id uuid,
  p_target_player_id uuid,
  p_actor_player_id uuid,
  p_paid boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_updated int;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode marcar pagamentos.';
  END IF;

  IF v_status <> 'in_payment' THEN
    RAISE EXCEPTION 'Marcação de pagamento só na fase de pagamento.';
  END IF;

  UPDATE public.match_entries
  SET
    host_confirmed_paid_at = CASE WHEN p_paid THEN now() ELSE NULL END,
    updated_at = now()
  WHERE match_id = p_match_id AND player_id = p_target_player_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Participante não encontrado.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_match(
  p_match_id uuid,
  p_actor_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_pending int;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode finalizar a partida.';
  END IF;

  IF v_status <> 'in_payment' THEN
    RAISE EXCEPTION 'Finalize somente na fase de pagamento.';
  END IF;

  SELECT count(*)::int
  INTO v_pending
  FROM public.match_entries
  WHERE match_id = p_match_id AND host_confirmed_paid_at IS NULL;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Confirme o pagamento de todos os jogadores antes de finalizar.';
  END IF;

  UPDATE public.matches
  SET status = 'closed', updated_at = now()
  WHERE id = p_match_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_match_host_pix(
  p_match_id uuid,
  p_actor_player_id uuid,
  p_host_pix_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_creator uuid;
  v_group_id uuid;
  v_status text;
  v_actor_is_admin boolean;
BEGIN
  SELECT m.created_by_player_id, m.group_id, m.status
  INTO v_creator, v_group_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode alterar o PIX do organizador.';
  END IF;

  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'Não é possível alterar o PIX após o encerramento da partida.';
  END IF;

  UPDATE public.matches
  SET
    host_pix_key = nullif(trim(p_host_pix_key), ''),
    updated_at = now()
  WHERE id = p_match_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_match_host_pix(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_match_host_pix(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_match_host_pix(uuid, uuid, text) TO service_role;
