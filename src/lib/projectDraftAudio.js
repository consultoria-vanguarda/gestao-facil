/** Bucket privado para áudio da reunião antes do rascunho de projeto (Edge Function ai-project-draft). */
export const PROJECT_DRAFT_AUDIO_BUCKET = 'project-draft-audio';

/** Limite alinhado ao uso seguro na Gemini inline + Edge Function (bytes). */
export const PROJECT_DRAFT_MAX_FILE_BYTES = 15 * 1024 * 1024;

const ACCEPT_MIME = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/ogg',
  'audio/opus',
]);

export function isAllowedProjectDraftMime(type) {
  if (!type || typeof type !== 'string') return false;
  const t = type.split(';')[0].trim().toLowerCase();
  return ACCEPT_MIME.has(t);
}

/** Path obrigatório: `{organizationId}/{arquivo}` */
export function buildProjectDraftAudioPath(organizationId, file) {
  const id = String(organizationId || '').trim();
  if (!id) throw new Error('organization_id ausente');
  const rawName = (file?.name && String(file.name)) || 'recording.webm';
  const safe = rawName.replace(/[^\w.\-()+]/g, '_').slice(0, 120);
  const suffix = `${globalThis.crypto.randomUUID().slice(0, 8)}_${safe}`;
  return `${id}/${suffix}`;
}
