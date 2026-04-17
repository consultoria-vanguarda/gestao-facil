-- Tenant padrão de plataforma para administração SaaS.
-- Objetivo: usar `app` como slug central do SaaS admin.

INSERT INTO public.organizations (name, slug, custom_domain)
VALUES ('Plataforma SaaS', 'app', NULL)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.organization_settings (organization_id)
SELECT o.id
FROM public.organizations o
WHERE o.slug = 'app'
ON CONFLICT (organization_id) DO NOTHING;

DO $$
DECLARE
  app_org_id UUID;
BEGIN
  SELECT id
    INTO app_org_id
  FROM public.organizations
  WHERE slug = 'app'
  LIMIT 1;

  IF app_org_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao localizar a organização app.';
  END IF;

  -- Garante que o perfil saas_admin opere no tenant "app".
  UPDATE public.profiles
  SET organization_id = app_org_id
  WHERE user_type = 'saas_admin'
    AND organization_id IS DISTINCT FROM app_org_id;

  -- Alinha metadata dos usuários auth para provisionamentos/automação futura.
  UPDATE auth.users u
  SET
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('organization_slug', 'app'),
    raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('organization_slug', 'app')
  FROM public.profiles p
  WHERE p.id = u.id
    AND p.user_type = 'saas_admin';
END $$;

