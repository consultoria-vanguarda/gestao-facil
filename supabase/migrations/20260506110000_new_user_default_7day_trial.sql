-- Novos usuários entram com trial de 7 dias na organização criada automaticamente.
-- Mantém o restante do fluxo de provisionamento inalterado.

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
    INSERT INTO public.organizations (
      name,
      owner_user_id,
      billing_email,
      subscription_status,
      subscription_plan,
      subscription_current_period_end,
      read_only_reason
    )
    VALUES (
      COALESCE(NULLIF(provided_business_name, ''), normalized_email, 'Nova organização'),
      NEW.id,
      normalized_email,
      'trialing',
      'trial_7_days',
      NOW() + INTERVAL '7 days',
      NULL
    )
    RETURNING id INTO resolved_org_id;

    INSERT INTO public.organization_settings (organization_id)
    VALUES (resolved_org_id)
    ON CONFLICT (organization_id) DO NOTHING;
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

  RETURN NEW;
END;
$$;
