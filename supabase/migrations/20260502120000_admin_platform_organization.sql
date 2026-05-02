-- Organização interna da plataforma (slug `admin`) para administradores SaaS.
-- Vincula admin@vanguarda.com a essa org com user_type = saas_admin.
-- Plano freemium para não bloquear operações administrativas por assinatura.

INSERT INTO public.organizations (
  name,
  slug,
  custom_domain,
  subscription_status,
  subscription_plan,
  subscription_current_period_end,
  read_only_reason
)
VALUES (
  'admin',
  'admin',
  NULL,
  'active',
  'freemium',
  NULL,
  NULL
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  subscription_status = 'active',
  subscription_plan = 'freemium',
  subscription_current_period_end = NULL,
  read_only_reason = NULL;

INSERT INTO public.organization_settings (organization_id)
SELECT o.id
FROM public.organizations o
WHERE o.slug = 'admin'
ON CONFLICT (organization_id) DO NOTHING;

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'admin' LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização admin não encontrada após upsert.';
  END IF;

  UPDATE public.profiles
  SET
    organization_id = v_org_id,
    user_type = 'saas_admin'
  WHERE lower(trim(email)) = lower(trim('admin@vanguarda.com'));

  UPDATE auth.users u
  SET
    raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('organization_slug', 'admin')
  WHERE lower(trim(u.email)) = lower(trim('admin@vanguarda.com'));
END $$;
