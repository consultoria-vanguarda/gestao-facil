ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS max_hours_per_day NUMERIC(5, 2) DEFAULT 8;

COMMENT ON COLUMN public.project.max_hours_per_day IS
  'Limite máximo de horas por dia de atendimento para distribuição da agenda';
