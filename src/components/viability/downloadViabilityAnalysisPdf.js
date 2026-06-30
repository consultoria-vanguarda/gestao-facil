import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadTenantPdfLogo } from '@/lib/pdfLogoConfig';


const BRAND = [30, 58, 95];

function fmtMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCidadeUf(cidade, uf) {
  if (cidade && uf) return `${cidade} — ${uf}`;
  if (cidade) return cidade;
  if (uf) return uf;
  return '—';
}

function distanceMethodLabel(distanceMeta) {
  if (!distanceMeta) return '—';
  if (distanceMeta.distance_via === 'straight_line_km') {
    return 'Linha reta (rota rodoviária não encontrada na API)';
  }
  if (distanceMeta.distance_via === 'driving_matrix_coords') {
    return 'Rota rodoviária (via coordenadas dos CEPs)';
  }
  if (distanceMeta.distance_via === 'driving_matrix') {
    return 'Rota rodoviária (Google Distance Matrix)';
  }
  return String(distanceMeta.distance_via || '—');
}

/**
 * Gera PDF da análise de viabilidade no padrão visual dos demais relatórios (logo + tabelas + cor institucional).
 *
 * @param {object} params
 * @param {object} params.analysisResult — dados do PDF (snake_case)
 * @param {object} params.viabilityCostConfig — config camelCase
 * @param {object} params.motorResult — retorno de analisarViabilidadeProjeto (success)
 * @param {object} [params.distanceMeta] — trecho relevante da resposta googleDistanceKm
 * @param {string} [params.sourcePdfName] — nome do arquivo analisado
 * @param {string} [params.generatedBy] — e-mail do usuário
 * @param {string} [params.pdfLogoUrl] — logo da organização para o cabeçalho
 */
export async function downloadViabilityAnalysisPdf({
  analysisResult,
  viabilityCostConfig,
  motorResult,
  distanceMeta = null,
  sourcePdfName = '',
  generatedBy = '',
  pdfLogoUrl = null,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const logo = await loadTenantPdfLogo(pdfLogoUrl);
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, 10, 8, 40, 14);
  }

  doc.setFontSize(16);
  doc.setTextColor(...BRAND);
  doc.text('Análise de Viabilidade', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, 24, { align: 'center' });
  if (sourcePdfName) {
    doc.text(`Arquivo de origem: ${sourcePdfName}`, pageW / 2, 29, { align: 'center' });
  }
  if (generatedBy) {
    doc.text(`Emitido por: ${generatedBy}`, pageW / 2, sourcePdfName ? 34 : 29, { align: 'center' });
  }

  let y = sourcePdfName ? (generatedBy ? 40 : 36) : generatedBy ? 36 : 32;

  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text('Dados extraídos do PDF (demanda)', 14, y);
  doc.autoTable({
    startY: y + 4,
    head: [['Campo', 'Valor']],
    body: [
      ['CEP destino', analysisResult?.cep_destino != null ? String(analysisResult.cep_destino) : '—'],
      ['Valor total (PDF)', `R$ ${fmtMoney(analysisResult?.valor_total)}`],
      ['Horas totais', analysisResult?.horas_totais != null ? String(analysisResult.horas_totais) : '—'],
      ['Dias na cidade', analysisResult?.dias_na_cidade != null ? String(analysisResult.dias_na_cidade) : '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text('Logística e distância', 14, y);
  const rotaOk = distanceMeta?.distance_via !== 'straight_line_km';
  const distanciaObs =
    distanceMeta?.distance_note ||
    (!rotaOk ? 'Distância por linha reta entre os CEPs geocodificados (aproximação).' : '');

  doc.autoTable({
    startY: y + 4,
    head: [['Item', 'Valor']],
    body: [
      ['CEP origem (base)', distanceMeta?.origin_query || viabilityCostConfig?.cepOrigem || '—'],
      ['Localidade origem', formatCidadeUf(distanceMeta?.origem_cidade, distanceMeta?.origem_uf)],
      ['CEP destino', distanceMeta?.destination_query || analysisResult?.cep_destino || '—'],
      ['Localidade destino', formatCidadeUf(distanceMeta?.destino_cidade, distanceMeta?.destino_uf)],
      ['Distância de ida (km)', motorResult?.distanciaKm != null ? String(motorResult.distanciaKm) : '—'],
      ['Método da distância', distanceMethodLabel(distanceMeta)],
      ['Rota rodoviária encontrada', rotaOk ? 'Sim' : 'Não (usar observação abaixo)'],
      ...(distanciaObs ? [['Observação', distanciaObs]] : []),
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    columnStyles: { 1: { cellWidth: 110 } },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text('Parâmetros de custo utilizados', 14, y);
  doc.autoTable({
    startY: y + 4,
    head: [['Parâmetro', 'Valor']],
    body: [
      ['Valor hora consultor', `R$ ${fmtMoney(viabilityCostConfig?.valorHoraConsultor)}`],
      ['Hospedagem / dia', `R$ ${fmtMoney(viabilityCostConfig?.custoHospedagemDiaria)}`],
      ['Alimentação / dia', `R$ ${fmtMoney(viabilityCostConfig?.custoAlimentacaoDiaria)}`],
      ['Custo por km', `R$ ${fmtMoney(viabilityCostConfig?.custoPorKm)}`],
      ['Limite km bate-volta (ida)', `${viabilityCostConfig?.limiteKmBateVolta ?? '—'} km`],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text('Resultado consolidado', 14, y);

  const viavel = motorResult?.viavelPorMargem ? 'Sim' : 'Não';
  doc.autoTable({
    startY: y + 4,
    head: [['Indicador', 'Valor']],
    body: [
      ['Modo logístico', motorResult?.modoLogisticoLabel || '—'],
      [
        'Viável (margem > mínimo)',
        `${viavel} (mínimo considerado: ${motorResult?.margemMinimaConsideradaPct ?? 20}%)`,
      ],
      ['Receita (PDF)', `R$ ${fmtMoney(motorResult?.receitaPdf)}`],
      ['Custo total estimado', `R$ ${fmtMoney(motorResult?.custos?.total)}`],
      ['Lucro bruto', `R$ ${fmtMoney(motorResult?.lucroBruto)}`],
      ['Margem (%)', motorResult?.margemLucroPercentual != null ? `${fmtMoney(motorResult.margemLucroPercentual)}%` : '—'],
      ['Deslocamento', `R$ ${fmtMoney(motorResult?.custos?.deslocamento)}`],
      ['Hospedagem', `R$ ${fmtMoney(motorResult?.custos?.hospedagem)}`],
      ['Alimentação', `R$ ${fmtMoney(motorResult?.custos?.alimentacao)}`],
      ['Mão de obra', `R$ ${fmtMoney(motorResult?.custos?.maoDeObra)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });

  const safeName = (sourcePdfName || 'analise').replace(/[^\w\-.\u00C0-\u024F]+/gi, '_').slice(0, 80);
  doc.save(`Analise_Viabilidade_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
}
