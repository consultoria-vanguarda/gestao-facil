-- Multi-tenant por organization_id.
-- Estratégia inicial:
-- 1) cria organizations
-- 2) adiciona organization_id nas tabelas de domínio
-- 3) move todos os dados atuais para a org padrão "vanguarda"
-- 4) recria o provisionamento de profiles via auth.users usando organization_slug
-- 5) aplica trigger para preencher organization_id automaticamente nos inserts
-- 6) habilita RLS por tenant

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ======================================================================
-- Organizations
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_slug_format_chk
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS organizations_slug_idx
  ON public.organizations (slug);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_custom_domain_unique_idx
  ON public.organizations (custom_domain)
  WHERE custom_domain IS NOT NULL;

INSERT INTO public.organizations (name, slug, custom_domain)
VALUES ('Vanguarda', 'vanguarda', NULL)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

-- ======================================================================
-- organization_id em profiles e tabelas de domínio
-- ======================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.consultant
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.client
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.project_schedule
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.task
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.document
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.time_entry
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.expense
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.message
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.project_receivable
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.project_payable
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.service_report
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.service_model
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.service_area_config
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_account
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.account_transaction
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.tax_rate
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.billing_entry
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.tax_expense_entry
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS profiles_organization_id_idx
  ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS consultant_organization_id_idx
  ON public.consultant (organization_id);
CREATE INDEX IF NOT EXISTS client_organization_id_idx
  ON public.client (organization_id);
CREATE INDEX IF NOT EXISTS project_organization_id_idx
  ON public.project (organization_id);
CREATE INDEX IF NOT EXISTS project_schedule_organization_id_idx
  ON public.project_schedule (organization_id);
CREATE INDEX IF NOT EXISTS task_organization_id_idx
  ON public.task (organization_id);
CREATE INDEX IF NOT EXISTS document_organization_id_idx
  ON public.document (organization_id);
CREATE INDEX IF NOT EXISTS time_entry_organization_id_idx
  ON public.time_entry (organization_id);
CREATE INDEX IF NOT EXISTS expense_organization_id_idx
  ON public.expense (organization_id);
CREATE INDEX IF NOT EXISTS message_organization_id_idx
  ON public.message (organization_id);
CREATE INDEX IF NOT EXISTS project_receivable_organization_id_idx
  ON public.project_receivable (organization_id);
CREATE INDEX IF NOT EXISTS project_payable_organization_id_idx
  ON public.project_payable (organization_id);
CREATE INDEX IF NOT EXISTS service_report_organization_id_idx
  ON public.service_report (organization_id);
CREATE INDEX IF NOT EXISTS service_model_organization_id_idx
  ON public.service_model (organization_id);
CREATE INDEX IF NOT EXISTS service_area_config_organization_id_idx
  ON public.service_area_config (organization_id);
CREATE INDEX IF NOT EXISTS financial_account_organization_id_idx
  ON public.financial_account (organization_id);
CREATE INDEX IF NOT EXISTS account_transaction_organization_id_idx
  ON public.account_transaction (organization_id);
CREATE INDEX IF NOT EXISTS chart_of_accounts_organization_id_idx
  ON public.chart_of_accounts (organization_id);
CREATE INDEX IF NOT EXISTS tax_rate_organization_id_idx
  ON public.tax_rate (organization_id);
CREATE INDEX IF NOT EXISTS billing_entry_organization_id_idx
  ON public.billing_entry (organization_id);
CREATE INDEX IF NOT EXISTS tax_expense_entry_organization_id_idx
  ON public.tax_expense_entry (organization_id);

-- ======================================================================
-- Backfill inicial para a organização vanguarda
-- ======================================================================

DO $$
DECLARE
  vanguarda_org_id UUID;
BEGIN
  SELECT id INTO vanguarda_org_id
  FROM public.organizations
  WHERE slug = 'vanguarda';

  UPDATE public.profiles SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.consultant SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.client SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.project SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.project_schedule SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.task SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.document SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.time_entry SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.expense SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.message SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.project_receivable SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.project_payable SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.service_report SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.service_model SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.service_area_config SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.financial_account SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.account_transaction SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.chart_of_accounts SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.tax_rate SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.billing_entry SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
  UPDATE public.tax_expense_entry SET organization_id = vanguarda_org_id WHERE organization_id IS NULL;
END $$;

