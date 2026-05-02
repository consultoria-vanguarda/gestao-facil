import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { TenantProvider, useTenant } from '@/lib/TenantContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginPage from '@/pages/Login';
import TenantNotFoundError from '@/components/TenantNotFoundError';
import LandingPage from '@/pages/LandingPage';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/** Evita open redirect: só caminhos relativos na mesma origem. */
function safePostLoginRedirect(raw) {
  if (!raw || typeof raw !== 'string') return `/${mainPageKey}`;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch {
    /* ignore */
  }
  return `/${mainPageKey}`;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated, user } = useAuth();
  const { isLoadingTenant, tenantError } = useTenant();
  const location = useLocation();
  const isLoginPath = location.pathname === '/login';

  if (isLoadingTenant) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (tenantError?.type === 'organization_not_found') {
    return <TenantNotFoundError />;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    if (isLoginPath) {
      return <LoginPage />;
    }
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  if (isLoginPath) {
    const params = new URLSearchParams(location.search);
    const to = safePostLoginRedirect(params.get('redirect'));
    return <Navigate to={to} replace />;
  }

  const platformAdminOnly =
    String(user?.user_type || '').toLowerCase() === 'saas_admin' &&
    String(user?.organization_slug || '').toLowerCase() === 'admin';
  if (platformAdminOnly && location.pathname !== '/SaasAdmin') {
    return <Navigate to="/SaasAdmin" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/*"
            element={(
              <TenantProvider>
                <AuthProvider>
                  <NavigationTracker />
                  <AuthenticatedApp />
                </AuthProvider>
              </TenantProvider>
            )}
          />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
