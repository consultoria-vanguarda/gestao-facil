-- Em URLs como *.vercel.app o primeiro segmento do host vira derived_slug (ex.: gestao-facil-okgf).
-- Quando o cliente envia fallback_slug (?slug=app / ?tenant=app), esse valor deve prevalecer
-- sobre o slug derivado do hostname, senão pode haver match errado ou confusão na ordem.

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
      WHEN fallback_slug IS NOT NULL AND o.slug = fallback_slug THEN 0
      WHEN o.custom_domain IS NOT NULL AND lower(o.custom_domain) = normalized_host THEN 1
      WHEN derived_slug IS NOT NULL AND o.slug = derived_slug THEN 2
      ELSE 3
    END
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(TEXT, TEXT) TO anon, authenticated;