-- Reconcilia auth.users -> profiles (compatível com coluna opcional business_name NOT NULL)
DO $$
DECLARE
  has_business_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_name'
  ) INTO has_business_name;

  IF has_business_name THEN
    INSERT INTO public.profiles (
      id, email, full_name, business_name, user_type, consultant_id, client_id, organization_id
    )
    SELECT
      u.id,
      u.email,
      COALESCE(c.name, cl.company_name, u.email),
      COALESCE(cl.company_name, c.name, u.email, 'Conta sem nome'),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE 'admin'
      END,
      c.id,
      cl.id,
      org.id
    FROM auth.users u
    LEFT JOIN public.consultant c ON c.email = u.email
    LEFT JOIN public.client cl ON cl.email = u.email
    CROSS JOIN LATERAL (
      SELECT id FROM public.organizations WHERE slug = 'vanguarda'
    ) org
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      business_name = COALESCE(NULLIF(TRIM(public.profiles.business_name), ''), EXCLUDED.business_name),
      user_type = EXCLUDED.user_type,
      consultant_id = EXCLUDED.consultant_id,
      client_id = EXCLUDED.client_id,
      organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id);
  ELSE
    INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, organization_id)
    SELECT
      u.id,
      u.email,
      COALESCE(c.name, cl.company_name, u.email),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE 'admin'
      END,
      c.id,
      cl.id,
      org.id
    FROM auth.users u
    LEFT JOIN public.consultant c ON c.email = u.email
    LEFT JOIN public.client cl ON cl.email = u.email
    CROSS JOIN LATERAL (
      SELECT id FROM public.organizations WHERE slug = 'vanguarda'
    ) org
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      user_type = EXCLUDED.user_type,
      consultant_id = EXCLUDED.consultant_id,
      client_id = EXCLUDED.client_id,
      organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id);
  END IF;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.consultant
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.client
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.project
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.project_schedule
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.task
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.document
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.time_entry
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.expense
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.message
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.project_receivable
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.project_payable
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.service_report
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.service_model
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.service_area_config
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.financial_account
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.account_transaction
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.chart_of_accounts
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tax_rate
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.billing_entry
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tax_expense_entry
  ALTER COLUMN organization_id SET NOT NULL;

