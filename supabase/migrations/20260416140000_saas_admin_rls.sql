-- Papel global SaaS: user_type = 'saas_admin' em profiles.
-- Permite listar/criar organizações e perfis de qualquer tenant (via RLS).
--
-- Para o restante do schema, o papel efetivo no tenant é o de admin (mesma org),
-- sem precisar repetir OR em todas as policies.

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE p.user_type
        WHEN 'saas_admin' THEN 'admin'
        ELSE p.user_type
      END
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.user_type = 'saas_admin' FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_saas_admin() TO authenticated;

-- organizations
DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_saas ON public.organizations;

CREATE POLICY organizations_select_own
ON public.organizations
FOR SELECT
TO authenticated
USING (
  public.is_saas_admin()
  OR id = public.current_user_organization_id()
);

CREATE POLICY organizations_insert_saas
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (public.is_saas_admin());

CREATE POLICY organizations_update_admin
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  public.is_saas_admin()
  OR (
    id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
)
WITH CHECK (
  public.is_saas_admin()
  OR (
    id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
);

-- organization_settings
DROP POLICY IF EXISTS organization_settings_select_own ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_update_admin ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_insert_saas ON public.organization_settings;

CREATE POLICY organization_settings_select_own
ON public.organization_settings
FOR SELECT
TO authenticated
USING (
  public.is_saas_admin()
  OR organization_id = public.current_user_organization_id()
);

CREATE POLICY organization_settings_insert_saas
ON public.organization_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_saas_admin());

CREATE POLICY organization_settings_update_admin
ON public.organization_settings
FOR UPDATE
TO authenticated
USING (
  public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
)
WITH CHECK (
  public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
);

-- profiles
DROP POLICY IF EXISTS profiles_select_self_or_org_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_org_admin ON public.profiles;

CREATE POLICY profiles_select_self_or_org_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
);

CREATE POLICY profiles_update_self_or_org_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() = 'admin'
  )
)
WITH CHECK (
  public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND (
      id = auth.uid()
      OR public.current_user_type() = 'admin'
    )
  )
);
