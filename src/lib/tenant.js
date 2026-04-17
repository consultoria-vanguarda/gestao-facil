const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Persiste o slug entre /?slug=x → /login?redirect=... (a query do tenant some da URL). */
const TENANT_SLUG_STORAGE_KEY = 'gestao_agil_tenant_slug';

export const normalizeHostname = (hostname) =>
  String(hostname || '').trim().toLowerCase();

export const getHostname = () => {
  if (typeof window === 'undefined') return '';
  return normalizeHostname(window.location.hostname || '');
};

export const getTenantSlugFromHostname = (hostname = getHostname()) => {
  const host = normalizeHostname(hostname);
  if (!host || LOCAL_HOSTS.has(host)) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 3) return null;

  return parts[0] || null;
};

export const getBaseDomainFromHostname = (hostname = getHostname()) => {
  const host = normalizeHostname(hostname);
  if (!host || LOCAL_HOSTS.has(host)) return null;
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join('.');
};

export const getDefaultTenantSlug = () => {
  const value = import.meta.env.VITE_DEFAULT_TENANT_SLUG;
  return value ? normalizeHostname(value) : null;
};

/**
 * @param {string} [search] - query string, ex. "?slug=app". Se omitido, usa window.location.search.
 */
export const getTenantSlugFromUrlParam = (search) => {
  const searchString =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search || ''
        : '';
  const params = new URLSearchParams(searchString);
  const raw =
    params.get('tenant') ||
    params.get('slug') ||
    params.get('organization') ||
    params.get('org');
  if (!raw) return null;
  const slug = normalizeHostname(raw);
  return slug || null;
};

/**
 * Quando não logado, o app navega para /login?redirect=%2F%3Fslug%3Dapp — o slug fica só dentro de `redirect`.
 */
export const getTenantSlugFromLoginRedirect = (search) => {
  const searchString =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search || ''
        : '';
  const params = new URLSearchParams(searchString);
  const redirect = params.get('redirect');
  if (!redirect) return null;
  try {
    const decoded = decodeURIComponent(redirect);
    const q = decoded.indexOf('?');
    if (q === -1) return null;
    const inner = new URLSearchParams(decoded.slice(q + 1));
    const raw =
      inner.get('tenant') ||
      inner.get('slug') ||
      inner.get('organization') ||
      inner.get('org');
    if (!raw) return null;
    return normalizeHostname(raw) || null;
  } catch {
    return null;
  }
};

/** Ex.: #slug=app ou #/path?tenant=app (às vezes preservado quando query some). */
export const getTenantSlugFromHashParam = (hash) => {
  const h = String(hash || '').trim();
  if (!h || h === '#') return null;
  const withoutHash = h.startsWith('#') ? h.slice(1) : h;
  const qIdx = withoutHash.indexOf('?');
  const querySlice =
    qIdx >= 0 ? withoutHash.slice(qIdx + 1) : withoutHash.includes('=') ? withoutHash : '';
  if (!querySlice) return null;
  const params = new URLSearchParams(querySlice.startsWith('?') ? querySlice.slice(1) : querySlice);
  let raw =
    params.get('tenant') ||
    params.get('slug') ||
    params.get('organization') ||
    params.get('org');
  if (!raw) {
    const m = withoutHash.match(/(?:^|[?&#])(?:tenant|slug|organization|org)=([^&#]+)/i);
    if (m) raw = decodeURIComponent(m[1]);
  }
  if (!raw) return null;
  return normalizeHostname(raw) || null;
};

/** Mescla query do Router com window (evita race onde location.search vem vazio). */
function mergeSearchStrings(routerSearch, windowSearch) {
  const r = typeof routerSearch === 'string' ? routerSearch : '';
  const w = typeof windowSearch === 'string' ? windowSearch : '';
  if (r && r.length > 0) return r;
  if (w && w.length > 0) return w;
  return '';
}

/** Exportado para links (`createPageUrl`) quando a barra de URL já perdeu ?slug=. */
export function getStoredTenantSlug() {
  return readStoredTenantSlug();
}

function readStoredTenantSlug() {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(TENANT_SLUG_STORAGE_KEY);
    return v ? normalizeHostname(v) || null : null;
  } catch {
    return null;
  }
}

function persistTenantSlug(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TENANT_SLUG_STORAGE_KEY, slug);
  } catch {
    /* ignore */
  }
}

/** Limpa slug persistido (ex.: logout). */
export function clearStoredTenantSlug() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Expõe persistência do slug (ex.: após login quando o tenant da URL era o default errado). */
export function storeTenantSlugForSession(slug) {
  persistTenantSlug(slug);
}

export const getMainLandingUrl = () => {
  const raw = (import.meta.env.VITE_MAIN_LANDING_URL || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * @param {string | { pathname?: string; search?: string; hash?: string }} [locationLike] - useLocation() ou query string.
 */
export const getTenantContext = (locationLike) => {
  const hostname = getHostname();
  const routerSearch =
    typeof locationLike === 'string'
      ? locationLike
      : locationLike?.search != null
        ? locationLike.search
        : '';
  const windowSearch = typeof window !== 'undefined' ? window.location.search || '' : '';
  const searchString = mergeSearchStrings(routerSearch, windowSearch);

  const routerHash =
    typeof locationLike === 'object' && locationLike != null && locationLike.hash != null
      ? locationLike.hash
      : '';
  const windowHash = typeof window !== 'undefined' ? window.location.hash || '' : '';
  const hashString = routerHash || windowHash || '';

  let tenantSlugFromUrl =
    getTenantSlugFromUrlParam(searchString) ||
    getTenantSlugFromHashParam(hashString) ||
    getTenantSlugFromLoginRedirect(searchString) ||
    getTenantSlugFromLoginRedirect(windowSearch);

  if (!tenantSlugFromUrl) {
    tenantSlugFromUrl = readStoredTenantSlug();
  }

  if (tenantSlugFromUrl) {
    persistTenantSlug(tenantSlugFromUrl);
  }

  const tenantSlugFromHost = getTenantSlugFromHostname(hostname);
  const defaultTenantSlug = tenantSlugFromUrl || getDefaultTenantSlug();
  return {
    hostname,
    tenantSlug: tenantSlugFromUrl || tenantSlugFromHost,
    baseDomain: getBaseDomainFromHostname(hostname),
    defaultTenantSlug,
    tenantSlugFromUrl,
    tenantSlugFromHost,
    isLocalhost: LOCAL_HOSTS.has(hostname),
  };
};
