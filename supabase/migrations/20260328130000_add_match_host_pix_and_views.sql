-- PIX do organizador na partida + exposição do PIX do jogador na view de entradas.
-- Já aplicado no projeto remoto; mantido para outros ambientes / histórico.

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS host_pix_key text;

CREATE OR REPLACE FUNCTION public.create_match(
  p_group_id uuid,
  p_created_by_player_id uuid,
  p_notes text DEFAULT NULL::text,
  p_played_at timestamp with time zone DEFAULT now(),
  p_host_pix_key text DEFAULT NULL
)
 RETURNS TABLE(match_id uuid, group_id uuid, created_by_player_id uuid, status text, notes text, played_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_match_id uuid;
begin
  insert into public.matches (
    group_id,
    created_by_player_id,
    notes,
    played_at,
    host_pix_key
  )
  values (
    p_group_id,
    p_created_by_player_id,
    p_notes,
    coalesce(p_played_at, now()),
    nullif(trim(p_host_pix_key), '')
  )
  returning id into v_match_id;

  return query
  select
    m.id,
    m.group_id,
    m.created_by_player_id,
    m.status,
    m.notes,
    m.played_at
  from public.matches m
  where m.id = v_match_id;
end;
$function$;

-- CREATE OR REPLACE não pode remover colunas da view se o banco já tiver versão mais nova.
DROP VIEW IF EXISTS public.v_match_summary CASCADE;
DROP VIEW IF EXISTS public.v_match_entries_detailed CASCADE;

CREATE VIEW public.v_match_summary AS
 SELECT m.id AS match_id,
    m.group_id,
    g.code AS group_code,
    g.name AS group_name,
    m.created_by_player_id,
    cp.name AS created_by_player_name,
    m.status,
    m.notes,
    m.played_at,
    (count(me.id))::integer AS total_entries,
    (COALESCE(sum(me.buy_in), (0)::numeric))::numeric(12,2) AS total_buy_in,
    (COALESCE(sum(me.cash_out), (0)::numeric))::numeric(12,2) AS total_cash_out,
    (COALESCE(sum(me.profit), (0)::numeric))::numeric(12,2) AS total_profit_balance,
    m.host_pix_key
   FROM (((matches m
     JOIN groups g ON ((g.id = m.group_id)))
     JOIN players cp ON ((cp.id = m.created_by_player_id)))
     LEFT JOIN match_entries me ON ((me.match_id = m.id)))
  GROUP BY m.id, m.group_id, g.code, g.name, m.created_by_player_id, cp.name, m.status, m.notes, m.played_at, m.host_pix_key;

CREATE VIEW public.v_match_entries_detailed AS
 SELECT me.id AS entry_id,
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
    p.pix_key AS player_pix_key
   FROM (((match_entries me
     JOIN matches m ON ((m.id = me.match_id)))
     JOIN groups g ON ((g.id = m.group_id)))
     JOIN players p ON ((p.id = me.player_id)));
