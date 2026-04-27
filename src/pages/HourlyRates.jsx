import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/ui/PageHeader';
import { KM_RANGES, CONSULTING_HOUR_RANGES, CONSULTING_RATES, INSTRUCTIONAL_HOUR_RANGES, INSTRUCTIONAL_RATES, WORKSHOPS_DIAGNOSTICS_LECTURES } from '../components/utils/hourlyRateTables';
import { api } from '@/api/appApi';
import { getViabilityCostConfig } from '@/api/viabilityCostConfigApi';
import ViabilityCostConfigModal from '@/components/viability/ViabilityCostConfigModal';
import { analisarViabilidadeProjeto } from '@/lib/viabilityEngine';
import { normalizeCepDigits, isValidCepBR, formatCEPInput } from '@/lib/validators';
import { downloadViabilityAnalysisPdf } from '@/components/viability/downloadViabilityAnalysisPdf';
import { toast } from '@/components/ui/use-toast';

const tabs = [
  { key: 'consulting', label: 'Consultoria de Gestão' },
  { key: 'instructional', label: 'Instrutoria' },
  { key: 'workshops', label: 'Oficinas, Diagnósticos, Palestras' },
  { key: 'viability', label: 'Análise de Viabilidade' },
];

const TAB_KEYS = new Set(tabs.map((t) => t.key));
const HOURLY_RATES_TAB_KEY = 'hourlyRates_activeTab';

function readStoredTab() {
  try {
    const raw = sessionStorage.getItem(HOURLY_RATES_TAB_KEY);
    return TAB_KEYS.has(raw) ? raw : null;
  } catch {
    return null;
  }
}

function persistTab(key) {
  try {
    sessionStorage.setItem(HOURLY_RATES_TAB_KEY, key);
  } catch {
    /* ignore */
  }
}

function formatBRL(val) {
  if (val === null || val === undefined) return '-';
  return `R$ ${val.toLocaleString('pt-BR')}`;
}

const DISTANCE_VIA_LABELS = {
  driving_matrix: 'Rota rodoviária (Google Distance Matrix)',
  driving_matrix_coords: 'Rota rodoviária (coordenadas dos CEPs)',
  straight_line_km: 'Linha reta entre os CEPs (aproximação — rota não encontrada)',
};

function formatLocalidadeCep(cidade, uf, cepDigits) {
  const loc =
    cidade && uf ? `${cidade} (${uf})` : cidade ? cidade : uf ? `UF ${uf}` : null;
  const cepFmt = cepDigits ? formatCEPInput(cepDigits) : null;
  if (loc && cepFmt) return `${loc} · CEP ${cepFmt}`;
  if (loc) return loc;
  if (cepFmt) return `CEP ${cepFmt}`;
  return 'Não identificado pelo mapa';
}

function readTabFromUrl() {
  try {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (TAB_KEYS.has(t)) return t;
  } catch {
    /* ignore */
  }
  return null;
}

