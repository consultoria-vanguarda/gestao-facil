import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { setCurrentOrganizationAccess, setCurrentOrganizationId } from '@/lib/organizationScope';

const TenantContext = createContext(null);

const buildOrganizationNotFoundError = () => ({
  type: 'organization_not_found',
  message: 'Organização não encontrada para este usuário.',
});

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);
  const hasInitializedRef = useRef(false);
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadTenantForSession = async (session, { showLoadingScreen = false } = {}) => {
      if (showLoadingScreen) {
        setIsLoadingTenant(true);
      }
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

        // Perfil pode demorar alguns ms após sign-up (trigger handle_new_auth_user).
        let orgId = null;
        const profileAttempts = 4;
        for (let attempt = 0; attempt < profileAttempts; attempt++) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', userId)
            .maybeSingle();
          if (profileError) throw profileError;
          orgId = profile?.organization_id ?? null;
          if (orgId) break;
          if (attempt < profileAttempts - 1) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }

        if (!orgId) {
          if (!cancelled) {
            setTenant(null);
            setSettings(null);
            setOrganizationId(null);
            setSubscription(null);
            setTenantError(buildOrganizationNotFoundError());
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
            setTenantError(buildOrganizationNotFoundError());
          }
          return;
        }

        const { data: orgSettings, error: settingsError } = await supabase
          .from('organization_settings')
          .select('primary_color, secondary_color, logo_url, project_draft_template')
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
          type: 'organization_load_failed',
          message: error?.message || 'Falha ao carregar organização.',
        });
      } finally {
        if (!cancelled) {
          if (showLoadingScreen) {
            setIsLoadingTenant(false);
          }
          hasInitializedRef.current = Boolean(session?.user?.id);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void loadTenantForSession(data?.session ?? null, { showLoadingScreen: true });
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Renovação de token ao voltar à aba — não recarregar organização.
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      const nextUserId = session?.user?.id ?? null;

      if (!session) {
        currentUserIdRef.current = null;
        hasInitializedRef.current = false;
        void loadTenantForSession(null);
        return;
      }

      // SIGNED_IN/INITIAL_SESSION repetidos ao focar a janela (sync entre abas).
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        hasInitializedRef.current &&
        currentUserIdRef.current === nextUserId
      ) {
        return;
      }

      currentUserIdRef.current = nextUserId;
      const showLoadingScreen = !hasInitializedRef.current;
      void loadTenantForSession(session, { showLoadingScreen });
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
