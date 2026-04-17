-- Tenant settings e resolução de tenant por domínio/subdomínio.

CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id UUID PRIMARY KEY
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.resolve_tenant_by_host(
  input_host TEXT,
  fallback_slug TEXT DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_custom_domain TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_host TEXT;
  host_parts TEXT[];
  derived_slug TEXT;
BEGIN
  normalized_host := lower(trim(COALESCE(input_host, '')));
  IF normalized_host = '' THEN
    RETURN;
  END IF;

  IF normalized_host NOT IN ('localhost', '127.0.0.1', '::1') THEN
    host_parts := regexp_split_to_array(normalized_host, '\.');
    IF array_length(host_parts, 1) >= 3 THEN
      derived_slug := host_parts[1];
    END IF;
  END IF;

  IF fallback_slug IS NOT NULL AND trim(fallback_slug) <> '' THEN
    fallback_slug := lower(trim(fallback_slug));
  ELSE
    fallback_slug := NULL;
  END IF;

  RETURN QUERY
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
  WHERE
    (o.custom_domain IS NOT NULL AND lower(o.custom_domain) = normalized_host)
    OR (derived_slug IS NOT NULL AND o.slug = derived_slug)
    OR (fallback_slug IS NOT NULL AND o.slug = fallback_slug)
  ORDER BY
    CASE
      WHEN o.custom_domain IS NOT NULL AND lower(o.custom_domain) = normalized_host THEN 1
      WHEN derived_slug IS NOT NULL AND o.slug = derived_slug THEN 2
      WHEN fallback_slug IS NOT NULL AND o.slug = fallback_slug THEN 3
      ELSE 4
    END
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(TEXT, TEXT) TO anon, authenticated;

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_settings_select_own ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_update_admin ON public.organization_settings;

CREATE POLICY organization_settings_select_own
ON public.organization_settings
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_organization_id());

CREATE POLICY organization_settings_update_admin
ON public.organization_settings
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
);