export default function HourlyRates() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => readTabFromUrl() || readStoredTab() || 'consulting');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (TAB_KEYS.has(t)) {
      setActiveTab(t);
      persistTab(t);
    }
  }, [searchParams]);
  const [filterKm, setFilterKm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [viabilityCostConfig, setViabilityCostConfig] = useState(null);
  const [viabilityCostLoading, setViabilityCostLoading] = useState(true);
  const [viabilityCostError, setViabilityCostError] = useState('');
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [motorLoading, setMotorLoading] = useState(false);
  const [motorError, setMotorError] = useState('');
  const [motorResult, setMotorResult] = useState(null);
  const [motorDistanceMeta, setMotorDistanceMeta] = useState(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });
  const ut = currentUser?.user_type ?? 'admin';
  const isAdmin = ut === 'admin' || ut === 'saas_admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setViabilityCostLoading(true);
      setViabilityCostError('');
      const { data, error } = await getViabilityCostConfig();
      if (cancelled) return;
      if (error) setViabilityCostError(error.message);
      else setViabilityCostConfig(data);
      setViabilityCostLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredKmIndexes = KM_RANGES.map((_, i) => i).filter(i => {
    if (!filterKm) return true;
    const km = parseFloat(filterKm);
    return km >= KM_RANGES[i][0] && km <= KM_RANGES[i][1];
  });

  const formatNullable = (value, formatter) => {
    if (value === null || value === undefined || value === '') return 'Não encontrado';
    return formatter ? formatter(value) : String(value);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setAnalysisError('');
    setAnalysisResult(null);
    setMotorError('');
    setMotorResult(null);
    setMotorDistanceMeta(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setAnalysisError('Selecione um arquivo PDF válido.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleAnalyzePdf = async () => {
    if (!selectedFile) {
      setAnalysisError('Selecione um PDF antes de analisar.');
      return;
    }

    setIsUploading(true);
    setAnalysisError('');
    setAnalysisResult(null);
    setMotorError('');
    setMotorResult(null);
    setMotorDistanceMeta(null);

    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file: selectedFile });
      const response = await api.functions.invoke('parseViabilityPdf', { file_url });
      const payload = response?.data;

      if (!payload?.success || !payload?.data) {
        throw new Error(payload?.error || 'Falha ao analisar o PDF.');
      }

      setAnalysisResult(payload.data);
    } catch (error) {
      setAnalysisError(error?.message || 'Erro ao enviar/analisar o arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCalcularViabilidade = async () => {
    setMotorError('');
    setMotorResult(null);
    setMotorDistanceMeta(null);

    if (!viabilityCostConfig) {
      setMotorError('Configure os custos de viabilidade (e CEP de origem) antes de calcular.');
      return;
    }
    if (!analysisResult) {
      setMotorError('Analise um PDF primeiro para obter o CEP de destino e os demais dados.');
      return;
    }
    if (!isValidCepBR(viabilityCostConfig.cepOrigem)) {
      setMotorError('CEP de origem inválido ou ausente. Edite os custos e informe 8 dígitos no CEP da base.');
      return;
    }
    if (!isValidCepBR(analysisResult.cep_destino)) {
      setMotorError('CEP de destino não encontrado ou inválido no PDF. Verifique o arquivo ou extraia novamente.');
      return;
    }

    setMotorLoading(true);
    try {
      const response = await api.functions.invoke('googleDistanceKm', {
        cep_origem: normalizeCepDigits(viabilityCostConfig.cepOrigem),
        cep_destino: normalizeCepDigits(analysisResult.cep_destino),
      });
      const payload = response?.data;

      if (!payload?.success) {
        setMotorError(payload?.error || 'Não foi possível calcular a distância (API ou rede).');
        return;
      }

      const km = payload.distance_km;
      if (km === null || km === undefined || !Number.isFinite(Number(km))) {
        setMotorError('Resposta da API de distância sem valor de km válido.');
        return;
      }

      const resultado = analisarViabilidadeProjeto(
        analysisResult,
        viabilityCostConfig,
        Number(km)
      );

      if (!resultado.success) {
        setMotorError(resultado.error || 'Falha ao consolidar a viabilidade.');
        return;
      }

      setMotorDistanceMeta({
        distance_via: payload.distance_via,
        distance_note: payload.distance_note ?? null,
        rota_encontrada: payload.rota_encontrada !== false,
        origem_cidade: payload.origem_cidade ?? null,
        origem_uf: payload.origem_uf ?? null,
        destino_cidade: payload.destino_cidade ?? null,
        destino_uf: payload.destino_uf ?? null,
        origem_endereco_formatado: payload.origem_endereco_formatado ?? null,
        destino_endereco_formatado: payload.destino_endereco_formatado ?? null,
        origin_query: payload.origin_query ?? null,
        destination_query: payload.destination_query ?? null,
      });
      setMotorResult(resultado);
    } catch (e) {
      setMotorError(e?.message || 'Erro inesperado ao calcular viabilidade.');
    } finally {
      setMotorLoading(false);
    }
  };

  const handleExportViabilityPdf = async () => {
    if (!motorResult?.success || !analysisResult || !viabilityCostConfig) {
      toast({
        title: 'Dados insuficientes',
        description: 'Calcule a viabilidade antes de gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }
    setPdfExporting(true);
    try {
      await downloadViabilityAnalysisPdf({
        analysisResult,
        viabilityCostConfig,
        motorResult,
        distanceMeta: motorDistanceMeta,
        sourcePdfName: selectedFile?.name || '',
        generatedBy: currentUser?.email || '',
      });
      toast({
        title: 'PDF gerado',
        description: 'O download da análise de viabilidade foi iniciado.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setPdfExporting(false);
    }
  };

  const isStraightLineDistance = motorDistanceMeta?.distance_via === 'straight_line_km';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Valores de Horas Técnicas"
        subtitle="Tabelas de referência - Resolução DIREX 072/2025 SEBRAE/GO"
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => {
              persistTab(t.key);
              setActiveTab(t.key);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.key
                ? 'border-[#1e3a5f] text-[#1e3a5f]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      {activeTab !== 'workshops' && activeTab !== 'viability' && (
        <div className="flex items-center gap-3 max-w-xs">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Filtrar por KM:</label>
          <input
            type="number"
            value={filterKm}
            onChange={e => setFilterKm(e.target.value)}
            placeholder="Ex: 120"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
        </div>
      )}

      {/* CONSULTORIA TABLE */}
      {activeTab === 'consulting' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 px-4 py-2 bg-slate-50 border-b">Tabela 1 – Valores para Pagamento de Horas Técnicas de Consultoria de Gestão (R$/hora)</p>
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="p-2 text-left whitespace-nowrap sticky left-0 bg-[#1e3a5f]" rowSpan={2}>KM De</th>
                <th className="p-2 text-left whitespace-nowrap sticky left-12 bg-[#1e3a5f]" rowSpan={2}>KM Até</th>
                {CONSULTING_HOUR_RANGES.map((h, i) => (
                  <th key={i} className="p-2 text-center whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredKmIndexes.map(kmIdx => (
                <tr key={kmIdx} className={kmIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 font-medium sticky left-0 bg-inherit">{KM_RANGES[kmIdx][0]}</td>
                  <td className="p-2 font-medium sticky left-12 bg-inherit">{KM_RANGES[kmIdx][1]}</td>
                  {CONSULTING_RATES[kmIdx].map((val, hIdx) => (
                    <td key={hIdx} className="p-2 text-center whitespace-nowrap">{formatBRL(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* INSTRUTORIA TABLE */}
      {activeTab === 'instructional' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 px-4 py-2 bg-slate-50 border-b">Tabela 2 – Valores para Pagamento de Horas Técnicas de Instrutoria (R$/hora)</p>
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="p-2 text-left whitespace-nowrap sticky left-0 bg-[#1e3a5f]">KM De</th>
                <th className="p-2 text-left whitespace-nowrap sticky left-12 bg-[#1e3a5f]">KM Até</th>
                {INSTRUCTIONAL_HOUR_RANGES.map((h, i) => (
                  <th key={i} className="p-2 text-center whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredKmIndexes.map(kmIdx => (
                <tr key={kmIdx} className={kmIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 font-medium sticky left-0 bg-inherit">{KM_RANGES[kmIdx][0]}</td>
                  <td className="p-2 font-medium sticky left-12 bg-inherit">{KM_RANGES[kmIdx][1]}</td>
                  {INSTRUCTIONAL_RATES[kmIdx].map((val, hIdx) => (
                    <td key={hIdx} className="p-2 text-center whitespace-nowrap">{formatBRL(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WORKSHOPS TABLE */}
      {activeTab === 'workshops' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 px-4 py-2 bg-slate-50 border-b">Tabela 3 – Valores para Pagamento de Oficinas, Diagnósticos, Palestras e Programa Sebrae na Sua Empresa</p>
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="p-2 text-left whitespace-nowrap">KM De</th>
                <th className="p-2 text-left whitespace-nowrap">KM Até</th>
                {WORKSHOPS_DIAGNOSTICS_LECTURES.columns.map((col, i) => (
                  <th key={i} className="p-2 text-center whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKSHOPS_DIAGNOSTICS_LECTURES.rates.map((row, kmIdx) => (
                <tr key={kmIdx} className={kmIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 font-medium">{KM_RANGES[kmIdx][0]}</td>
                  <td className="p-2 font-medium">{KM_RANGES[kmIdx][1]}</td>
                  {row.map((val, i) => (
                    <td key={i} className="p-2 text-center whitespace-nowrap">{formatBRL(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ANALISE DE VIABILIDADE */}
      {activeTab === 'viability' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4 space-y-4 max-w-3xl">
          <ViabilityCostConfigModal
            open={costModalOpen}
            onOpenChange={setCostModalOpen}
            initialConfig={viabilityCostConfig}
            createdBy={currentUser?.email || null}
            onSaved={(saved) => setViabilityCostConfig(saved)}
          />

          <div className="rounded-md border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-900">Parâmetros de custo atuais</h4>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCostModalOpen(true)}
                  className="text-sm font-medium text-[#1e3a5f] hover:underline whitespace-nowrap"
                >
                  Editar valores
                </button>
              )}
            </div>
            {viabilityCostLoading && (
              <p className="text-sm text-slate-500">Carregando parâmetros...</p>
            )}
            {!viabilityCostLoading && viabilityCostError && (
              <p className="text-sm text-rose-600">{viabilityCostError}</p>
            )}
            {!viabilityCostLoading && !viabilityCostError && !viabilityCostConfig && (
              <p className="text-sm text-slate-500">
                Nenhum registro de custos encontrado. {isAdmin ? 'Use o botão abaixo para definir os valores.' : 'Peça a um administrador para configurar.'}
              </p>
            )}
            {!viabilityCostLoading && !viabilityCostError && viabilityCostConfig && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Valor hora consultor</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(viabilityCostConfig.valorHoraConsultor)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Hospedagem / dia</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(viabilityCostConfig.custoHospedagemDiaria)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Alimentação / dia</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(viabilityCostConfig.custoAlimentacaoDiaria)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Custo por km</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(viabilityCostConfig.custoPorKm)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">CEP origem (base)</dt>
                  <dd className="font-medium text-slate-900">
                    {viabilityCostConfig.cepOrigem
                      ? formatCEPInput(viabilityCostConfig.cepOrigem)
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-slate-500">Limite km bate-volta (ida)</dt>
                  <dd className="font-medium text-slate-900">
                    {Number.isFinite(Number(viabilityCostConfig.limiteKmBateVolta))
                      ? `${Number(viabilityCostConfig.limiteKmBateVolta).toLocaleString('pt-BR')} km`
                      : '—'}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => setCostModalOpen(true)}
                className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50"
              >
                Definir custos de viabilidade
              </button>
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-slate-900">Análise de Viabilidade (Demanda de Consultoria)</h3>
            <p className="text-sm text-slate-500 mt-1">
              Envie o PDF do Sebrae para extrair: CEP destino, valor total, horas totais e dias na cidade.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
            <button
              type="button"
              onClick={handleAnalyzePdf}
              disabled={!selectedFile || isUploading}
              className="px-4 py-2 rounded-md bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#2d4a6f] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Analisando...' : 'Enviar e Analisar'}
            </button>
          </div>

          {selectedFile && (
            <p className="text-xs text-slate-500">
              Arquivo selecionado: <span className="font-medium">{selectedFile.name}</span>
            </p>
          )}

          {analysisError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {analysisError}
            </div>
          )}

          {analysisResult && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="px-3 py-2 font-medium text-slate-700 bg-slate-50 w-1/2">CEP da Cidade (Destino)</td>
                    <td className="px-3 py-2 text-slate-900">{formatNullable(analysisResult.cep_destino)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-2 font-medium text-slate-700 bg-slate-50">Valor Total a ser pago</td>
                    <td className="px-3 py-2 text-slate-900">
                      {formatNullable(analysisResult.valor_total, (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-2 font-medium text-slate-700 bg-slate-50">Número Total de Horas</td>
                    <td className="px-3 py-2 text-slate-900">{formatNullable(analysisResult.horas_totais)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-slate-700 bg-slate-50">Número de Dias na Cidade</td>
                    <td className="px-3 py-2 text-slate-900">{formatNullable(analysisResult.dias_na_cidade)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCalcularViabilidade}
                disabled={motorLoading || !viabilityCostConfig || viabilityCostLoading}
                className="px-4 py-2 rounded-md border border-[#1e3a5f] bg-white text-[#1e3a5f] text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {motorLoading ? 'Calculando viabilidade...' : 'Calcular viabilidade (distância + custos)'}
              </button>
              <p className="text-xs text-slate-500">
                Usa o Google Distance Matrix no servidor e aplica as regras de bate-volta ou pernoite conforme o limite configurado.
              </p>
            </div>
          )}

          {motorError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {motorError}
            </div>
          )}

          {motorResult?.success && (
            <div className="rounded-md border border-slate-200 bg-slate-50/90 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Resultado do motor de viabilidade</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportViabilityPdf}
                    disabled={pdfExporting}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {pdfExporting ? 'Gerando PDF...' : 'Gerar PDF da análise'}
                  </button>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      motorResult.viavelPorMargem
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {motorResult.viavelPorMargem
                      ? `Viável (margem acima de ${motorResult.margemMinimaConsideradaPct}%)`
                      : `Atenção: margem igual ou inferior a ${motorResult.margemMinimaConsideradaPct}%`}
                  </span>
                </div>
              </div>

              {motorDistanceMeta && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Origem e destino</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Base (origem)</p>
                      <p className="font-medium text-slate-900">
                        {formatLocalidadeCep(
                          motorDistanceMeta.origem_cidade,
                          motorDistanceMeta.origem_uf,
                          viabilityCostConfig?.cepOrigem
                        )}
                      </p>
                      {motorDistanceMeta.origem_endereco_formatado && (
                        <p className="text-xs text-slate-500 mt-1">{motorDistanceMeta.origem_endereco_formatado}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Demanda (destino)</p>
                      <p className="font-medium text-slate-900">
                        {formatLocalidadeCep(
                          motorDistanceMeta.destino_cidade,
                          motorDistanceMeta.destino_uf,
                          analysisResult?.cep_destino
                        )}
                      </p>
                      {motorDistanceMeta.destino_endereco_formatado && (
                        <p className="text-xs text-slate-500 mt-1">{motorDistanceMeta.destino_endereco_formatado}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <span className="font-medium text-slate-700">Como a distância foi obtida: </span>
                    {DISTANCE_VIA_LABELS[motorDistanceMeta.distance_via] || motorDistanceMeta.distance_via || '—'}
                  </p>
                </div>
              )}

              {isStraightLineDistance && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">Distância em linha reta</p>
                  <p className="mt-1">
                    {motorDistanceMeta?.distance_note ||
                      'O Google não retornou rota rodoviária entre os CEPs. O cálculo de viabilidade usou a distância em linha reta entre os pontos geocodificados — valor aproximado, em geral menor que a quilometragem real de carro.'}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Distância de ida (km)</dt>
                  <dd className="font-medium text-slate-900">
                    {motorResult.distanciaKm != null
                      ? `${motorResult.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} km`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Modo logístico</dt>
                  <dd className="font-medium text-slate-900">{motorResult.modoLogisticoLabel || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Receita (PDF)</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(motorResult.receitaPdf)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Lucro bruto</dt>
                  <dd className="font-medium text-slate-900">{formatBRL(motorResult.lucroBruto)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Margem sobre o valor do PDF</dt>
                  <dd className="font-medium text-slate-900">
                    {motorResult.margemLucroPercentual != null
                      ? `${motorResult.margemLucroPercentual.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}%`
                      : '—'}
                  </dd>
                </div>
              </dl>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">Detalhamento de custos</p>
                <ul className="text-sm space-y-1 text-slate-800">
                  <li className="flex justify-between gap-2">
                    <span>Deslocamento</span>
                    <span className="font-medium">{formatBRL(motorResult.custos?.deslocamento)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Hospedagem</span>
                    <span className="font-medium">{formatBRL(motorResult.custos?.hospedagem)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Alimentação</span>
                    <span className="font-medium">{formatBRL(motorResult.custos?.alimentacao)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>Mão de obra</span>
                    <span className="font-medium">{formatBRL(motorResult.custos?.maoDeObra)}</span>
                  </li>
                  <li className="flex justify-between gap-2 pt-2 border-t border-slate-200 font-semibold">
                    <span>Total</span>
                    <span>{formatBRL(motorResult.custos?.total)}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}