import { pagesConfig } from '@/pages.config';

const mainPageKey = pagesConfig.mainPage ?? Object.keys(pagesConfig.Pages)[0];

/**
 * Destino seguro após login/cadastro: nunca envia para `/` (marketing),
 * só caminhos relativos na mesma origem.
 */
export function getPostLoginRedirect(rawRedirectParam) {
  const fallback = `/${mainPageKey}`;
  if (!rawRedirectParam || typeof rawRedirectParam !== 'string') return fallback;
  let decoded;
  try {
    decoded = decodeURIComponent(rawRedirectParam.trim());
  } catch {
    return fallback;
  }
  if (decoded === '/' || decoded === '') return fallback;
  if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  return fallback;
}
