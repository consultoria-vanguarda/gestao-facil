-- O singleton por tenant deve usar id = UUID da organização sem hífenes (32 chars),
-- como em getViabilityCostConfigRowId(). Linhas antigas ficavam com viability_cost_cfg_row_*.

UPDATE public.viability_cost_config v
SET id = lower(regexp_replace(v.organization_id::text, '-', '', 'g'))
WHERE v.organization_id IS NOT NULL;
