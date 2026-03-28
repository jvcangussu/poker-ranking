-- Ciclo de vida da partida: open → in_review → in_adjustment|in_payment → closed
-- + colunas de desbloqueio em ajuste e confirmação de pagamento pelo dono.

ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS adjustment_resubmit_unlocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS host_confirmed_paid_at timestamp with time zone;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_chk;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check CHECK (
    status IN (
      'open',
      'in_review',
      'in_adjustment',
      'in_payment',
      'closed'
    )
  );

CREATE OR REPLACE FUNCTION public.match_allows_financial_edit(p_status text, p_unlocked boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $f$
  SELECT p_status IN ('open', 'in_review')
    OR (p_status = 'in_adjustment' AND p_unlocked);
$f$;

CREATE OR REPLACE FUNCTION public.refresh_match_submission_phase(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total int;
  v_submitted int;
  v_current text;
BEGIN
  SELECT m.status INTO v_current FROM public.matches m WHERE m.id = p_match_id;

  IF v_current IS NULL OR v_current NOT IN ('open', 'in_review', 'in_adjustment') THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_total FROM public.match_entries WHERE match_id = p_match_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT count(*)::int
  INTO v_submitted
  FROM public.match_entries
  WHERE match_id = p_match_id AND submitted_for_review_at IS NOT NULL;

  IF v_submitted = v_total AND v_total > 0 THEN
    UPDATE public.matches
    SET status = 'in_review', updated_at = now()
    WHERE id = p_match_id AND status IN ('open', 'in_adjustment');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.downgrade_match_if_not_all_submitted(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total int;
  v_submitted int;
  v_current text;
BEGIN
  SELECT m.status INTO v_current FROM public.matches m WHERE m.id = p_match_id;
  IF v_current IS NULL OR v_current NOT IN ('in_review') THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_total FROM public.match_entries WHERE match_id = p_match_id;
  SELECT count(*)::int
  INTO v_submitted
  FROM public.match_entries
  WHERE match_id = p_match_id AND submitted_for_review_at IS NOT NULL;

  IF v_submitted < v_total THEN
    UPDATE public.matches
    SET status = 'open', updated_at = now()
    WHERE id = p_match_id AND status = 'in_review';
  END IF;
END;
$function$;

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

  PERFORM public.refresh_match_submission_phase(p_match_id);

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

CREATE OR REPLACE FUNCTION public.reopen_match_entry_for_editing(
  p_match_id uuid,
  p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status text;
  v_unlocked boolean;
  v_updated int;
BEGIN
  SELECT m.status, me.adjustment_resubmit_unlocked
  INTO v_status, v_unlocked
  FROM public.matches m
  JOIN public.match_entries me ON me.match_id = m.id AND me.player_id = p_player_id
  WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível reabrir a análise agora.';
  END IF;

  IF v_status IN ('in_payment', 'closed') THEN
    RAISE EXCEPTION 'A partida não permite alterações agora.';
  END IF;

  UPDATE public.match_entries me
  SET
    submitted_for_review_at = NULL,
    updated_at = now()
  WHERE me.match_id = p_match_id
    AND me.player_id = p_player_id
    AND me.submitted_for_review_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Nada para reabrir ou entrada não encontrada.';
  END IF;

  PERFORM public.downgrade_match_if_not_all_submitted(p_match_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_match_entry(
  p_match_id uuid,
  p_player_id uuid,
  p_buy_in numeric,
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
  v_entry_id uuid;
  v_submitted timestamptz;
  v_status text;
  v_unlocked boolean;
  v_exists boolean;
BEGIN
  SELECT me.submitted_for_review_at, m.status, me.adjustment_resubmit_unlocked
  INTO v_submitted, v_status, v_unlocked
  FROM public.match_entries me
  JOIN public.matches m ON m.id = me.match_id
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;

  v_exists := FOUND;

  IF v_exists AND v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Sua entrada foi enviada para análise. Reabra para editar.';
  END IF;

  IF v_exists AND NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível alterar a entrada neste momento.';
  END IF;

  IF NOT v_exists THEN
    SELECT m.status INTO v_status FROM public.matches m WHERE m.id = p_match_id;
    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Partida não encontrada.';
    END IF;
    IF v_status NOT IN ('open', 'in_review') THEN
      RAISE EXCEPTION 'Novos participantes só podem entrar com a partida aberta ou em análise.';
    END IF;
  END IF;

  INSERT INTO public.match_entries (
    match_id,
    player_id,
    buy_in,
    cash_out
  )
  VALUES (
    p_match_id,
    p_player_id,
    coalesce(p_buy_in, 0),
    coalesce(p_cash_out, 0)
  )
  ON CONFLICT ON CONSTRAINT match_entries_unique_match_player
  DO UPDATE SET
    buy_in = public.match_entries.buy_in,
    cash_out = excluded.cash_out,
    updated_at = now()
  RETURNING public.match_entries.id INTO v_entry_id;

  PERFORM public.refresh_match_submission_phase(p_match_id);

  RETURN QUERY
  SELECT
    me.id AS entry_id,
    me.match_id AS match_id,
    me.player_id AS player_id,
    me.buy_in AS buy_in,
    me.cash_out AS cash_out,
    me.profit AS profit
  FROM public.match_entries me
  WHERE me.id = v_entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_match_buy_in(
  p_match_id uuid,
  p_player_id uuid,
  p_amount numeric
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
  v_max numeric;
  v_status text;
  v_entry_id uuid;
  v_submitted timestamptz;
  v_unlocked boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo.';
  END IF;

  SELECT m.status, m.max_buy_in, me.submitted_for_review_at, me.adjustment_resubmit_unlocked
  INTO v_status, v_max, v_submitted, v_unlocked
  FROM public.matches m
  JOIN public.match_entries me ON me.match_id = m.id AND me.player_id = p_player_id
  WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível adicionar buy-in agora.';
  END IF;

  IF v_status IN ('in_payment', 'closed') THEN
    RAISE EXCEPTION 'A partida não permite alterações agora.';
  END IF;

  IF v_max IS NOT NULL AND p_amount > v_max THEN
    RAISE EXCEPTION 'O valor excede o buy-in máximo permitido nesta partida (%).', v_max;
  END IF;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para adicionar buy-in.';
  END IF;

  INSERT INTO public.match_buy_in_events (match_id, player_id, amount)
  VALUES (p_match_id, p_player_id, p_amount);

  UPDATE public.match_entries me
  SET
    buy_in = me.buy_in + p_amount,
    updated_at = now()
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id
  RETURNING me.id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Participante não encontrado nesta partida.';
  END IF;

  RETURN QUERY
  SELECT
    me.id,
    me.match_id,
    me.player_id,
    me.buy_in,
    me.cash_out,
    me.profit
  FROM public.match_entries me
  WHERE me.id = v_entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_match_buy_in_event(
  p_event_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_match_id uuid;
  v_player_id uuid;
  v_status text;
  v_max numeric;
  v_submitted timestamptz;
  v_unlocked boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo.';
  END IF;

  SELECT
    e.match_id,
    e.player_id,
    m.status,
    m.max_buy_in,
    me.submitted_for_review_at,
    me.adjustment_resubmit_unlocked
  INTO v_match_id, v_player_id, v_status, v_max, v_submitted, v_unlocked
  FROM public.match_buy_in_events e
  JOIN public.matches m ON m.id = e.match_id
  JOIN public.match_entries me
    ON me.match_id = e.match_id AND me.player_id = e.player_id
  WHERE e.id = p_event_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Evento de buy-in não encontrado.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível editar buy-in agora.';
  END IF;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para editar os buy-ins.';
  END IF;

  IF v_max IS NOT NULL AND p_amount > v_max THEN
    RAISE EXCEPTION 'O valor excede o buy-in máximo permitido nesta partida (%).', v_max;
  END IF;

  UPDATE public.match_buy_in_events e
  SET amount = p_amount
  WHERE e.id = p_event_id;

  PERFORM public.sync_match_entry_buy_in_from_events(v_match_id, v_player_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_match_buy_in_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_match_id uuid;
  v_player_id uuid;
  v_status text;
  v_submitted timestamptz;
  v_unlocked boolean;
BEGIN
  SELECT e.match_id, e.player_id, m.status, me.submitted_for_review_at, me.adjustment_resubmit_unlocked
  INTO v_match_id, v_player_id, v_status, v_submitted, v_unlocked
  FROM public.match_buy_in_events e
  JOIN public.matches m ON m.id = e.match_id
  JOIN public.match_entries me
    ON me.match_id = e.match_id AND me.player_id = e.player_id
  WHERE e.id = p_event_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Evento de buy-in não encontrado.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível remover buy-in agora.';
  END IF;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para editar os buy-ins.';
  END IF;

  DELETE FROM public.match_buy_in_events e WHERE e.id = p_event_id;

  PERFORM public.sync_match_entry_buy_in_from_events(v_match_id, v_player_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_match_entry_cash_out_chips(
  p_match_id uuid,
  p_player_id uuid,
  p_cash_out numeric,
  p_chip_counts jsonb
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
  v_submitted timestamptz;
  v_status text;
  v_unlocked boolean;
  v_entry_id uuid;
  v_computed numeric;
  r record;
  v_sum_cents numeric;
BEGIN
  IF p_cash_out IS NULL OR p_cash_out < 0 THEN
    RAISE EXCEPTION 'Cash-out inválido.';
  END IF;

  SELECT me.submitted_for_review_at, m.status, me.adjustment_resubmit_unlocked
  INTO v_submitted, v_status, v_unlocked
  FROM public.match_entries me
  JOIN public.matches m ON m.id = me.match_id
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para editar o cash-out.';
  END IF;

  IF NOT public.match_allows_financial_edit(v_status, v_unlocked) THEN
    RAISE EXCEPTION 'Não é possível alterar o cash-out agora.';
  END IF;

  IF v_status IN ('in_payment', 'closed') THEN
    RAISE EXCEPTION 'A partida não permite alterações agora.';
  END IF;

  v_sum_cents := 0;

  FOR r IN SELECT * FROM jsonb_each_text(COALESCE(p_chip_counts, '{}'::jsonb))
  LOOP
    IF r.value IS NOT NULL AND trim(r.value) <> '' THEN
      v_sum_cents := v_sum_cents + (trim(r.key)::numeric * trim(r.value)::numeric);
    END IF;
  END LOOP;

  v_computed := round(v_sum_cents / 100.0, 2);

  IF abs(round(v_computed::numeric, 2) - round(p_cash_out::numeric, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Total das fichas não confere com o cash-out informado.';
  END IF;

  UPDATE public.match_entries me
  SET
    cash_out = p_cash_out,
    cash_out_chip_counts = NULLIF(p_chip_counts, '{}'::jsonb),
    updated_at = now()
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id
  RETURNING me.id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Participante não encontrado nesta partida.';
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

  IF v_status <> 'in_review' THEN
    RAISE EXCEPTION 'Validação só está disponível com a partida em análise.';
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
  v_status text;
BEGIN
  SELECT m.created_by_player_id, m.status
  INTO v_creator, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_creator <> p_actor_player_id THEN
    RAISE EXCEPTION 'Apenas o criador da partida pode reabrir as análises.';
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
  v_status text;
  v_updated int;
BEGIN
  SELECT m.created_by_player_id, m.status
  INTO v_creator, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_creator <> p_actor_player_id THEN
    RAISE EXCEPTION 'Apenas o criador pode desbloquear jogadores.';
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
  v_status text;
  v_updated int;
BEGIN
  SELECT m.created_by_player_id, m.status
  INTO v_creator, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_creator <> p_actor_player_id THEN
    RAISE EXCEPTION 'Apenas o criador pode marcar pagamentos.';
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
  v_status text;
  v_pending int;
BEGIN
  SELECT m.created_by_player_id, m.status
  INTO v_creator, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_creator <> p_actor_player_id THEN
    RAISE EXCEPTION 'Apenas o criador pode finalizar a partida.';
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

DROP FUNCTION IF EXISTS public.close_match(uuid);

CREATE OR REPLACE FUNCTION public.close_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'Use finalize_match após a fase de pagamento.';
END;
$function$;

DROP VIEW IF EXISTS public.v_match_entries_detailed CASCADE;

CREATE VIEW public.v_match_entries_detailed AS
SELECT
  me.id AS entry_id,
  me.match_id,
  m.group_id,
  g.code AS group_code,
  p.id AS player_id,
  p.name AS player_name,
  p.is_admin,
  me.buy_in,
  me.cash_out,
  me.profit,
  m.status AS match_status,
  m.played_at,
  m.notes,
  p.pix_key AS player_pix_key,
  me.submitted_for_review_at,
  me.cash_out_chip_counts,
  me.adjustment_resubmit_unlocked,
  me.host_confirmed_paid_at
FROM public.match_entries me
JOIN public.matches m ON m.id = me.match_id
JOIN public.groups g ON g.id = m.group_id
JOIN public.players p ON p.id = me.player_id;

GRANT EXECUTE ON FUNCTION public.downgrade_match_if_not_all_submitted(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_match_submission_phase(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_allows_financial_edit(text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_validate_match_totals(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_reopen_all_analyses(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_unlock_player_resubmit(uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_set_player_paid(uuid, uuid, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_match(uuid, uuid) TO anon, authenticated, service_role;
