-- Alinha status de despesa com a UI financeira (to_pay | paid).
-- O trigger legado convertia to_pay→pending e paid→reimbursed, quebrando
-- a baixa e filtros na lista de despesas (incluindo imposto do Simples).

CREATE OR REPLACE FUNCTION public.expense_before_insupd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Compatibilidade: o seed usa `due_date`; alguns forms usam `date`.
  IF NEW.date IS NULL AND NEW.due_date IS NOT NULL THEN
    NEW.date := NEW.due_date;
  ELSIF NEW.due_date IS NULL AND NEW.date IS NOT NULL THEN
    NEW.due_date := NEW.date;
  END IF;

  -- Normaliza status legado para o contrato atual da UI financeira.
  IF NEW.status = 'pending' THEN
    NEW.status := 'to_pay';
  ELSIF NEW.status IN ('reimbursed', 'approved') THEN
    NEW.status := 'paid';
  END IF;

  RETURN NEW;
END;
$$;

-- Migra registros existentes para o status canônico.
UPDATE public.expense
SET status = 'to_pay',
    updated_date = NOW()
WHERE status = 'pending';

UPDATE public.expense
SET status = 'paid',
    updated_date = NOW()
WHERE status IN ('reimbursed', 'approved');
