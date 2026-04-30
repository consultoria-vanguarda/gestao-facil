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

export const getTenantContext = () => ({
  tenantSlug: null,
});
