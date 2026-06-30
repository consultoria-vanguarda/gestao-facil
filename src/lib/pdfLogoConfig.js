import { loadImageAsDataUrl } from '@/lib/imageDataUrl';

export const PDF_LOGO_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

export const PDF_LOGO_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];

export const PDF_LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;

export const PDF_LOGO_MAX_SIZE_LABEL = '2 MB';

export const PDF_LOGO_ACCEPT = PDF_LOGO_ALLOWED_MIME_TYPES.join(',');

export const PDF_LOGO_EXTENSIONS_LABEL = 'PNG, JPG, WEBP ou SVG';

/**
 * @param {File | null | undefined} file
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validatePdfLogoFile(file) {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  const nameParts = file.name.split('.');
  if (nameParts.length < 2) {
    return { valid: false, error: 'O arquivo deve ter uma extensão válida.' };
  }

  const extension = `.${nameParts.pop()?.toLowerCase()}`;
  if (!PDF_LOGO_ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Formato não permitido. Use ${PDF_LOGO_EXTENSIONS_LABEL}.`,
    };
  }

  if (!PDF_LOGO_ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo inválido. Use ${PDF_LOGO_EXTENSIONS_LABEL}.`,
    };
  }

  if (file.size > PDF_LOGO_MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${PDF_LOGO_MAX_SIZE_LABEL}.`,
    };
  }

  return { valid: true };
}

/**
 * @param {string | null | undefined} dataUrl
 * @returns {'PNG' | 'JPEG' | 'WEBP'}
 */
export function getImageFormatFromDataUrl(dataUrl) {
  const match = /^data:image\/(\w+)/i.exec(dataUrl || '');
  const type = match?.[1]?.toLowerCase();
  if (type === 'jpeg' || type === 'jpg') return 'JPEG';
  if (type === 'webp') return 'WEBP';
  return 'PNG';
}

/**
 * @param {{ pdf_logo_url?: string | null } | null | undefined} settings
 * @returns {string | null}
 */
export function resolvePdfLogoUrl(settings) {
  return settings?.pdf_logo_url?.trim() || null;
}

/**
 * @param {string | null | undefined} pdfLogoUrl
 * @returns {Promise<{ dataUrl: string, format: 'PNG' | 'JPEG' | 'WEBP' } | null>}
 */
export async function loadTenantPdfLogo(pdfLogoUrl) {
  if (!pdfLogoUrl) return null;
  try {
    const dataUrl = await loadImageAsDataUrl(pdfLogoUrl);
    return {
      dataUrl,
      format: getImageFormatFromDataUrl(dataUrl),
    };
  } catch {
    return null;
  }
}
