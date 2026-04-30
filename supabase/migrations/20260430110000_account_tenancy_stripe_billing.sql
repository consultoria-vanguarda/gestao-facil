-- Migração para tenancy orientado a conta + billing Stripe.
-- Remove dependência funcional de slug/domínio no fluxo ativo
-- e adiciona controle de escrita por status de assinatura.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS read_only_reason TEXT,
  ADD COLUMN IF NOT EXISTS stripe_last_event_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'organizations_subscription_status_chk'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_subscription_status_chk
      CHECK (
        subscription_status IN (
          'inactive',
          'trialing',
          'active',
          'past_due',
          'unpaid',
          'canceled',
          'incomplete',
          'incomplete_expired',
          'paused'
        )
      );
  END IF;
END $$;

UPDATE public.organizations
SET
  subscription_status = COALESCE(NULLIF(subscription_status, ''), 'inactive'),
  read_only_reason = COALESCE(read_only_reason, 'subscription_inactive')
WHERE subscription_status IS NULL OR subscription_status = '';

CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx
  ON public.organizations(owner_user_id);

CREATE INDEX IF NOT EXISTS organizations_subscription_status_idx
  ON public.organizations(subscription_status);

CREATE TABLE IF NOT EXISTS public.organization_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_sub_events_organization_id_idx
  ON public.organization_subscription_events(organization_id);

CREATE INDEX IF NOT EXISTS org_sub_events_event_type_idx
  ON public.organization_subscription_events(stripe_event_type);

CREATE OR REPLACE FUNCTION public.current_org_subscription_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = public.current_user_organization_id()
      AND o.subscription_status IN ('trialing', 'active')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_is_read_only()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.current_org_subscription_active();
$$;

GRANT EXECUTE ON FUNCTION public.current_org_subscription_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_is_read_only() TO authenticated;

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
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON public.%I', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update ON public.%I', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete ON public.%I', tenant_table);

    EXECUTE format(
      'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_organization_id() AND public.current_org_subscription_active())',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.current_user_organization_id() AND public.current_org_subscription_active()) WITH CHECK (organization_id = public.current_user_organization_id() AND public.current_org_subscription_active())',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (organization_id = public.current_user_organization_id() AND public.current_org_subscription_active())',
      tenant_table
    );
  END LOOP;
END $$;
