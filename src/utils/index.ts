import { getStoredTenantSlug } from '@/lib/tenant';

export function createPageUrl(pageName: string) {
    const basePath = '/' + pageName.replace(/ /g, '-');

    if (typeof window === 'undefined') {
        return basePath;
    }

    const current = new URLSearchParams(window.location.search || '');
    let tenant =
        current.get('tenant') ||
        current.get('slug') ||
        current.get('organization') ||
        current.get('org');

    if (!tenant) {
        tenant = getStoredTenantSlug() || '';
    }

    if (!tenant) {
        return basePath;
    }

    // Se a URL alvo já definir tenant/slug/org, respeitamos o valor explícito.
    const [path, queryString = ''] = basePath.split('?');
    const targetParams = new URLSearchParams(queryString);
    const targetHasTenant =
        targetParams.has('tenant') ||
        targetParams.has('slug') ||
        targetParams.has('organization') ||
        targetParams.has('org');

    if (!targetHasTenant) {
        targetParams.set('tenant', tenant);
    }

    const query = targetParams.toString();
    return query ? `${path}?${query}` : path;
}