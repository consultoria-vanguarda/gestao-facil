import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { getMainLandingUrl, getTenantContext } from '@/lib/tenant';
import { setCurrentOrganizationId } from '@/lib/organizationScope';

const TenantContext = createContext(null);

const buildTenantNotFoundError = () => ({
  type: 'tenant_not_found',
  message: 'Tenant não encontrado para este domínio.',
});

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadTenant = async () => {
      setIsLoadingTenant(true);
      setTenantError(null);

      const { hostname, defaultTenantSlug } = getTenantContext();

      try {
        const { data, error } = await supabase.rpc('resolve_tenant_by_host', {
          input_host: hostname,
          fallback_slug: defaultTenantSlug,
        });

        if (error) throw error;

        const row = data?.[0];
        if (!row) {
          if (!cancelled) {
            setTenant(null);
            setSettings(null);
            setOrganizationId(null);
            setTenantError(buildTenantNotFoundError());
          }
          return;
        }

        if (cancelled) return;

        setTenant({
          id: row.organization_id,
          name: row.organization_name,
          slug: row.organization_slug,
          custom_domain: row.organization_custom_domain,
        });
        setSettings({
          primary_color: row.primary_color ?? null,
          secondary_color: row.secondary_color ?? null,
          logo_url: row.logo_url ?? null,
        });
        setOrganizationId(row.organization_id);
      } catch (error) {
        if (cancelled) return;
        setTenant(null);
        setSettings(null);
        setOrganizationId(null);
        setTenantError({
          type: 'tenant_load_failed',
          message: error?.message || 'Falha ao carregar tenant.',
        });
      } finally {
        if (!cancelled) {
          setIsLoadingTenant(false);
        }
      }
    };

    void loadTenant();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tenantError?.type !== 'tenant_not_found') return;
    const landingUrl = getMainLandingUrl();
    if (!landingUrl) return;
    window.location.replace(landingUrl);
  }, [tenantError]);

  useEffect(() => {
    setCurrentOrganizationId(organizationId);
  }, [organizationId]);

  const withTenantFilter = (filters = {}) => {
    if (!organizationId) return { ...filters };
    return { ...filters, organization_id: organizationId };
  };

  const value = useMemo(
    () => ({
      tenant,
      settings,
      organizationId,
      isLoadingTenant,
      tenantError,
      withTenantFilter,
    }),
    [tenant, settings, organizationId, isLoadingTenant, tenantError]
  );

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
