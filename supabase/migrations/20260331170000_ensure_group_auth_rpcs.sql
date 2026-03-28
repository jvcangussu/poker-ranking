-- Consolida e garante RPCs de grupo/login no PostgREST (corrige 404 em /rpc/verify_group_access e afins
-- quando migrações anteriores não foram aplicadas no projeto remoto). Idempotente: CREATE OR REPLACE + GRANT.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS admin_password_hash text;

UPDATE public.groups
SET admin_password_hash = password_hash
WHERE admin_password_hash IS NULL;

DROP FUNCTION IF EXISTS public.create_group_with_admin(text, text, text);
DROP FUNCTION IF EXISTS public.verify_group_access(character varying, text, text);

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

CREATE OR REPLACE FUNCTION public.verify_group_access(
  p_group_code character varying,
  p_player_name text,
  p_group_password text,
  p_admin_password text DEFAULT NULL
)
RETURNS TABLE(
  group_id uuid,
  group_code character varying,
  group_name text,
  player_id uuid,
  player_name text,
  is_admin boolean,
  access_granted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.code,
    g.name,
    p.id,
    p.name,
    p.is_admin,
    (
      (g.password_hash = crypt(p_group_password, g.password_hash))
      AND (
        CASE
          WHEN NOT COALESCE(p.is_admin, false) THEN true
          WHEN g.admin_password_hash IS NULL THEN false
          WHEN p_admin_password IS NULL OR length(trim(p_admin_password)) = 0 THEN false
          ELSE g.admin_password_hash = crypt(trim(p_admin_password), g.admin_password_hash)
        END
      )
    ) AS access_granted
  FROM public.groups g
  JOIN public.players p ON p.group_id = g.id
  WHERE lower(btrim(g.code::text)) = lower(btrim(p_group_code::text))
    AND p.name = trim(p_player_name);
END;
$function$;

DROP FUNCTION IF EXISTS public.update_group_admin_password(uuid, text);

CREATE OR REPLACE FUNCTION public.update_group_admin_password(
  p_group_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_new_password IS NULL OR length(trim(p_new_password)) < 4 THEN
    RAISE EXCEPTION 'Password must have at least 4 characters';
  END IF;

  UPDATE public.groups
  SET
    admin_password_hash = crypt(trim(p_new_password), gen_salt('bf')),
    updated_at = now()
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo não encontrado.';
  END IF;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_group_public_by_code(character varying);
DROP FUNCTION IF EXISTS public.get_group_public_by_id(uuid);
DROP FUNCTION IF EXISTS public.list_players_for_group_login(character varying);

CREATE OR REPLACE FUNCTION public.get_group_public_by_code(p_group_code character varying)
RETURNS TABLE(
  id uuid,
  code character varying,
  name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.code, g.name, g.created_at, g.updated_at
  FROM public.groups g
  WHERE lower(btrim(g.code::text)) = lower(btrim(p_group_code::text));
$$;

CREATE OR REPLACE FUNCTION public.get_group_public_by_id(p_group_id uuid)
RETURNS TABLE(
  id uuid,
  code character varying,
  name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.code, g.name, g.created_at, g.updated_at
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.list_players_for_group_login(p_group_code character varying)
RETURNS TABLE(
  id uuid,
  name text,
  is_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.is_admin
  FROM public.groups g
  INNER JOIN public.players p ON p.group_id = g.id
  WHERE lower(btrim(g.code::text)) = lower(btrim(p_group_code::text))
  ORDER BY p.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_with_admin(text, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO service_role;
