-- Bucket privado: áudios de reunião para rascunho de projeto (path = {organization_id}/...)

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-draft-audio', 'project-draft-audio', false)
ON CONFLICT (id) DO NOTHING;

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
  AND split_part(name, '/', 1) = public.current_user_organization_id()::text
);

CREATE POLICY project_draft_audio_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-draft-audio'
  AND split_part(name, '/', 1) = public.current_user_organization_id()::text
);

CREATE POLICY project_draft_audio_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-draft-audio'
  AND split_part(name, '/', 1) = public.current_user_organization_id()::text
)
WITH CHECK (
  bucket_id = 'project-draft-audio'
  AND split_part(name, '/', 1) = public.current_user_organization_id()::text
);

CREATE POLICY project_draft_audio_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-draft-audio'
  AND split_part(name, '/', 1) = public.current_user_organization_id()::text
);
