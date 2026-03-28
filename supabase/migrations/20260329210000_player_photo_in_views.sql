-- Expõe foto do perfil (players.photo_url) nas views usadas pelo app.

DROP VIEW IF EXISTS public.v_match_summary CASCADE;
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
  me.host_confirmed_paid_at,
  p.photo_url AS player_photo_url
FROM public.match_entries me
JOIN public.matches m ON m.id = me.match_id
JOIN public.groups g ON g.id = m.group_id
JOIN public.players p ON p.id = me.player_id;

CREATE VIEW public.v_match_summary AS
SELECT
  m.id AS match_id,
  m.group_id,
  g.code AS group_code,
  g.name AS group_name,
  m.created_by_player_id,
  cp.name AS created_by_player_name,
  cp.photo_url AS created_by_photo_url,
  m.status,
  m.notes,
  m.played_at,
  (count(me.id))::integer AS total_entries,
  (COALESCE(sum(me.buy_in), (0)::numeric))::numeric(12, 2) AS total_buy_in,
  (COALESCE(sum(me.cash_out), (0)::numeric))::numeric(12, 2) AS total_cash_out,
  (COALESCE(sum(me.profit), (0)::numeric))::numeric(12, 2) AS total_profit_balance,
  m.host_pix_key,
  m.max_buy_in
FROM public.matches m
JOIN public.groups g ON g.id = m.group_id
JOIN public.players cp ON cp.id = m.created_by_player_id
LEFT JOIN public.match_entries me ON me.match_id = m.id
GROUP BY
  m.id,
  m.group_id,
  g.code,
  g.name,
  m.created_by_player_id,
  cp.name,
  cp.photo_url,
  m.status,
  m.notes,
  m.played_at,
  m.host_pix_key,
  m.max_buy_in;
