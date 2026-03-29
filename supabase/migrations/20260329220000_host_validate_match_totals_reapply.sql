-- Reaplica host_validate_match_totals para ambientes onde a migração
-- 20260329140000 não foi aplicada (validação falhava em in_adjustment com 400).
-- Descompasso buy vs cash NÃO gera erro: apenas segue para in_adjustment ou in_payment.

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
  v_status text;
  v_buy numeric;
  v_cash numeric;
BEGIN
  SELECT m.created_by_player_id, m.status
  INTO v_creator, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_creator <> p_actor_player_id THEN
    RAISE EXCEPTION 'Apenas o criador da partida pode validar os valores.';
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
