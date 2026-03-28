-- A constraint de status às vezes foi criada como `matches_status_chk` (ex.: SQL Editor / outro deploy).
-- A migração 20260328240000 só removia `matches_status_check`, deixando a antiga ativa e bloqueando in_review+.

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_chk;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check CHECK (
    status IN (
      'open',
      'in_review',
      'in_adjustment',
      'in_payment',
      'closed'
    )
  );
