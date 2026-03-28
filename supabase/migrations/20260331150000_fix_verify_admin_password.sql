-- Corrige verify_group_access (lógica explícita; evita edge cases com crypt).
-- update_group_admin_password passa a retornar void (PostgREST/JS lida melhor que boolean).

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
  WHERE g.code = p_group_code
    AND p.name = p_player_name;
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

GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_group_access(character varying, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_admin_password(uuid, text) TO service_role;
