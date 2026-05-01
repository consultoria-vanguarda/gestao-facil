import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { APP_LOGO_URL } from '@/lib/branding';
import { loadImageAsDataUrl } from '@/lib/imageDataUrl';

const SEBRAE_LOGO_URL = APP_LOGO_URL;

/**
 * Generates and downloads the "Relatório de Diagnóstico" PDF.
 */
export async function downloadDiagnosticReport(project, client) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const black = [0, 0, 0];

  // Pre-load logo
  let logoDataUrl = null;
  try {
    logoDataUrl = await loadImageAsDataUrl(SEBRAE_LOGO_URL);
  } catch (e) {
    console.warn('Could not load SEBRAE logo:', e);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function pageBorder() {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.5);
    doc.rect(marginL, 10, contentW, pageH - 20);
  }

  function labelValue(x, y, w, h, label, value) {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    const full = `${label}${value || ''}`;
    const lines = doc.splitTextToSize(full, w - 4);
    doc.text(lines, x + 2, y + 5);
  }

  function sectionTitle(x, y, w, h, text) {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.4);
    doc.rect(x, y, w, h);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(text, x + 2, y + 5);
  }

  function contentBox(x, y, w, h, text) {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    if (text) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...black);
      const lines = doc.splitTextToSize(text, w - 6);
      doc.text(lines, x + 3, y + 5);
    }
  }

  // ─── Draw header (logo + title) ───────────────────────────────────────────
  const headerY = 12;
  const headerH = 22;
  const logoX = marginL + 2;
  const logoY = headerY + 2;
  const logoW = 28;
  const logoH = 18;

  function drawHeader() {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.5);
    doc.rect(marginL, headerY, contentW, headerH);

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    const titleX = logoX + logoW + 4 + (contentW - logoW - 8) / 2;
    doc.text('RELATÓRIO DE DIAGNÓSTICO', titleX, headerY + headerH / 2 + 3, { align: 'center' });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ═════════════════════════════════════════════════════════════════════════
  pageBorder();
  drawHeader();

  // ─── MODALIDADE ──────────────────────────────────────────────────────────
  const modalY = headerY + headerH + 6;
  const isPresencial = project.service_detail === 'presencial';
  const isRemota = project.service_detail === 'remota';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);

  const checkboxCenterX = pageW / 2 - 30;
  doc.rect(checkboxCenterX, modalY - 3.5, 4, 4);
  if (isPresencial) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', checkboxCenterX + 0.8, modalY + 0.1);
    doc.setFont('helvetica', 'normal');
  }
  doc.text('Presencial', checkboxCenterX + 6, modalY + 0.2);

  const checkboxDX = checkboxCenterX + 38;
  doc.rect(checkboxDX, modalY - 3.5, 4, 4);
  if (isRemota) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', checkboxDX + 0.8, modalY + 0.1);
    doc.setFont('helvetica', 'normal');
  }
  doc.text('A Distância', checkboxDX + 6, modalY + 0.2);

  // ─── 1. DADOS DO CLIENTE ─────────────────────────────────────────────────
  let y = modalY + 8;
  sectionTitle(marginL, y, contentW, 7, '1. DADOS DO CLIENTE');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Razão Social: ', client?.company_name || '');
  y += 7;

  const halfW = contentW / 2;
  labelValue(marginL, y, halfW, 7, 'CNPJ: ', client?.document || '');
  labelValue(marginL + halfW, y, halfW, 7, 'Telefone: ', client?.phone || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Endereço Completo (Cidade e Cep): ', client?.address || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Pessoa de Contato: ', client?.contact_person || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Nome do Representante Legal: ', client?.legal_rep_name || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Endereço Completo (Cidade e CEP): ', client?.legal_rep_address || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'Telefone: ', client?.legal_rep_phone || '');
  y += 7;

  labelValue(marginL, y, contentW, 7, 'E-mail: ', client?.email || '');
  y += 7;

  // ─── 2. INFORMAÇÕES RELATIVAS À SITUAÇÃO DA EMPRESA ──────────────────────
  y += 4;
  sectionTitle(marginL, y, contentW, 7, '2. INFORMAÇÕES RELATIVAS À SITUAÇÃO DA EMPRESA, DESCRIÇÃO DA NECESSIDADE DO CLIENTE:');
  y += 7;

  const remainingPage1 = pageH - 20 - y - 2;
  contentBox(marginL, y, contentW, remainingPage1, project.client_needs || '');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  doc.text('1', pageW - marginR - 3, pageH - 12, { align: 'right' });

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2
  // ═════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageBorder();
  drawHeader();

  y = headerY + headerH + 6;

  // ─── 3. ORIENTAÇÕES ──────────────────────────────────────────────────────
  sectionTitle(marginL, y, contentW, 7, '3. ORIENTAÇÕES REPASSADAS Á EMPRESA DURANTE O DIAGNÓSTICO:');
  y += 7;

  const orientText = project.objective || '';
  const orientLines = doc.splitTextToSize(orientText, contentW - 6);
  const orientH = Math.max(20, orientLines.length * 5 + 6);
  contentBox(marginL, y, contentW, orientH, orientText);
  y += orientH + 4;

  // ─── 4. CONSIDERAÇÕES DO CONSULTOR ───────────────────────────────────────
  sectionTitle(marginL, y, contentW, 7, '4. CONSIDERAÇÕES DO CONSULTOR:');
  y += 7;

  const considText = project.notes || '';
  const considLines = doc.splitTextToSize(considText, contentW - 6);
  const considH = Math.max(40, considLines.length * 5 + 6);
  contentBox(marginL, y, contentW, considH, considText);
  y += considH + 8;

  // ─── DECLARAÇÃO ──────────────────────────────────────────────────────────
  const dateStr = project.start_date
    ? format(parseISO(project.start_date), 'dd/MM/yyyy')
    : '';

  const declH = pageH - 20 - y - 2;
  doc.setDrawColor(...black);
  doc.setLineWidth(0.3);
  doc.rect(marginL, y, contentW, declH);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  doc.text('Declaro para os devidos fins, que os serviços foram realizados.', marginL + 3, y + 8);
  doc.text(`Data: ${dateStr}`, marginL + 3, y + 16);

  doc.setFontSize(8);
  doc.text('2', pageW - marginR - 3, pageH - 12, { align: 'right' });

  // ─── Download ─────────────────────────────────────────────────────────────
  const filename = `DIAGNÓSTICO_${(client?.company_name || 'empresa').replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}