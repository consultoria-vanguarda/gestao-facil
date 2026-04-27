import React, { useState } from 'react';
import { api } from '@/api/appApi';
import { Upload, FileCheck, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

export default function DeliverablesTab({ project, onUpdate }) {
  const [uploading, setUploading] = useState({});

  const activities = (project?.activities || []).filter(a => a.description);

  const handleUpload = async (idx, file) => {
    if (!file) return;
    setUploading(u => ({ ...u, [idx]: true }));
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const updatedActivities = activities.map((a, i) =>
        i === idx ? { ...a, deliverable_url: file_url, deliverable_name: file.name } : a
      );
      await api.entities.Project.update(project.id, { activities: updatedActivities });
      onUpdate();
    } catch (e) {
      alert('Erro ao fazer upload do arquivo.');
    } finally {
      setUploading(u => ({ ...u, [idx]: false }));
    }
  };

  if (activities.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-12 text-center text-slate-400">
          <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma atividade cadastrada neste atendimento.</p>
          <p className="text-sm mt-1">Adicione atividades em "Detalhamento do Serviço e Atividades" ao editar o atendimento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((act, idx) => (
        <Card key={idx} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 rounded px-2 py-0.5">
                    Atividade {idx + 1}
                  </span>
                  {act.modality && (
                    <span className="text-xs text-slate-500 bg-slate-100 rounded px-2 py-0.5">{act.modality}</span>
                  )}
                </div>
                <p className="font-medium text-slate-800">{act.description}</p>
                {act.delivery && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    <span className="font-medium">Entrega esperada:</span> {act.delivery}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-slate-400 mt-1">
                  {act.hours && <span>{act.hours}h</span>}
                  {act.days && <span>{act.days} dia(s)</span>}
                </div>
              </div>

              <div className="flex-shrink-0">
                {act.deliverable_url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={act.deliverable_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span className="max-w-[160px] truncate">{act.deliverable_name || 'Arquivo enviado'}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                    <label className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 underline">
                      Substituir
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleUpload(idx, e.target.files[0])}
                        disabled={uploading[idx]}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#1e3a5f] transition-colors text-sm text-slate-500 hover:text-[#1e3a5f]">
                    {uploading[idx] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading[idx] ? 'Enviando...' : 'Upload do entregável'}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleUpload(idx, e.target.files[0])}
                      disabled={uploading[idx]}
                    />
                  </label>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}