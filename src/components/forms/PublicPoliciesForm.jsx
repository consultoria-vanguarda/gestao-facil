import React, { useState } from 'react';
import { X, Upload, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/api/appApi';
import { SERVICE_AREAS, getSubareas } from '../utils/serviceAreas';
import { validateISODate } from "@/lib/validators";

export default function PublicPoliciesForm({ open, onClose, consultants, onSave, loading }) {
  const [consultantId, setConsultantId] = useState('');
  const [area, setArea] = useState('');
  const [subarea, setSubarea] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numPhases, setNumPhases] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const selectedConsultant = consultants?.find(c => c.id === consultantId);
  const consultantAreas = selectedConsultant?.service_areas || [];
  const areaOptions = consultantAreas.length > 0
    ? consultantAreas.map(sa => ({ value: sa.area, label: SERVICE_AREAS[sa.area]?.label || sa.area }))
    : Object.entries(SERVICE_AREAS).map(([k, v]) => ({ value: k, label: v.label }));
  const subareasForArea = area ? getSubareas(area) : [];

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setUploading(true);
    setParseError('');
    setParsedData(null);

    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      setUploading(false);
      setParsing(true);

      const response = await api.functions.invoke('parsePublicPoliciesPdf', {
        file_url,
        num_phases: numPhases ? parseInt(numPhases) : undefined,
      });
      const result = response.data;

      if (result.success && result.data) {
        setParsedData(result.data);
      } else {
        setParseError(result.error || 'Erro ao processar o arquivo.');
      }
    } catch (err) {
      setParseError('Erro ao fazer upload ou processar o arquivo.');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleCreate = () => {
    if (!consultantId || !parsedData) return;
    if (startDate && !validateISODate(startDate)) { alert('Informe uma Data Inicial válida.'); return; }
    if (endDate && !validateISODate(endDate)) { alert('Informe uma Data Final válida.'); return; }
    if (startDate && endDate) {
      const s = new Date(startDate + 'T12:00:00');
      const e = new Date(endDate + 'T12:00:00');
      if (e.getTime() < s.getTime()) { alert('A Data Final deve ser maior ou igual à Data Inicial.'); return; }
    }

    const phases = parsedData.phases || [];
    const sortedPhases = [...phases].sort((a, b) => (a.phase_number || 0) - (b.phase_number || 0));

    // Use manually entered dates if provided, otherwise derive from phases
    const firstPhaseDate = sortedPhases.find(p => p.start_date)?.start_date;
    const lastPhaseDate = [...sortedPhases].reverse().find(p => p.start_date)?.start_date;
    const finalStartDate = startDate || firstPhaseDate || new Date().toISOString().split('T')[0];
    const finalEndDate = endDate || lastPhaseDate || finalStartDate;

    // Calculate total_value as sum of phase values (from document)
    const totalValue = sortedPhases.reduce((sum, p) => sum + (p.value || 0), 0);

    // Build schedule_config from phases — use only the first date from "Previsto"
    const scheduleConfig = sortedPhases.map(p => ({
      date: p.start_date || finalStartDate,
      activity: p.description || `Fase ${p.phase_number}`,
      hours: p.hours || 0,
      phase_value: p.value || 0,
      modality: p.type === 'PRESENCIAL' ? 'Presencial' : 'Remota',
      delivery: '',
      isDayOff: false,
    }));

    const projectData = {
      name: parsedData.project_name || 'Políticas Públicas',
      consultant_id: consultantId,
      client_id: null,
      project_type: 'public_policies',
      area: area || null,
      subarea: subarea || null,
      start_date: finalStartDate,
      end_date: finalEndDate,
      contracted_value: totalValue || parsedData.total_value || 0,
      estimated_hours: parsedData.total_hours || 0,
      status: 'planning',
      schedule_generated: false,
      schedule_config: scheduleConfig,
      proposal_file_url: fileUrl,
      public_policies_data: parsedData,
      pricing_mode: 'fixed',
      hours_per_day: 6,
      days_off: 0,
      subsidy_percent: 0,
    };

    onSave(projectData);
  };

  const handleClose = () => {
    setConsultantId('');
    setArea('');
    setSubarea('');
    setStartDate('');
    setEndDate('');
    setNumPhases('');
    setFile(null);
    setFileUrl('');
    setParsedData(null);
    setParseError('');
    onClose();
  };

  if (!open) return null;

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '14px', backgroundColor: 'white'
  };
  const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '4px' };

  return (
    <div>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 50, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', zIndex: 10 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f' }}>
            Novo Atendimento — Políticas Públicas
          </h2>
          <button onClick={handleClose} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X style={{ width: '22px', height: '22px' }} />
          </button>
        </div>

        <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto' }}>
          {/* Consultor */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', borderBottom: '2px solid #1e3a5f', paddingBottom: '8px' }}>
              Consultor
            </div>
            <label style={labelStyle}>Consultor *</label>
            <select value={consultantId} onChange={e => setConsultantId(e.target.value)} style={inputStyle}>
              <option value="">Selecione um consultor</option>
              {consultants?.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Área / Subárea */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', borderBottom: '2px solid #1e3a5f', paddingBottom: '8px' }}>
              Área / Subárea
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Área</label>
                <select value={area} onChange={e => { setArea(e.target.value); setSubarea(''); }} style={inputStyle}>
                  <option value="">Selecione</option>
                  {areaOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Subárea</label>
                <select value={subarea} onChange={e => setSubarea(e.target.value)} style={inputStyle} disabled={!area}>
                  <option value="">Selecione</option>
                  {subareasForArea.map((s, i) => <option key={i} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Datas e Fases */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', borderBottom: '2px solid #1e3a5f', paddingBottom: '8px' }}>
              Configuração do Projeto
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Data Inicial</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Data Final</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Qtd. de Fases</label>
                <input type="number" min="1" value={numPhases} onChange={e => setNumPhases(e.target.value)} placeholder="Ex: 12" style={inputStyle} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
              Se as datas não forem preenchidas, serão extraídas automaticamente do documento.
            </p>
          </div>

          {/* Upload da Proposta */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', borderBottom: '2px solid #1e3a5f', paddingBottom: '8px' }}>
              Upload da Proposta (PDF)
            </div>

            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '24px', textAlign: 'center', marginBottom: '12px', backgroundColor: 'white' }}>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                id="pdf-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#1e3a5f' }}>
                    <FileText style={{ width: '20px', height: '20px' }} />
                    <span style={{ fontWeight: 600 }}>{file.name}</span>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>
                    <Upload style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '14px' }}>Clique para selecionar o arquivo PDF da proposta</p>
                  </div>
                )}
              </label>
            </div>

            {file && !parsedData && (
              <button
                onClick={handleUploadAndParse}
                disabled={uploading || parsing}
                style={{
                  width: '100%', padding: '10px', backgroundColor: uploading || parsing ? '#94a3b8' : '#1e3a5f',
                  color: 'white', border: 'none', borderRadius: '6px', cursor: uploading || parsing ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {(uploading || parsing) && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
                {uploading ? 'Enviando arquivo...' : parsing ? 'Processando proposta com IA...' : 'Processar Proposta'}
              </button>
            )}

            {parseError && (
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ color: '#b91c1c', fontSize: '13px' }}>{parseError}</p>
              </div>
            )}
          </div>

          {/* Preview dos dados extraídos */}
          {parsedData && (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <CheckCircle style={{ width: '18px', height: '18px', color: '#16a34a' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#15803d' }}>Proposta processada com sucesso!</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                  <p style={{ color: '#64748b', marginBottom: '2px' }}>Projeto/Cliente</p>
                  <p style={{ fontWeight: 600, color: '#1e293b' }}>{parsedData.project_name}</p>
                </div>
                <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                  <p style={{ color: '#64748b', marginBottom: '2px' }}>Valor Total</p>
                  <p style={{ fontWeight: 600, color: '#15803d' }}>R$ {(parsedData.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                  <p style={{ color: '#64748b', marginBottom: '2px' }}>Total de Horas</p>
                  <p style={{ fontWeight: 600, color: '#1e293b' }}>{parsedData.total_hours}h</p>
                </div>
                <div style={{ backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px' }}>
                  <p style={{ color: '#64748b', marginBottom: '2px' }}>Fases identificadas</p>
                  <p style={{ fontWeight: 600, color: '#1e293b' }}>{parsedData.phases?.length || 0} fases</p>
                </div>
              </div>

              {parsedData.phases && parsedData.phases.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #bbf7d0', borderRadius: '6px', backgroundColor: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#dcfce7' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Fase</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Descrição</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>Data</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>Horas</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #bbf7d0' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.phases.map((phase, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0fdf4', backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 600 }}>{phase.phase_number}</td>
                          <td style={{ padding: '5px 8px' }}>{phase.description}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {phase.start_date ? phase.start_date.split('-').reverse().join('/') : '-'}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>{phase.hours}h</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500 }}>
                            R$ {(phase.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!consultantId || !parsedData || loading}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px',
                backgroundColor: !consultantId || !parsedData || loading ? '#94a3b8' : '#15803d',
                color: 'white', cursor: !consultantId || !parsedData || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
              Criar Atendimento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}