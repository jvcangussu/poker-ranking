-- Dependência explícita de create_group_with_admin + garantia da RPC no PostgREST.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remover dependente antes do helper (evita erro ao trocar tipo de retorno).
DROP FUNCTION IF EXISTS public.create_group_with_admin(text, text, text);
DROP FUNCTION IF EXISTS public.create_group_with_admin(text, text, text, text);
DROP FUNCTION IF EXISTS public.generate_unique_group_code();

CREATE OR REPLACE FUNCTION public.generate_unique_group_code()
RETURNS character varying(6)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code varchar(6);
  attempt int := 0;
BEGIN
  LOOP
    v_code := lower(substr(md5(random()::text || clock_timestamp()::text || attempt::text), 1, 6));
    IF NOT EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE lower(btrim(g.code::text)) = v_code
    ) THEN
      RETURN v_code;
    END IF;
    attempt := attempt + 1;
    IF attempt > 400 THEN
      RAISE EXCEPTION 'Não foi possível gerar código de grupo único';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_unique_group_code() IS 'Gera código único de 6 caracteres para public.groups.code.';

CREATE OR REPLACE FUNCTION public.create_group_with_admin(
  p_group_name text,
  p_group_password text,
  p_admin_password text,
  p_admin_player_name text
)
RETURNS TABLE(
  group_id uuid,
  group_code character varying,
  group_name text,
  admin_player_id uuid,
  admin_player_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_group_id uuid;
  v_group_code varchar(6);
  v_admin_player_id uuid;
BEGIN
  IF p_group_name IS NULL OR length(trim(p_group_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  IF p_group_password IS NULL OR length(trim(p_group_password)) < 4 THEN
    RAISE EXCEPTION 'Group password must have at least 4 characters';
  END IF;

  IF p_admin_password IS NULL OR length(trim(p_admin_password)) < 4 THEN
    RAISE EXCEPTION 'Admin password must have at least 4 characters';
  END IF;

  IF p_admin_player_name IS NULL OR length(trim(p_admin_player_name)) = 0 THEN
    RAISE EXCEPTION 'Admin player name is required';
  END IF;

  v_group_code := public.generate_unique_group_code();

  INSERT INTO public.groups (code, name, password_hash, admin_password_hash)
  VALUES (
    v_group_code,
    trim(p_group_name),
    crypt(p_group_password, gen_salt('bf')),
    crypt(trim(p_admin_password), gen_salt('bf'))
  )
  RETURNING id INTO v_group_id;

  INSERT INTO public.players (group_id, name, is_admin)
  VALUES (v_group_id, trim(p_admin_player_name), true)
  RETURNING id INTO v_admin_player_id;

  RETURN QUERY
  SELECT
    v_group_id,
    v_group_code,
    trim(p_group_name),
    v_admin_player_id,
    trim(p_admin_player_name);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
