import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { setCurrentOrganizationAccess, setCurrentOrganizationId } from '@/lib/organizationScope';

const TenantContext = createContext(null);

const buildTenantNotFoundError = () => ({
  type: 'tenant_not_found',
  message: 'Organização não encontrada para este usuário.',
});

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadTenantForSession = async (session) => {
      setIsLoadingTenant(true);
      setTenantError(null);

      try {
        const userId = session?.user?.id;
        if (!userId) {
          if (!cancelled) {
            setTenant(null);
            setSettings(null);
            setOrganizationId(null);
            setSubscription(null);
            setTenantError(null);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;

        const orgId = profile?.organization_id;
        if (!orgId) {
          if (!cancelled) {
            setTenant(null);
            setSettings(null);
            setOrganizationId(null);
            setSubscription(null);
            setTenantError(buildTenantNotFoundError());
          }
          return;
        }

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select(`
            id,
            name,
            subscription_status,
            subscription_plan,
            subscription_current_period_end,
            read_only_reason
          `)
          .eq('id', orgId)
          .maybeSingle();
        if (orgError) throw orgError;
        if (!org) {
          if (!cancelled) {
            setTenant(null);
            setSettings(null);
            setOrganizationId(null);
            setSubscription(null);
            setTenantError(buildTenantNotFoundError());
          }
          return;
        }

        const { data: orgSettings, error: settingsError } = await supabase
          .from('organization_settings')
          .select('primary_color, secondary_color, logo_url')
          .eq('organization_id', orgId)
          .maybeSingle();
        if (settingsError) throw settingsError;

        setTenant({
          id: org.id,
          name: org.name,
        });
        setSettings(orgSettings || null);
        setOrganizationId(org.id);
        setSubscription({
          status: org.subscription_status || 'inactive',
          plan: org.subscription_plan || null,
          currentPeriodEnd: org.subscription_current_period_end || null,
          readOnlyReason: org.read_only_reason || null,
          isActive: ['trialing', 'active'].includes(String(org.subscription_status || '').toLowerCase()),
        });
      } catch (error) {
        if (cancelled) return;
        setTenant(null);
        setSettings(null);
        setOrganizationId(null);
        setSubscription(null);
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

    supabase.auth.getSession().then(({ data }) => {
      void loadTenantForSession(data?.session ?? null);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadTenantForSession(session);
    });

    return () => {
      cancelled = true;
      authSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCurrentOrganizationId(organizationId);
  }, [organizationId]);

  useEffect(() => {
    setCurrentOrganizationAccess({
      writable: !subscription || subscription.isActive,
      reason: subscription?.readOnlyReason || null,
    });
  }, [subscription]);

  const withTenantFilter = (filters = {}) => {
    if (!organizationId) return { ...filters };
    return { ...filters, organization_id: organizationId };
  };

  const value = useMemo(
    () => ({
      tenant,
      settings,
      organizationId,
      subscription,
      isLoadingTenant,
      tenantError,
      withTenantFilter,
    }),
    [tenant, settings, organizationId, subscription, isLoadingTenant, tenantError]
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
