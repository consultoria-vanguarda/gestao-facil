-- Escopo de tenant para viability_cost_config.

ALTER TABLE public.viability_cost_config
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE
  vanguarda_org_id UUID;
BEGIN
  SELECT id INTO vanguarda_org_id
  FROM public.organizations
  WHERE slug = 'vanguarda';

  UPDATE public.viability_cost_config
  SET organization_id = vanguarda_org_id
  WHERE organization_id IS NULL;
END $$;

ALTER TABLE public.viability_cost_config
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS viability_cost_config_organization_id_idx
  ON public.viability_cost_config (organization_id);

DROP TRIGGER IF EXISTS trg_set_org_viability_cost_config ON public.viability_cost_config;
CREATE TRIGGER trg_set_org_viability_cost_config
BEFORE INSERT OR UPDATE ON public.viability_cost_config
FOR EACH ROW EXECUTE FUNCTION public.assign_current_organization_id();

ALTER TABLE public.viability_cost_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viability_cost_config_select ON public.viability_cost_config;
DROP POLICY IF EXISTS viability_cost_config_admin_write ON public.viability_cost_config;
DROP POLICY IF EXISTS viability_cost_config_tenant_select ON public.viability_cost_config;
DROP POLICY IF EXISTS viability_cost_config_tenant_admin_write ON public.viability_cost_config;

CREATE POLICY viability_cost_config_tenant_select
ON public.viability_cost_config
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  AND public.current_user_type() IN ('admin', 'consultant')
);

CREATE POLICY viability_cost_config_tenant_admin_write
ON public.viability_cost_config
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  AND public.current_user_type() = 'admin'
);
