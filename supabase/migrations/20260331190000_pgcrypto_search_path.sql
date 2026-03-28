-- pgcrypto (crypt/gen_salt) fica no schema extensions no Supabase.
-- Com SET search_path = public só, a execução da RPC falha com gen_salt(unknown) e o PostgREST devolve 404.

ALTER FUNCTION public.create_group_with_admin(text, text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.verify_group_access(character varying, text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.update_group_admin_password(uuid, text) SET search_path = public, extensions;

NOTIFY pgrst, 'reload schema';
