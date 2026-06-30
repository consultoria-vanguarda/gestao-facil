import React, { useRef, useState } from 'react';
import { api } from '@/api/appApi';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';
import {
  PDF_LOGO_ACCEPT,
  PDF_LOGO_EXTENSIONS_LABEL,
  PDF_LOGO_MAX_SIZE_LABEL,
  validatePdfLogoFile,
} from '@/lib/pdfLogoConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

export default function PdfLogoSettings() {
  const { organizationId, settings, refreshSettings } = useTenant();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const currentLogoUrl = settings?.pdf_logo_url || null;

  const resetSelection = () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setSaveError('');
    setSaveStatus(null);
    resetSelection();

    if (!file) return;

    const validation = validatePdfLogoFile(file);
    if (!validation.valid) {
      setValidationError(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!organizationId || !selectedFile) return;

    const validation = validatePdfLogoFile(selectedFile);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveStatus(null);

    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file: selectedFile });
      const { error } = await supabase
        .from('organization_settings')
        .update({
          pdf_logo_url: file_url,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);

      if (error) throw error;

      await refreshSettings();
      resetSelection();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      setSaveError(error?.message || 'Erro ao salvar o logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!organizationId || !currentLogoUrl) return;

    setIsRemoving(true);
    setSaveError('');
    setSaveStatus(null);

    try {
      const { error } = await supabase
        .from('organization_settings')
        .update({
          pdf_logo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);

      if (error) throw error;

      await refreshSettings();
      resetSelection();
      setSaveStatus('removed');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      setSaveError(error?.message || 'Erro ao remover o logo.');
    } finally {
      setIsRemoving(false);
    }
  };

  const displayLogoUrl = previewUrl || currentLogoUrl;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Logo dos PDFs</CardTitle>
        <CardDescription>
          Imagem exibida nos documentos PDF gerados pelo sistema (propostas técnicas, relatórios,
          análises de viabilidade, etc.). A configuração vale para toda a organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-800">Requisitos do arquivo</p>
          <p>Formatos aceitos: {PDF_LOGO_EXTENSIONS_LABEL}</p>
          <p>Tamanho máximo: {PDF_LOGO_MAX_SIZE_LABEL}</p>
          <p>Recomendado: imagem com fundo transparente (PNG ou SVG), proporção horizontal.</p>
        </div>

        {displayLogoUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-slate-200 bg-white">
            <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
              <img
                src={displayLogoUrl}
                alt="Pré-visualização do logo"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-slate-900">
                {selectedFile ? 'Novo logo selecionado' : 'Logo atual da organização'}
              </p>
              <p className="text-sm text-slate-500">
                {selectedFile ? selectedFile.name : 'Usado em todos os PDFs gerados'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <ImageIcon className="h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-600">Nenhum logo configurado para PDFs</p>
            <p className="text-xs text-slate-500">Os PDFs serão gerados sem logo até que um seja enviado.</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="pdf-logo-upload">Enviar logo</Label>
          <input
            ref={fileInputRef}
            id="pdf-logo-upload"
            type="file"
            accept={PDF_LOGO_ACCEPT}
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-[#1e3a5f] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#2d4a6f]"
          />
        </div>

        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedFile || isSaving || !organizationId}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saveStatus === 'success' ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {saveStatus === 'success' ? 'Salvo!' : 'Salvar logo'}
          </Button>

          {currentLogoUrl && !selectedFile && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={isRemoving || !organizationId}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              {isRemoving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remover logo
            </Button>
          )}

          {selectedFile && (
            <Button type="button" variant="outline" onClick={resetSelection} disabled={isSaving}>
              Cancelar seleção
            </Button>
          )}

          {!organizationId && (
            <p className="text-sm text-amber-600">Carregando organização…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
