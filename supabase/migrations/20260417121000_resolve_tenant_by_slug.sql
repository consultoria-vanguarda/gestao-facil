-- Resolução direta por slug (URL ?slug= / ?tenant= ou VITE_DEFAULT_TENANT_SLUG).
-- Evita depender apenas de resolve_tenant_by_host quando o hostname é ambíguo (ex.: *.vercel.app).

CREATE OR REPLACE FUNCTION public.resolve_tenant_by_slug(p_slug TEXT)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_custom_domain TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.custom_domain,
    s.primary_color,
    s.secondary_color,
    s.logo_url
  FROM public.organizations o
  LEFT JOIN public.organization_settings s
    ON s.organization_id = o.id
  WHERE p_slug IS NOT NULL
    AND trim(p_slug) <> ''
    AND o.slug = lower(trim(p_slug))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_slug(TEXT) TO anon, authenticated;
