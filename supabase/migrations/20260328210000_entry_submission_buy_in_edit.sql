-- Coluna de envio para análise + edição/remoção de eventos de buy-in + RPCs.

ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.sync_match_entry_buy_in_from_events(
  p_match_id uuid,
  p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sum numeric(12, 2);
BEGIN
  SELECT COALESCE(SUM(e.amount), 0)::numeric(12, 2)
  INTO v_sum
  FROM public.match_buy_in_events e
  WHERE e.match_id = p_match_id AND e.player_id = p_player_id;

  UPDATE public.match_entries me
  SET
    buy_in = v_sum,
    updated_at = now()
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo.';
  END IF;

  SELECT
    e.match_id,
    e.player_id,
    m.status,
    m.max_buy_in,
    me.submitted_for_review_at
  INTO v_match_id, v_player_id, v_status, v_max, v_submitted
  FROM public.match_buy_in_events e
  JOIN public.matches m ON m.id = e.match_id
  JOIN public.match_entries me
    ON me.match_id = e.match_id AND me.player_id = e.player_id
  WHERE e.id = p_event_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Evento de buy-in não encontrado.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
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
BEGIN
  SELECT e.match_id, e.player_id, m.status, me.submitted_for_review_at
  INTO v_match_id, v_player_id, v_status, v_submitted
  FROM public.match_buy_in_events e
  JOIN public.matches m ON m.id = e.match_id
  JOIN public.match_entries me
    ON me.match_id = e.match_id AND me.player_id = e.player_id
  WHERE e.id = p_event_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Evento de buy-in não encontrado.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
  END IF;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para editar os buy-ins.';
  END IF;

  DELETE FROM public.match_buy_in_events e WHERE e.id = p_event_id;

  PERFORM public.sync_match_entry_buy_in_from_events(v_match_id, v_player_id);
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
  v_entry_id uuid;
BEGIN
  IF p_cash_out IS NULL OR p_cash_out < 0 THEN
    RAISE EXCEPTION 'Cash-out inválido.';
  END IF;

  SELECT m.status INTO v_status FROM public.matches m WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
  END IF;

  UPDATE public.match_entries me
  SET
    cash_out = p_cash_out,
    submitted_for_review_at = now(),
    updated_at = now()
  WHERE me.match_id = p_match_id
    AND me.player_id = p_player_id
    AND me.submitted_for_review_at IS NULL
  RETURNING me.id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'Participante não encontrado ou envio já realizado.';
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
  v_updated int;
BEGIN
  SELECT m.status INTO v_status FROM public.matches m WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
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
BEGIN
  SELECT me.submitted_for_review_at INTO v_submitted
  FROM public.match_entries me
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Sua entrada foi enviada para análise. Reabra para editar.';
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo.';
  END IF;

  SELECT m.status, m.max_buy_in INTO v_status, v_max
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
  END IF;

  IF v_max IS NOT NULL AND p_amount > v_max THEN
    RAISE EXCEPTION 'O valor excede o buy-in máximo permitido nesta partida (%).', v_max;
  END IF;

  SELECT me.submitted_for_review_at INTO v_submitted
  FROM public.match_entries me
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;

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

CREATE OR REPLACE VIEW public.v_match_entries_detailed AS
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
  me.submitted_for_review_at
FROM public.match_entries me
JOIN public.matches m ON m.id = me.match_id
JOIN public.groups g ON g.id = m.group_id
JOIN public.players p ON p.id = me.player_id;

-- PostgREST só expõe RPCs que o papel da API pode executar.
GRANT EXECUTE ON FUNCTION public.submit_match_entry_for_review(uuid, uuid, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_match_entry_for_editing(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_match_buy_in_event(uuid, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_match_buy_in_event(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_match_entry_buy_in_from_events(uuid, uuid) TO anon, authenticated, service_role;
