import { loadImageAsDataUrl } from '@/lib/imageDataUrl';
import {
  SEBRAE_LOGO_DATA_URL,
  SEBRAE_LOGO_FORMAT,
  SEBRAE_LOGO_HEIGHT,
  SEBRAE_LOGO_WIDTH,
} from '@/lib/sebraeLogoData';

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

/**
 * Logo oficial do Sebrae, embutida no bundle para não depender de fetch/canvas.
 *
 * @returns {Promise<{ dataUrl: string, format: 'JPEG', width: number, height: number }>}
 */
export async function loadSebraePdfLogo() {
  return {
    dataUrl: SEBRAE_LOGO_DATA_URL,
    format: SEBRAE_LOGO_FORMAT,
    width: SEBRAE_LOGO_WIDTH,
    height: SEBRAE_LOGO_HEIGHT,
  };
}

/**
 * Desenha a logo no PDF, mantendo a proporção dentro da caixa.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {{ dataUrl: string, format?: string, width?: number, height?: number } | null | undefined} logo
 * @param {number} boxX
 * @param {number} boxY
 * @param {number} boxW
 * @param {number} boxH
 */
export function addPdfLogo(doc, logo, boxX, boxY, boxW, boxH) {
  if (!logo?.dataUrl) return;

  const aspect = logo.width && logo.height ? logo.width / logo.height : SEBRAE_LOGO_WIDTH / SEBRAE_LOGO_HEIGHT;
  let width = boxW;
  let height = width / aspect;
  if (height > boxH) {
    height = boxH;
    width = height * aspect;
  }

  const x = boxX + (boxW - width) / 2;
  const y = boxY + (boxH - height) / 2;
  doc.addImage(logo.dataUrl, logo.format || 'JPEG', x, y, width, height);
}
