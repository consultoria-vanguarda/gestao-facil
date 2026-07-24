-- Limpa dados operacionais de um tenant (por slug).
-- Preserva: organização, organization_settings, usuários (profiles + auth.users),
--           configs de seed (plano de contas padrão, áreas, viabilidade)
--           e arquivos no storage (não há limpeza de buckets aqui).
--
-- Uso no SQL Editor do Supabase:
--   1. Revise o slug abaixo (padrão: vanguarda)
--   2. Execute o script inteiro
--
-- ATENÇÃO: operação irreversível nos dados operacionais. Faça backup antes em produção.

BEGIN;

SET session_replication_role = replica;

DO $$
DECLARE
  target_slug TEXT := 'vanguarda';
  target_org_id UUID;
  tenant_table TEXT;
  deleted_count BIGINT;
BEGIN
  SELECT id INTO target_org_id
  FROM public.organizations
  WHERE slug = target_slug;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "%" não encontrado em public.organizations.', target_slug;
  END IF;

  RAISE NOTICE 'Limpando dados operacionais do tenant "%" (id=%)...', target_slug, target_org_id;
  RAISE NOTICE 'Preservando usuários, organization_settings, configs de seed e arquivos de storage.';

  -- Desvincula profiles antes de apagar consultant/client (profiles são preservados).
  UPDATE public.profiles
  SET consultant_id = NULL, client_id = NULL
  WHERE organization_id = target_org_id;

  FOREACH tenant_table IN ARRAY ARRAY[
    'tax_expense_entry',
    'billing_entry',
    'account_transaction',
    'expense',
    'message',
    'service_report',
    'task',
    'document',
    'time_entry',
    'project_receivable',
    'project_payable',
    'project_schedule',
    'project',
    'tax_rate',
    'financial_account',
    'service_model',
    'consultant',
    'client'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tenant_table
        AND column_name = 'organization_id'
    ) THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE organization_id = $1',
        tenant_table
      ) USING target_org_id;

      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE '  %: % linha(s) removida(s)', tenant_table, deleted_count;
    END IF;
  END LOOP;

  -- Plano de contas: mantém contas padrão de seed (is_default = true).
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chart_of_accounts'
      AND column_name = 'is_default'
  ) THEN
    DELETE FROM public.chart_of_accounts
    WHERE organization_id = target_org_id
      AND COALESCE(is_default, FALSE) = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '  chart_of_accounts (não-padrão): % linha(s) removida(s)', deleted_count;
  ELSE
    DELETE FROM public.chart_of_accounts
    WHERE organization_id = target_org_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '  chart_of_accounts: % linha(s) removida(s)', deleted_count;
  END IF;

  -- Garante plano de contas padrão se o tenant ainda não tiver (ou perdeu is_default).
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'seed_default_chart_of_accounts'
  ) THEN
    deleted_count := public.seed_default_chart_of_accounts(target_org_id);
    IF deleted_count > 0 THEN
      RAISE NOTICE '  chart_of_accounts (seed padrão): % conta(s) inserida(s)', deleted_count;
    ELSE
      RAISE NOTICE '  chart_of_accounts padrão: preservado';
    END IF;
  END IF;

  RAISE NOTICE '  service_area_config: preservado (seed)';
  RAISE NOTICE '  viability_cost_config: preservado (seed)';

  DELETE FROM public.organization_subscription_events
  WHERE organization_id = target_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '  organization_subscription_events: % linha(s) removida(s)', deleted_count;

  RAISE NOTICE 'Tenant "%" limpo. Usuários e configuração da org preservados.', target_slug;
END $$;

SET session_replication_role = origin;

COMMIT;
