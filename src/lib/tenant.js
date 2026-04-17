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
 * @param {string} [searchOverride] - query string do React Router (?slug=app), evita corrida com window.
 */
export const getTenantContext = (searchOverride) => {
  const hostname = getHostname();
  const searchString =
    typeof searchOverride === 'string'
      ? searchOverride
      : typeof window !== 'undefined'
        ? window.location.search || ''
        : '';
  let tenantSlugFromUrl =
    getTenantSlugFromUrlParam(searchString) || getTenantSlugFromLoginRedirect(searchString);

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
