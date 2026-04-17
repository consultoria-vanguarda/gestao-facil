const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

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

export const getTenantContext = () => {
  const hostname = getHostname();
  return {
    hostname,
    tenantSlug: getTenantSlugFromHostname(hostname),
    baseDomain: getBaseDomainFromHostname(hostname),
    defaultTenantSlug: getDefaultTenantSlug(),
    isLocalhost: LOCAL_HOSTS.has(hostname),
  };
};
