-- Defesa em profundidade: mesmo que refresh_match_submission_phase antiga
-- ainda esteja no banco, o envio na fase de ajuste não deve disparar a
-- promoção para in_review (que libera reabrir para todos).

CREATE OR REPLACE FUNCTION public.submit_match_entry_for_review(
  p_match_id uuid,
  p_player_id uuid,
  p_cash_out numeric
)
RETURNS TABLE(
  entry_id uuid,
  match_id uuid,
  player_id uuid,
  buy_in numeric,
  cash_out numeric,
  profit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status text;
  v_unlocked boolean;
  v_entry_id uuid;
BEGIN
  IF p_cash_out IS NULL OR p_cash_out < 0 THEN
    RAISE EXCEPTION 'Cash-out inválido.';
  END IF;

  SELECT m.status, me.adjustment_resubmit_unlocked
  INTO v_status, v_unlocked
  FROM public.matches m
  JOIN public.match_entries me ON me.match_id = m.id AND me.player_id = p_player_id
  WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível enviar a análise neste momento.';
  END IF;

  IF v_status IN ('in_payment', 'closed') THEN
    RAISE EXCEPTION 'A partida não permite alterações agora.';
  END IF;

  UPDATE public.match_entries me
  SET
    cash_out = p_cash_out,
    submitted_for_review_at = now(),
    adjustment_resubmit_unlocked = false,
    updated_at = now()
  WHERE me.match_id = p_match_id
    AND me.player_id = p_player_id
    AND me.submitted_for_review_at IS NULL
  RETURNING me.id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Participante não encontrado ou envio já realizado. Reabra para editar.';
  END IF;

  -- Só sincroniza open → in_review quando ainda não estamos em ajuste.
  IF v_status <> 'in_adjustment' THEN
    PERFORM public.refresh_match_submission_phase(p_match_id);
  END IF;

  RETURN QUERY
  SELECT
    me.id AS entry_id,
    me.match_id,
    me.player_id,
    me.buy_in,
    me.cash_out,
    me.profit
  FROM public.match_entries me
  WHERE me.id = v_entry_id;
END;
$function$;
