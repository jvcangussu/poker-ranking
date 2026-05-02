-- profit é coluna gerada: não pode ser atualizada manualmente.
-- Reajuste automático só em «in_adjustment» (após validação que não fechou).

CREATE OR REPLACE FUNCTION public.apply_host_auto_balance_cashouts(
  p_match_id uuid,
  p_actor_player_id uuid,
  p_updates jsonb
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
  v_buy_sum numeric;
  v_new_cash_sum numeric;
  v_old_cash_sum numeric;
  v_elem jsonb;
  v_pid uuid;
  v_cash numeric;
  v_chips jsonb;
  v_sum_cents numeric;
  v_computed numeric;
  v_k text;
  v_v text;
  v_pending int;
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
    RAISE EXCEPTION 'Apenas o dono da partida ou um administrador do grupo pode aplicar o reajuste automático.';
  END IF;

  IF v_status <> 'in_adjustment' THEN
    RAISE EXCEPTION 'Reajuste automático só com a partida «Em ajuste» (após validar valores sem fechar o total).';
  END IF;

  SELECT count(*)::int
  INTO v_pending
  FROM public.match_entries me
  WHERE me.match_id = p_match_id
    AND me.submitted_for_review_at IS NULL;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Todos precisam ter enviado para análise antes de reajustar.';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' OR jsonb_array_length(p_updates) = 0 THEN
    RAISE EXCEPTION 'Lista de atualizações inválida.';
  END IF;

  SELECT coalesce(sum(me.buy_in), 0), coalesce(sum(me.cash_out), 0)
  INTO v_buy_sum, v_old_cash_sum
  FROM public.match_entries me
  WHERE me.match_id = p_match_id;

  IF abs(round(v_buy_sum::numeric, 2) - round(v_old_cash_sum::numeric, 2)) <= 0.02 THEN
    RAISE EXCEPTION 'Os totais já fecharam; não há o que reajustar.';
  END IF;

  v_new_cash_sum := 0;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    IF v_elem->>'player_id' IS NULL OR v_elem->>'cash_out' IS NULL THEN
      RAISE EXCEPTION 'Cada item precisa de player_id e cash_out.';
    END IF;

    v_pid := (v_elem->>'player_id')::uuid;
    v_cash := (v_elem->>'cash_out')::numeric;
    v_chips := coalesce(v_elem->'chip_counts', '{}'::jsonb);

    IF v_cash IS NULL OR v_cash < 0 THEN
      RAISE EXCEPTION 'Cash-out inválido para o jogador %.', v_pid;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.match_entries me
      WHERE me.match_id = p_match_id
        AND me.player_id = v_pid
        AND round(me.cash_out::numeric, 2) > 0
    ) THEN
      RAISE EXCEPTION
        'Atualização só é permitida para quem tem repasse (cash-out > 0): %.',
        v_pid;
    END IF;

    v_sum_cents := 0;
    FOR v_k, v_v IN SELECT * FROM jsonb_each_text(v_chips)
    LOOP
      IF v_v IS NOT NULL AND trim(v_v) <> '' THEN
        v_sum_cents := v_sum_cents + (trim(v_k)::numeric * trim(v_v)::numeric);
      END IF;
    END LOOP;

    v_computed := round(v_sum_cents / 100.0, 2);

    IF abs(round(v_computed::numeric, 2) - round(v_cash::numeric, 2)) > 0.02 THEN
      RAISE EXCEPTION 'Fichas não conferem com o cash-out informado (jogador %).', v_pid;
    END IF;

    v_new_cash_sum := v_new_cash_sum + round(v_cash::numeric, 2);
  END LOOP;

  v_new_cash_sum := v_new_cash_sum + coalesce((
    SELECT sum(round(me.cash_out::numeric, 2))
    FROM public.match_entries me
    WHERE me.match_id = p_match_id
      AND round(me.cash_out::numeric, 2) <= 0
  ), 0);

  IF abs(round(v_new_cash_sum::numeric, 2) - round(v_buy_sum::numeric, 2)) > 0.02 THEN
    RAISE EXCEPTION
      'Soma dos novos cash-outs (%) não fecha com buy-ins (%).',
      v_new_cash_sum,
      v_buy_sum;
  END IF;

  IF (
    SELECT count(*)::int
    FROM public.match_entries me
    WHERE me.match_id = p_match_id
      AND round(me.cash_out::numeric, 2) > 0
  ) <> jsonb_array_length(p_updates) THEN
    RAISE EXCEPTION 'Inclua exatamente um registro por jogador com repasse.';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_pid := (v_elem->>'player_id')::uuid;
    v_cash := (v_elem->>'cash_out')::numeric;
    v_chips := coalesce(v_elem->'chip_counts', '{}'::jsonb);

    UPDATE public.match_entries me
    SET
      cash_out = round(v_cash::numeric, 2),
      cash_out_chip_counts = NULLIF(v_chips, '{}'::jsonb),
      updated_at = now()
    WHERE me.match_id = p_match_id AND me.player_id = v_pid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participante não encontrado: %.', v_pid;
    END IF;
  END LOOP;
END;
$function$;
