-- Expõe created_at na view de resumo para permitir filtros de ranking por
-- semana/mês sem depender de acesso direto à tabela base.

DROP VIEW IF EXISTS public.v_match_summary CASCADE;

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
  m.created_at,
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
  m.created_at,
  m.played_at,
  m.host_pix_key,
  m.max_buy_in;
