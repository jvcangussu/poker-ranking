-- RPCs de leitura pública do grupo (sem expor password_hash / admin_password_hash).
-- O app depende delas na tela de login e em admin/configurações; sem isso o PostgREST retorna erro.

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

GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_code(character varying) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_by_id(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_players_for_group_login(character varying) TO service_role;
