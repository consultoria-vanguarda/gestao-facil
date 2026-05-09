-- Modelo de texto (Markdown) usado pela IA para estruturar rascunhos de projeto por organização.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS project_draft_template TEXT;

COMMENT ON COLUMN public.organization_settings.project_draft_template IS
  'Modelo/padrão da consultoria para geração de rascunho de projeto (Markdown). Usado pela Edge Function ai-project-draft.';
