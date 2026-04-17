-- Execução manual (SQL Editor no Supabase) se a migration ainda não foi aplicada.
-- Cria o tenant `app` usado pelo SaaS admin e pela URL ?slug=app / ?tenant=app

INSERT INTO public.organizations (name, slug, custom_domain)
VALUES ('Plataforma SaaS', 'app', NULL)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.organization_settings (organization_id)
SELECT o.id
FROM public.organizations o
WHERE o.slug = 'app'
ON CONFLICT (organization_id) DO NOTHING;

-- Confirme:
-- SELECT id, name, slug FROM public.organizations WHERE slug = 'app';
