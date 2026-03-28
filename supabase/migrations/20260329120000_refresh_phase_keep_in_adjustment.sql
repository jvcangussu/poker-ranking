-- Em in_adjustment, quando um jogador reenvia após desbloqueio individual,
-- todos voltam a ter submitted_for_review_at preenchido. A função antiga
-- promovia a partida para in_review como na fase inicial — reabrindo o
-- fluxo para todos. Em ajuste, o status só deve sair por ação do dono
-- (validar, reabrir todos, etc.).

CREATE OR REPLACE FUNCTION public.refresh_match_submission_phase(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total int;
  v_submitted int;
  v_current text;
BEGIN
  SELECT m.status INTO v_current FROM public.matches m WHERE m.id = p_match_id;

  IF v_current IS NULL OR v_current NOT IN ('open', 'in_review', 'in_adjustment') THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_total FROM public.match_entries WHERE match_id = p_match_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT count(*)::int
  INTO v_submitted
  FROM public.match_entries
  WHERE match_id = p_match_id AND submitted_for_review_at IS NOT NULL;

  IF v_submitted = v_total AND v_total > 0 THEN
    UPDATE public.matches
    SET status = 'in_review', updated_at = now()
    WHERE id = p_match_id AND status = 'open';
  END IF;
END;
$function$;
