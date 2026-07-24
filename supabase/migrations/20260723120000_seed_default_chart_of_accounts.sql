-- Plano de contas padrão (consultoria / Simples Nacional) para todos os tenants.
-- Fonte: estrutura de DRE para empresa de consultoria empresarial.
-- Contas com is_default = true não podem ser editadas/excluídas na UI.

CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_organization_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
  now_ts TIMESTAMP := NOW();
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório para seed do plano de contas.';
  END IF;

  -- Idempotente: só popula se o tenant ainda não tiver contas padrão.
  IF EXISTS (
    SELECT 1
    FROM public.chart_of_accounts
    WHERE organization_id = p_organization_id
      AND COALESCE(is_default, FALSE) = TRUE
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.chart_of_accounts (
    id, created_date, updated_date, created_by,
    code, name, type, category, active, is_default, organization_id
  )
  VALUES
    -- 3. RECEITAS OPERACIONAIS / Receita Bruta de Serviços
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '3.1.01', 'Receita de Consultoria Empresarial', 'revenue',
     'Receita Bruta de Serviços', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '3.1.02', 'Receita de Treinamentos e Palestras', 'revenue',
     'Receita Bruta de Serviços', TRUE, TRUE, p_organization_id),

    -- 3.2 Deduções da Receita Bruta
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '3.2.01', 'Imposto Unificado - DAS (Simples Nacional)', 'expense',
     'Deduções da Receita Bruta', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '3.2.02', 'Cancelamentos de Contratos / Abatimentos', 'expense',
     'Deduções da Receita Bruta', TRUE, TRUE, p_organization_id),

    -- 4. CUSTOS DOS SERVIÇOS PRESTADOS (CSP)
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '4.1.01', 'Subcontratação de Consultores (Pessoas Jurídicas)', 'expense',
     'Custos Diretos com Serviços', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '4.1.02', 'Ferramentas e Softwares Específicos de Projetos', 'expense',
     'Custos Diretos com Serviços', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '4.1.03', 'Deslocamentos e Viagens Reembolsáveis de Projetos', 'expense',
     'Custos Diretos com Serviços', TRUE, TRUE, p_organization_id),

    -- 5.1 Despesas com Vendas e Marketing
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.1.01', 'Comissões sobre Vendas de Projetos', 'expense',
     'Despesas com Vendas e Marketing', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.1.02', 'Anúncios Online (Google Ads, Meta) e Site', 'expense',
     'Despesas com Vendas e Marketing', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.1.03', 'Softwares de CRM e Automação de Marketing', 'expense',
     'Despesas com Vendas e Marketing', TRUE, TRUE, p_organization_id),

    -- 5.2 Despesas Administrativas
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.2.01', 'Pró-Labore dos Sócios e Encargos (INSS)', 'expense',
     'Despesas Administrativas', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.2.02', 'Salários e Benefícios da Equipe Interna', 'expense',
     'Despesas Administrativas', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.2.03', 'Honorários Contábeis e Jurídicos', 'expense',
     'Despesas Administrativas', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.2.04', 'Aluguel de Escritório ou Coworking', 'expense',
     'Despesas Administrativas', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '5.2.05', 'Internet, Sistemas de Gestão e Telefonia', 'expense',
     'Despesas Administrativas', TRUE, TRUE, p_organization_id),

    -- 6. RESULTADO FINANCEIRO
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '6.1.01', 'Rendimentos de Aplicações Financeiras', 'revenue',
     'Receitas Financeiras', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '6.2.01', 'Tarifas Bancárias e Taxas de Cartão', 'expense',
     'Despesas Financeiras', TRUE, TRUE, p_organization_id),
    (replace(gen_random_uuid()::text, '-', ''), now_ts, now_ts, 'system',
     '6.2.02', 'Juros e Multas Pagas', 'expense',
     'Despesas Financeiras', TRUE, TRUE, p_organization_id);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.seed_default_chart_of_accounts(UUID) IS
  'Insere o plano de contas padrão (consultoria / Simples Nacional) para um tenant. Idempotente se já houver is_default.';

GRANT EXECUTE ON FUNCTION public.seed_default_chart_of_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_chart_of_accounts(UUID) TO service_role;

-- ======================================================================
-- Provisionamento: novos tenants recebem o plano de contas padrão
-- ======================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_org_id UUID;
  provided_org_id UUID;
  provided_business_name TEXT;
  normalized_email TEXT;
  new_org_slug TEXT;
  created_new_org BOOLEAN := FALSE;
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

  normalized_email := lower(trim(COALESCE(NEW.email, '')));
  provided_business_name := trim(COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'organization_name',
    NEW.raw_user_meta_data->>'full_name',
    normalized_email
  ));

  provided_org_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;

  IF provided_org_id IS NOT NULL THEN
    SELECT o.id
      INTO resolved_org_id
    FROM public.organizations o
    WHERE o.id = provided_org_id
    LIMIT 1;
  END IF;

  IF resolved_org_id IS NULL THEN
    new_org_slug := 'org-' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.organizations (
      name,
      slug,
      owner_user_id,
      billing_email,
      subscription_status,
      subscription_plan,
      subscription_current_period_end,
      read_only_reason
    )
    VALUES (
      COALESCE(NULLIF(provided_business_name, ''), normalized_email, 'Nova organização'),
      new_org_slug,
      NEW.id,
      normalized_email,
      'trialing',
      'trial_7_days',
      NOW() + INTERVAL '7 days',
      NULL
    )
    RETURNING id INTO resolved_org_id;

    created_new_org := TRUE;

    INSERT INTO public.organization_settings (organization_id)
    VALUES (resolved_org_id)
    ON CONFLICT (organization_id) DO NOTHING;

    -- Plano de contas padrão para o novo tenant
    PERFORM public.seed_default_chart_of_accounts(resolved_org_id);
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
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), c.name, cl.company_name, NEW.email),
      COALESCE(NULLIF(provided_business_name, ''), NEW.email, 'Conta sem nome'),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'user_type'), ''), 'admin')
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
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), c.name, cl.company_name, NEW.email),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'user_type'), ''), 'admin')
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

  UPDATE public.organizations
  SET owner_user_id = COALESCE(owner_user_id, NEW.id)
  WHERE id = resolved_org_id;

  -- Garante seed mesmo se o tenant já existia sem plano de contas (ex.: invite)
  IF NOT created_new_org THEN
    PERFORM public.seed_default_chart_of_accounts(resolved_org_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- Backfill: tenants existentes sem contas padrão
-- ======================================================================

DO $$
DECLARE
  org_rec RECORD;
  total_inserted INTEGER := 0;
  n INTEGER;
BEGIN
  FOR org_rec IN
    SELECT o.id, o.slug
    FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.chart_of_accounts c
      WHERE c.organization_id = o.id
        AND COALESCE(c.is_default, FALSE) = TRUE
    )
  LOOP
    n := public.seed_default_chart_of_accounts(org_rec.id);
    total_inserted := total_inserted + n;
    IF n > 0 THEN
      RAISE NOTICE 'Plano de contas padrão: % conta(s) para org %', n, org_rec.slug;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill plano de contas: % conta(s) inseridas no total', total_inserted;
END $$;
