import React, { useState, useEffect } from 'react';
import { X, Loader2, Upload, Trash2 } from 'lucide-react';
import { api } from '@/api/appApi';

const REPORT_TYPES = [
  { value: 'presencial', label: 'Consultoria Presencial' },
  { value: 'distancia', label: 'A Distância' },
  { value: 'parcial', label: 'Consultoria Parcial' },
  { value: 'final', label: 'Consultoria Final' },
];

export default function ServiceReportForm({ open, onClose, report, project, client, onSave, loading }) {
  const [formData, setFormData] = useState({
    report_types: [],
    solutions: '',
    results: '',
    results_images: [],
    consultant_notes: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (open && report) {
      setFormData({
        report_types: report.report_types || [],
        solutions: report.solutions || '',
        results: report.results || '',
        results_images: report.results_images || [],
        consultant_notes: report.consultant_notes || '',
      });
    } else if (open) {
      setFormData({ report_types: [], solutions: '', results: '', results_images: [], consultant_notes: '' });
    }
  }, [open, report]);

  const toggleReportType = (value) => {
    setFormData(prev => ({
      ...prev,
      report_types: prev.report_types.includes(value)
        ? prev.report_types.filter(t => t !== value)
        : [...prev.report_types, value],
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, results_images: [...prev.results_images, file_url] }));
    setUploadingImage(false);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setFormData(prev => ({ ...prev, results_images: prev.results_images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.report_types.length) { alert('Selecione pelo menos um tipo de relatório'); return; }
    if (!formData.solutions.trim()) { alert('Preencha o campo de Soluções Implementadas'); return; }
    if (!formData.results.trim()) { alert('Preencha o campo de Resultados Obtidos'); return; }
    if (!formData.consultant_notes.trim()) { alert('Preencha as Considerações do Consultor'); return; }
    onSave({ ...formData, project_id: project.id });
  };

  if (!open) return null;

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' };
  const readonlyStyle = { ...inputStyle, backgroundColor: '#f1f5f9', color: '#475569' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '4px' };
  const sectionStyle = { marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' };
  const sectionTitleStyle = { fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', borderBottom: '2px solid #1e3a5f', paddingBottom: '6px' };

  return (
    <div>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 50, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', zIndex: 10 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f' }}>Relatório da Prestação de Serviço</h2>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X style={{ width: '22px', height: '22px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>

          {/* Tipo */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>TIPO DE RELATÓRIO</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {REPORT_TYPES.map(rt => (
                <label key={rt.value} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  fontSize: '14px', padding: '8px 16px',
                  border: formData.report_types.includes(rt.value) ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
                  borderRadius: '8px', backgroundColor: formData.report_types.includes(rt.value) ? '#eff6ff' : 'white'
                }}>
                  <input type="checkbox" checked={formData.report_types.includes(rt.value)}
                    onChange={() => toggleReportType(rt.value)} style={{ width: '16px', height: '16px' }} />
                  {rt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 1 - Dados do Cliente */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>1 - DADOS DO CLIENTE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Razão Social</label>
                <input style={readonlyStyle} value={client?.company_name || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>CNPJ</label>
                <input style={readonlyStyle} value={client?.document || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input style={readonlyStyle} value={client?.phone || ''} readOnly />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Endereço Completo (Cidade e CEP)</label>
                <input style={readonlyStyle} value={client?.address || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Nome do Representante Legal</label>
                <input style={readonlyStyle} value={client?.legal_rep_name || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Pessoa de Contato</label>
                <input style={readonlyStyle} value={client?.contact_person || ''} readOnly />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Endereço Completo do Rep. Legal (Cidade e CEP)</label>
                <input style={readonlyStyle} value={client?.legal_rep_address || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Telefone do Rep. Legal</label>
                <input style={readonlyStyle} value={client?.legal_rep_phone || ''} readOnly />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input style={readonlyStyle} value={client?.email || ''} readOnly />
              </div>
            </div>
          </div>

          {/* 2 - Necessidades do Cliente */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>2 - INFORMAÇÕES RELATIVAS À SITUAÇÃO DA EMPRESA (DESCRIÇÃO DA NECESSIDADE DO CLIENTE)</div>
            <textarea value={project?.client_needs || ''} readOnly rows={5}
              style={{ ...readonlyStyle, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          {/* 3 - Soluções */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>3 - SOLUÇÕES IMPLEMENTADAS PARA ATENDIMENTO ÀS NECESSIDADES DA EMPRESA E OBJETIVO PROPOSTO</div>
            <textarea value={formData.solutions} onChange={e => setFormData(p => ({ ...p, solutions: e.target.value }))}
              rows={6} required style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Descreva as soluções implementadas..." />
          </div>

          {/* 4 - Resultados */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>4 - RESULTADOS OBTIDOS (em relação ao que foi previsto e o que já foi realizado)</div>
            <textarea value={formData.results} onChange={e => setFormData(p => ({ ...p, results: e.target.value }))}
              rows={6} required style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' }}
              placeholder="Descreva os resultados obtidos..." />

            <label style={{ ...labelStyle, marginBottom: '8px' }}>Imagens (opcional)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {formData.results_images.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '120px', height: '90px' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                  <button type="button" onClick={() => removeImage(idx)} style={{
                    position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)',
                    border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}>
                    <Trash2 style={{ width: '11px', height: '11px', color: 'white' }} />
                  </button>
                </div>
              ))}
              <label style={{
                width: '120px', height: '90px', border: '2px dashed #cbd5e1', borderRadius: '6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: uploadingImage ? 'wait' : 'pointer', backgroundColor: '#f8fafc', gap: '4px'
              }}>
                {uploadingImage
                  ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                  : <Upload style={{ width: '20px', height: '20px', color: '#94a3b8' }} />}
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{uploadingImage ? 'Enviando...' : 'Adicionar'}</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
            </div>
          </div>

          {/* 5 - Considerações */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>5 - CONSIDERAÇÕES DO CONSULTOR</div>
            <textarea value={formData.consultant_notes} onChange={e => setFormData(p => ({ ...p, consultant_notes: e.target.value }))}
              rows={6} required style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Descreva as considerações do consultor..." />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: '12px', position: 'sticky', bottom: 0, backgroundColor: 'white', borderTop: '1px solid #e2e8f0', margin: '0 -32px', padding: '16px 32px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px', backgroundColor: loading ? '#94a3b8' : '#1e3a5f', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
              Salvar Relatório
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}