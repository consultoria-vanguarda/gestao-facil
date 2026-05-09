-- Reparo idempotente: recria políticas do bucket project-draft-audio com EXISTS em profiles.
-- Use este arquivo se uma versão anterior das políticas falhou ou se você viu apenas NOTICE no DROP.
-- Os NOTICE em "DROP POLICY IF EXISTS ... does not exist" são normais na primeira vez.

DROP POLICY IF EXISTS project_draft_audio_select ON storage.objects;
DROP POLICY IF EXISTS project_draft_audio_insert ON storage.objects;
DROP POLICY IF EXISTS project_draft_audio_update ON storage.objects;
DROP POLICY IF EXISTS project_draft_audio_delete ON storage.objects;

CREATE POLICY project_draft_audio_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-draft-audio'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND split_part(name, '/', 1) = p.organization_id::text
  )
);

CREATE POLICY project_draft_audio_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-draft-audio'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND split_part(name, '/', 1) = p.organization_id::text
  )
);

CREATE POLICY project_draft_audio_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-draft-audio'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND split_part(name, '/', 1) = p.organization_id::text
  )
)
WITH CHECK (
  bucket_id = 'project-draft-audio'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND split_part(name, '/', 1) = p.organization_id::text
  )
);

CREATE POLICY project_draft_audio_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-draft-audio'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND split_part(name, '/', 1) = p.organization_id::text
  )
);
