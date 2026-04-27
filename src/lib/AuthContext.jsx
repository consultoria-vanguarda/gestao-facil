import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import { api } from '@/api/appApi';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';
import { storeTenantSlugForSession } from '@/lib/tenant';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { organizationId, isLoadingTenant, tenantError } = useTenant();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (isLoadingTenant) {
      setIsLoadingAuth(true);
      return;
    }

    if (tenantError?.type === 'tenant_not_found') {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setIsLoadingAuth(false);
      return;
    }

    let cancelled = false;

    const syncFromSession = async (session, { showGlobalLoader = false } = {}) => {
      if (!session) {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        if (showGlobalLoader && !cancelled) setIsLoadingAuth(true);
        const currentUser = await api.auth.me();
        if (cancelled) return;

        if (
          organizationId &&
          currentUser?.organization_id &&
          currentUser.organization_id !== organizationId &&
          currentUser?.user_type !== 'saas_admin'
        ) {
          // Sem ?slug= o tenant pode ser o default (ex. app); redireciona para o slug da org do utilizador.
          let slug = currentUser.organization_slug;
          if (!slug && currentUser.organization_id) {
            const { data: orgRow } = await supabase
              .from('organizations')
              .select('slug')
              .eq('id', currentUser.organization_id)
              .maybeSingle();
            slug = orgRow?.slug ? String(orgRow.slug).trim().toLowerCase() : '';
          }
          if (slug && typeof window !== 'undefined') {
            storeTenantSlugForSession(slug);
            const url = new URL(window.location.href);
            ['slug', 'tenant', 'organization', 'org'].forEach((k) =>
              url.searchParams.delete(k)
            );
            url.searchParams.set('slug', slug);
            window.location.replace(`${url.pathname}${url.search}${url.hash}`);
            return;
          }
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: 'tenant_mismatch',
            message: 'Usuário autenticado em tenant diferente do domínio atual.',
          });
          await supabase.auth.signOut();
          return;
        }

        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error) {
        if (cancelled) return;
        const isUnauth =
          error?.status === 401 ||
          error?.message === 'Not authenticated';
        if (!isUnauth) {
          console.error('User auth check failed:', error);
        }
        setUser(null);
        setIsAuthenticated(false);
        if (error?.status === 401 || error?.status === 403) {
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required',
          });
        }
      } finally {
        // Só desliga o loader global se esta chamada o ligou — evita corridas com SIGNED_IN/USER_UPDATED em paralelo.
        if (showGlobalLoader && !cancelled) setIsLoadingAuth(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED: renovação ao voltar à aba — não precisa re-sync do perfil nem bloquear o app.
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      // Apenas a primeira hidratação da sessão pode usar o ecrã de loading do App.
      // SIGNED_IN volta a disparar em vários browsers ao focar a janela (storage/sync) e não pode
      // esconder a UI inteira de novo.
      const showGlobalLoader = event === 'INITIAL_SESSION';

      void syncFromSession(session, { showGlobalLoader });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isLoadingTenant, organizationId, tenantError?.type]);

  /** Atualiza o perfil no contexto (ex.: após salvar nome em Configurações) sem ecrã de loading global. */
  const refreshUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (e) {
      console.error('refreshUser failed:', e);
    }
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);

    if (shouldRedirect) {
      void api.auth.logout().finally(() => {
        window.location.assign('/login');
      });
    } else {
      void api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      logout,
      navigateToLogin,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
