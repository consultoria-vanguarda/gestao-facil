-- 1) user_type em maiúsculas no profiles quebrava RLS/comparações (= 'admin').
-- 2) viability_cost_config: SaaS admin pode ler/alterar qualquer tenant (como nas outras policies).
-- 3) INSERT com organization_id de outro tenant só para is_saas_admin(): trigger não bloqueia.

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE lower(trim(COALESCE(p.user_type::text, 'admin')))
        WHEN 'saas_admin' THEN 'admin'
        ELSE lower(trim(COALESCE(p.user_type::text, 'admin')))
      END
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    ),
    'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.assign_current_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_org_id UUID;
BEGIN
  current_org_id := public.current_user_organization_id();

  IF TG_OP = 'INSERT' THEN
    IF current_org_id IS NULL AND NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Usuário autenticado sem organization_id no profile.';
    ELSIF NEW.organization_id IS NULL THEN
      NEW.organization_id := current_org_id;
    ELSIF current_org_id IS NOT NULL AND NEW.organization_id <> current_org_id THEN
      IF NOT public.is_saas_admin() THEN
        RAISE EXCEPTION 'organization_id inválido para o tenant atual.';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'organization_id não pode ser alterado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS viability_cost_config_tenant_select ON public.viability_cost_config;
DROP POLICY IF EXISTS viability_cost_config_tenant_admin_write ON public.viability_cost_config;

CREATE POLICY viability_cost_config_tenant_select
ON public.viability_cost_config
FOR SELECT
TO authenticated
USING (
  public.is_saas_admin()
  OR (
    organization_id = public.current_user_organization_id()
    AND public.current_user_type() IN ('admin', 'consultant')
  )
);

CREATE POLICY viability_cost_config_tenant_admin_write
ON public.viability_cost_config
FOR ALL
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
