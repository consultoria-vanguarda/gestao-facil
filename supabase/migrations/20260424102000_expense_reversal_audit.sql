-- Auditoria de reversão de despesa paga.
-- Esses campos são preenchidos automaticamente no ato da reversão.

ALTER TABLE public.expense
  ADD COLUMN IF NOT EXISTS reversal_requested_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reversal_requested_by_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS reversal_requested_by_id UUID NULL;
