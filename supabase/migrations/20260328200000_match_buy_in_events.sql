-- Buy-in máximo por partida + histórico de compras (eventos) + ajustes em RPCs.
-- Aplicar no Supabase (SQL Editor ou CLI) se o projeto ainda não tiver esta migração.

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS max_buy_in numeric(12,2);

CREATE TABLE IF NOT EXISTS public.match_buy_in_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_buy_in_events_match_player
  ON public.match_buy_in_events (match_id, player_id);

ALTER TABLE public.match_buy_in_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can select match_buy_in_events" ON public.match_buy_in_events;
DROP POLICY IF EXISTS "anon can insert match_buy_in_events" ON public.match_buy_in_events;
DROP POLICY IF EXISTS "anon can update match_buy_in_events" ON public.match_buy_in_events;
DROP POLICY IF EXISTS "anon can delete match_buy_in_events" ON public.match_buy_in_events;

CREATE POLICY "anon can select match_buy_in_events" ON public.match_buy_in_events FOR SELECT USING (true);
CREATE POLICY "anon can insert match_buy_in_events" ON public.match_buy_in_events FOR INSERT WITH CHECK (true);
CREATE POLICY "anon can update match_buy_in_events" ON public.match_buy_in_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon can delete match_buy_in_events" ON public.match_buy_in_events FOR DELETE USING (true);

INSERT INTO public.match_buy_in_events (match_id, player_id, amount, created_at)
SELECT me.match_id, me.player_id, me.buy_in, me.created_at
FROM public.match_entries me
WHERE me.buy_in > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.match_buy_in_events e
    WHERE e.match_id = me.match_id AND e.player_id = me.player_id
  );

CREATE OR REPLACE FUNCTION public.log_initial_match_buy_in()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.buy_in > 0 THEN
    INSERT INTO public.match_buy_in_events (match_id, player_id, amount, created_at)
    VALUES (NEW.match_id, NEW.player_id, NEW.buy_in, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_match_entries_log_initial_buy_in ON public.match_entries;
CREATE TRIGGER trg_match_entries_log_initial_buy_in
  AFTER INSERT ON public.match_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.log_initial_match_buy_in();

CREATE OR REPLACE FUNCTION public.upsert_match_entry(p_match_id uuid, p_player_id uuid, p_buy_in numeric, p_cash_out numeric)
 RETURNS TABLE(entry_id uuid, match_id uuid, player_id uuid, buy_in numeric, cash_out numeric, profit numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_entry_id uuid;
begin
  insert into public.match_entries (
    match_id,
    player_id,
    buy_in,
    cash_out
  )
  values (
    p_match_id,
    p_player_id,
    coalesce(p_buy_in, 0),
    coalesce(p_cash_out, 0)
  )
  on conflict on constraint match_entries_unique_match_player
  do update set
    buy_in = public.match_entries.buy_in,
    cash_out = excluded.cash_out,
    updated_at = now()
  returning public.match_entries.id into v_entry_id;

  return query
  select
    me.id as entry_id,
    me.match_id as match_id,
    me.player_id as player_id,
    me.buy_in as buy_in,
    me.cash_out as cash_out,
    me.profit as profit
  from public.match_entries me
  where me.id = v_entry_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_match_buy_in(p_match_id uuid, p_player_id uuid, p_amount numeric)
 RETURNS TABLE(entry_id uuid, match_id uuid, player_id uuid, buy_in numeric, cash_out numeric, profit numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_max numeric;
  v_status text;
  v_entry_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor positivo.';
  end if;

  select m.status, m.max_buy_in into v_status, v_max
  from public.matches m
  where m.id = p_match_id;

  if v_status is null then
    raise exception 'Partida não encontrada.';
  end if;

  if v_status <> 'open' then
    raise exception 'A partida não está aberta.';
  end if;

  if v_max is not null and p_amount > v_max then
    raise exception 'O valor excede o buy-in máximo permitido nesta partida (%).', v_max;
  end if;

  insert into public.match_buy_in_events (match_id, player_id, amount)
  values (p_match_id, p_player_id, p_amount);

  update public.match_entries me
  set
    buy_in = me.buy_in + p_amount,
    updated_at = now()
  where me.match_id = p_match_id and me.player_id = p_player_id
  returning me.id into v_entry_id;

  if v_entry_id is null then
    raise exception 'Participante não encontrado nesta partida.';
  end if;

  return query
  select
    me.id,
    me.match_id,
    me.player_id,
    me.buy_in,
    me.cash_out,
    me.profit
  from public.match_entries me
  where me.id = v_entry_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_match(
  p_group_id uuid,
  p_created_by_player_id uuid,
  p_notes text DEFAULT NULL::text,
  p_played_at timestamp with time zone DEFAULT now(),
  p_host_pix_key text DEFAULT NULL,
  p_max_buy_in numeric DEFAULT NULL
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
    host_pix_key,
    max_buy_in
  )
  values (
    p_group_id,
    p_created_by_player_id,
    p_notes,
    coalesce(p_played_at, now()),
    nullif(trim(p_host_pix_key), ''),
    case
      when p_max_buy_in is null then null
      when p_max_buy_in <= 0 then null
      else p_max_buy_in
    end
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

DROP VIEW IF EXISTS public.v_match_summary CASCADE;

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
    m.host_pix_key,
    m.max_buy_in
   FROM (((matches m
     JOIN groups g ON ((g.id = m.group_id)))
     JOIN players cp ON ((cp.id = m.created_by_player_id)))
     LEFT JOIN match_entries me ON ((me.match_id = m.id)))
  GROUP BY m.id, m.group_id, g.code, g.name, m.created_by_player_id, cp.name, m.status, m.notes, m.played_at, m.host_pix_key, m.max_buy_in;
