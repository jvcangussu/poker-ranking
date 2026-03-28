-- Preserva a combinação exata de fichas no cash-out (evita recomposição gulosa no front).

ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS cash_out_chip_counts jsonb;

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
  v_entry_id uuid;
  v_sum_cents numeric;
  v_computed numeric;
  r record;
BEGIN
  IF p_cash_out IS NULL OR p_cash_out < 0 THEN
    RAISE EXCEPTION 'Cash-out inválido.';
  END IF;

  SELECT me.submitted_for_review_at INTO v_submitted
  FROM public.match_entries me
  WHERE me.match_id = p_match_id AND me.player_id = p_player_id;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Reabra sua entrada para editar o cash-out.';
  END IF;

  SELECT m.status INTO v_status FROM public.matches m WHERE m.id = p_match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'A partida não está aberta.';
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

GRANT EXECUTE ON FUNCTION public.set_match_entry_cash_out_chips(uuid, uuid, numeric, jsonb) TO anon, authenticated, service_role;

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
  me.submitted_for_review_at,
  me.cash_out_chip_counts
FROM public.match_entries me
JOIN public.matches m ON m.id = me.match_id
JOIN public.groups g ON g.id = m.group_id
JOIN public.players p ON p.id = me.player_id;
