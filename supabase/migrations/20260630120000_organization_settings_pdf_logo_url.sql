-- Logo personalizado por organização para documentos PDF gerados pelo sistema.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS pdf_logo_url TEXT;

COMMENT ON COLUMN public.organization_settings.pdf_logo_url IS
  'URL pública da imagem de logo usada nos PDFs gerados (propostas, relatórios, etc.). Configurável pelo admin da organização.';
