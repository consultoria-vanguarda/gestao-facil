/**
 * Bucket público no Supabase Storage.
 * Opcional: `VITE_SUPABASE_STORAGE_BUCKET` (se omitido, usa o id do bucket criado nas migrações iniciais do projeto).
 */
export function getPublicStorageBucket() {
  return import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'base44-prod';
}

/** URL pública `.../object/public/{bucket}/{objectPath}` para assets e links. */
export function publicStorageObjectUrl(objectPath) {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const bucket = getPublicStorageBucket();
  if (!base || !objectPath) return '';
  const path = String(objectPath).replace(/^\//, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
