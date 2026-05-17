-- Limite de dias de atendimento por semana (norma: não consecutivos)
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS max_work_days_per_week INTEGER
  CHECK (max_work_days_per_week IS NULL OR max_work_days_per_week IN (2, 3));

COMMENT ON COLUMN public.project.max_work_days_per_week IS
  'Máximo de dias de atendimento do consultor por semana (2 ou 3). A geração de agenda evita dias consecutivos.';

UPDATE public.project
SET max_work_days_per_week = 3
WHERE max_work_days_per_week IS NULL;