-- ======================================================================
-- Helpers de tenant / RLS
-- ======================================================================

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_organization_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.slug
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.user_type FROM public.profiles p WHERE p.id = auth.uid()), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_consultant_id()
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.consultant_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.assign_current_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_org_id UUID;
BEGIN
  current_org_id := public.current_user_organization_id();

  IF TG_OP = 'INSERT' THEN
    IF current_org_id IS NULL AND NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Usuário autenticado sem organization_id no profile.';
    ELSIF NEW.organization_id IS NULL THEN
      NEW.organization_id := current_org_id;
    ELSIF current_org_id IS NOT NULL AND NEW.organization_id <> current_org_id THEN
      RAISE EXCEPTION 'organization_id inválido para o tenant atual.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'organization_id não pode ser alterado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_org_id UUID;
  resolved_org_slug TEXT;
  c public.consultant%ROWTYPE;
  cl public.client%ROWTYPE;
  has_business_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_name'
  ) INTO has_business_name;

  resolved_org_slug := lower(trim(COALESCE(
    NEW.raw_user_meta_data->>'organization_slug',
    NEW.raw_app_meta_data->>'organization_slug'
  )));

  IF resolved_org_slug IS NULL OR resolved_org_slug = '' THEN
    RAISE EXCEPTION 'organization_slug é obrigatório para provisionar novos usuários.';
  END IF;

  SELECT o.id
    INTO resolved_org_id
  FROM public.organizations o
  WHERE o.slug = resolved_org_slug
  LIMIT 1;

  IF resolved_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_slug "%" não encontrado.', resolved_org_slug;
  END IF;

  SELECT *
    INTO c
  FROM public.consultant
  WHERE email = NEW.email
    AND organization_id = resolved_org_id
  LIMIT 1;

  SELECT *
    INTO cl
  FROM public.client
  WHERE email = NEW.email
    AND organization_id = resolved_org_id
  LIMIT 1;

  IF has_business_name THEN
    INSERT INTO public.profiles (
      id, email, full_name, business_name, user_type, consultant_id, client_id, organization_id
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(c.name, cl.company_name, NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(cl.company_name, c.name, NEW.email, 'Conta sem nome'),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE COALESCE(NEW.raw_user_meta_data->>'user_type', 'admin')
      END,
      c.id,
      cl.id,
      resolved_org_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      business_name = COALESCE(NULLIF(TRIM(public.profiles.business_name), ''), EXCLUDED.business_name),
      user_type = EXCLUDED.user_type,
      consultant_id = EXCLUDED.consultant_id,
      client_id = EXCLUDED.client_id,
      organization_id = EXCLUDED.organization_id;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, organization_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(c.name, cl.company_name, NEW.raw_user_meta_data->>'full_name', NEW.email),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE COALESCE(NEW.raw_user_meta_data->>'user_type', 'admin')
      END,
      c.id,
      cl.id,
      resolved_org_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      user_type = EXCLUDED.user_type,
      consultant_id = EXCLUDED.consultant_id,
      client_id = EXCLUDED.client_id,
      organization_id = EXCLUDED.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS trg_set_org_consultant ON public.consultant;
CREATE TRIGGER trg_set_org_consultant
BEFORE INSERT OR UPDATE ON public.consultant
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_client ON public.client;
CREATE TRIGGER trg_set_org_client
BEFORE INSERT OR UPDATE ON public.client
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_project ON public.project;
CREATE TRIGGER trg_set_org_project
BEFORE INSERT OR UPDATE ON public.project
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_project_schedule ON public.project_schedule;
CREATE TRIGGER trg_set_org_project_schedule
BEFORE INSERT OR UPDATE ON public.project_schedule
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_task ON public.task;
CREATE TRIGGER trg_set_org_task
BEFORE INSERT OR UPDATE ON public.task
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_document ON public.document;
CREATE TRIGGER trg_set_org_document
BEFORE INSERT OR UPDATE ON public.document
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_time_entry ON public.time_entry;
CREATE TRIGGER trg_set_org_time_entry
BEFORE INSERT OR UPDATE ON public.time_entry
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_expense ON public.expense;
CREATE TRIGGER trg_set_org_expense
BEFORE INSERT OR UPDATE ON public.expense
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_message ON public.message;
CREATE TRIGGER trg_set_org_message
BEFORE INSERT OR UPDATE ON public.message
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_project_receivable ON public.project_receivable;
CREATE TRIGGER trg_set_org_project_receivable
BEFORE INSERT OR UPDATE ON public.project_receivable
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_project_payable ON public.project_payable;
CREATE TRIGGER trg_set_org_project_payable
BEFORE INSERT OR UPDATE ON public.project_payable
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_service_report ON public.service_report;
CREATE TRIGGER trg_set_org_service_report
BEFORE INSERT OR UPDATE ON public.service_report
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_service_model ON public.service_model;
CREATE TRIGGER trg_set_org_service_model
BEFORE INSERT OR UPDATE ON public.service_model
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_service_area_config ON public.service_area_config;
CREATE TRIGGER trg_set_org_service_area_config
BEFORE INSERT OR UPDATE ON public.service_area_config
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_financial_account ON public.financial_account;
CREATE TRIGGER trg_set_org_financial_account
BEFORE INSERT OR UPDATE ON public.financial_account
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_account_transaction ON public.account_transaction;
CREATE TRIGGER trg_set_org_account_transaction
BEFORE INSERT OR UPDATE ON public.account_transaction
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_chart_of_accounts ON public.chart_of_accounts;
CREATE TRIGGER trg_set_org_chart_of_accounts
BEFORE INSERT OR UPDATE ON public.chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_tax_rate ON public.tax_rate;
CREATE TRIGGER trg_set_org_tax_rate
BEFORE INSERT OR UPDATE ON public.tax_rate
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_billing_entry ON public.billing_entry;
CREATE TRIGGER trg_set_org_billing_entry
BEFORE INSERT OR UPDATE ON public.billing_entry
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_tax_expense_entry ON public.tax_expense_entry;
CREATE TRIGGER trg_set_org_tax_expense_entry
BEFORE INSERT OR UPDATE ON public.tax_expense_entry
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

-- ======================================================================
-- RLS por tenant
-- ======================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'consultant',
    'client',
    'project',
    'project_schedule',
    'task',
    'document',
    'time_entry',
    'expense',
    'message',
    'project_receivable',
    'project_payable',
    'service_report',
    'service_model',
    'service_area_config',
    'financial_account',
    'account_transaction',
    'chart_of_accounts',
    'tax_rate',
    'billing_entry',
    'tax_expense_entry'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tenant_table);

    EXECUTE format('DROP POLICY IF EXISTS tenant_select ON public.%I', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON public.%I', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update ON public.%I', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete ON public.%I', tenant_table);

    EXECUTE format(
      'CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (organization_id = public.current_user_organization_id())',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_organization_id())',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.current_user_organization_id()) WITH CHECK (organization_id = public.current_user_organization_id())',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (organization_id = public.current_user_organization_id())',
      tenant_table
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;

CREATE POLICY organizations_select_own
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.current_user_organization_id());

CREATE POLICY organizations_update_admin
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
)
WITH CHECK (
  id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
);

DROP POLICY IF EXISTS profiles_select_self_or_org_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_org_admin ON public.profiles;

CREATE POLICY profiles_select_self_or_org_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
);

CREATE POLICY profiles_update_self_or_org_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  AND (
    id = auth.uid()
    OR public.current_user_type() = 'admin'
  )
);
