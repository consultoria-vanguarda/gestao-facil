import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { api } from '@/api/appApi';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { tenantError } = useTenant();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const authenticatedUserIdRef = useRef(null);
  const authBootstrappedRef = useRef(false);

  // Erro de tenant sem organização: não mantém sessão “fantasma” no layout.
  useEffect(() => {
    if (tenantError?.type === 'organization_not_found') {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setIsLoadingAuth(false);
      authBootstrappedRef.current = false;
      authenticatedUserIdRef.current = null;
    }
  }, [tenantError?.type]);

  // Listener de auth estável (não remonta quando organizationId muda no TenantContext).
  useEffect(() => {
    let cancelled = false;

    const syncFromSession = async (session, { showGlobalLoader = false } = {}) => {
      if (!session) {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          authenticatedUserIdRef.current = null;
          authBootstrappedRef.current = false;
          setAuthError(null);
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        if (showGlobalLoader && !cancelled) setIsLoadingAuth(true);
        const currentUser = await api.auth.me();
        if (cancelled) return;

        setUser(currentUser);
        setIsAuthenticated(true);
        authenticatedUserIdRef.current = currentUser?.id ?? session.user?.id ?? null;
        authBootstrappedRef.current = true;
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
        authenticatedUserIdRef.current = null;
        authBootstrappedRef.current = false;
        if (error?.status === 401 || error?.status === 403) {
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required',
          });
        }
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    };

    const onAuthStateChange = (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      const nextUserId = session?.user?.id ?? null;

      if (
        session &&
        authBootstrappedRef.current &&
        authenticatedUserIdRef.current === nextUserId &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        return;
      }

      if (!session) {
        void syncFromSession(null);
        return;
      }

      const showGlobalLoader =
        !authBootstrappedRef.current && event === 'INITIAL_SESSION';
      void syncFromSession(session, { showGlobalLoader });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data?.session ?? null;
      if (session) {
        void syncFromSession(session, {
          showGlobalLoader: !authBootstrappedRef.current,
        });
      } else {
        void syncFromSession(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(onAuthStateChange);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      authenticatedUserIdRef.current = currentUser?.id ?? session.user?.id ?? null;
      authBootstrappedRef.current = true;
      setAuthError(null);
    } catch (e) {
      console.error('refreshUser failed:', e);
    }
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    authBootstrappedRef.current = false;
    authenticatedUserIdRef.current = null;

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
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        logout,
        navigateToLogin,
        refreshUser,
      }}
    >
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
