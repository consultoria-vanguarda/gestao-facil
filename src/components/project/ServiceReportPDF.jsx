import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { publicStorageObjectUrl } from '@/lib/supabasePublicStorage';

const SEBRAE_LOGO_URL = publicStorageObjectUrl(
  'public/695ebd99a400611ea331a00a/8efa5bac6_image.png'
);

const REPORT_TYPE_LABELS = {
  presencial: 'Consultoria Presencial',
  distancia: 'A Distância',
  parcial: 'Consultoria Parcial',
  final: 'Consultoria Final',
};

async function loadImageAsBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadServiceReport(report, project, client, consultant) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const black = [0, 0, 0];
  const pageBottom = 275;
  const today = new Date();
  const todayStr = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Load logo
  let logoDataUrl = null;
  try { logoDataUrl = await loadImageAsBase64(SEBRAE_LOGO_URL); } catch (e) {}

  // Preload result images
  const imageDataUrls = [];
  for (const url of (report.results_images || [])) {
    try { imageDataUrls.push(await loadImageAsBase64(url)); } catch (e) { imageDataUrls.push(null); }
  }

  // ─── Header ────────────────────────────────────────────────────────────────
  const headerY = 12;
  const headerH = 18;
  const logoX = marginL + 2;
  const logoY = headerY + 2;
  const logoW = 22;
  const logoH = 22;

  function drawHeader() {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.5);
    doc.rect(marginL, headerY, contentW, headerH);

    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);

    const divX = logoX + logoW + 2;
    doc.setLineWidth(0.4);
    doc.line(divX, headerY, divX, headerY + headerH);

    const txtX = divX + 4;
    const rightW = contentW - (divX - marginL) - 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.text('RELATÓRIO DE PRESTAÇÃO DE SERVIÇOS', txtX + rightW / 2, headerY + 8, { align: 'center' });
    doc.text('DE CONSULTORIA REALIZADAS', txtX + rightW / 2, headerY + 14, { align: 'center' });

  }

  function drawFooter() {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Uso Interno', marginL, 290);
  }

  function sectionTitle(text, y) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(text, marginL, y);
    const w = doc.getTextWidth(text);
    doc.setLineWidth(0.3);
    doc.line(marginL, y + 0.8, marginL + w, y + 0.8);
    return y + 6;
  }

  // Bordered box with justified text - returns height used
  function borderedBox(x, y, w, text, fontSize = 10) {
    const pad = 3;
    const lineH = fontSize * 0.52;
    const maxW = w - pad * 2;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');

    // Pre-split all lines to calculate height
    const allLines = [];
    for (const para of text.split('\n')) {
      if (para.trim() === '') { allLines.push(null); continue; }
      const split = doc.splitTextToSize(para, maxW);
      split.forEach((l, i) => allLines.push({ text: l, isLast: i === split.length - 1 }));
    }
    const lineCount = allLines.reduce((acc, l) => acc + (l === null ? 0.6 : 1), 0);
    const h = Math.max(14, lineCount * lineH + pad * 2 + 2);

    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.setTextColor(...black);

    let ty = y + pad + lineH;
    for (const entry of allLines) {
      if (entry === null) { ty += lineH * 0.6; continue; }
      // Justify all lines except the last of each paragraph
      if (!entry.isLast && entry.text.trim().length > 0) {
        const words = entry.text.split(' ').filter(w => w.length > 0);
        if (words.length > 1) {
          const totalWordW = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
          const gap = (maxW - totalWordW) / (words.length - 1);
          let cx = x + pad;
          for (const word of words) {
            doc.text(word, cx, ty);
            cx += doc.getTextWidth(word) + gap;
          }
        } else {
          doc.text(entry.text, x + pad, ty);
        }
      } else {
        doc.text(entry.text, x + pad, ty);
      }
      ty += lineH;
    }
    return h;
  }

  function checkNewPage(y, needed = 20) {
    if (y + needed > pageBottom) {
      doc.addPage();
      drawHeader();
      drawFooter();
      return headerY + headerH + 10;
    }
    return y;
  }

  // ─── Page 1 ───────────────────────────────────────────────────────────────
  drawHeader();
  drawFooter();

  let y = headerY + headerH + 10;

  // ─── Checkboxes ─────────────────────────────────────────────────────────
  const allTypes = ['presencial', 'distancia', 'parcial', 'final'];
  const reportTypes = report.report_types || [];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  const checkLine = allTypes.map(t => `(${reportTypes.includes(t) ? 'X' : '  '}) ${REPORT_TYPE_LABELS[t]}`).join('     ');
  doc.text(checkLine, marginL, y);
  y += 10;

  // ─── 1 - DADOS DO CLIENTE ────────────────────────────────────────────────
  y = sectionTitle('1 - DADOS DO CLIENTE', y);
  y += 2;

  function clientRow(label, value, lineH = 7) {
    const text = label + value;
    const lines = doc.splitTextToSize(text, contentW - 6);
    const h = Math.max(lineH, lines.length * 5 + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(marginL, y, contentW, h);
    doc.text(lines, marginL + 3, y + 5);
    y += h;
  }

  function twoColRow(label1, val1, label2, val2) {
    const halfW = (contentW - 1) / 2;
    const h = 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(marginL, y, halfW, h);
    doc.rect(marginL + halfW + 1, y, halfW, h);
    doc.text(label1 + (val1 || ''), marginL + 3, y + 4.5);
    doc.text(label2 + (val2 || ''), marginL + halfW + 4, y + 4.5);
    y += h;
  }

  clientRow('Razão Social: ', client?.company_name || '');
  twoColRow('CNPJ: ', client?.document, 'Telefone: ', client?.phone);
  clientRow('Endereço Completo (Cidade e CEP): ', client?.address || '');
  clientRow('Nome do Representante Legal: ', client?.legal_rep_name || '');
  clientRow('Pessoa de Contato: ', client?.contact_person || '');
  clientRow('Endereço Completo Rep. Legal (Cidade e CEP): ', client?.legal_rep_address || '');
  twoColRow('Telefone: ', client?.legal_rep_phone, 'E-mail: ', client?.email);
  y += 6;

  // ─── 2 - INFORMAÇÕES RELATIVAS À SITUAÇÃO DA EMPRESA ───────────────────
  y = checkNewPage(y, 40);
  // Section 2 title with smaller font to fit on one line
  {
    const t = '2 - INFORMAÇÕES RELATIVAS À SITUAÇÃO DA EMPRESA (DESCRIÇÃO DA NECESSIDADE DO CLIENTE)';
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(t, marginL, y);
    const w = doc.getTextWidth(t);
    doc.setLineWidth(0.3);
    doc.line(marginL, y + 0.8, marginL + w, y + 0.8);
    y += 6;
  }
  y += 2;
  const needsH = borderedBox(marginL, y, contentW, project.client_needs || '');
  y += needsH + 6;

  // ─── 3 - SOLUÇÕES IMPLEMENTADAS ──────────────────────────────────────────
  y = checkNewPage(y, 40);
  y = sectionTitle('3 - SOLUÇÕES IMPLEMENTADAS PARA ATENDIMENTO ÀS NECESSIDADES DA EMPRESA E OBJETIVO PROPOSTO', y);
  y += 2;
  const solH = borderedBox(marginL, y, contentW, report.solutions || '');
  y += solH + 6;

  // ─── 4 - RESULTADOS OBTIDOS ───────────────────────────────────────────────
  y = checkNewPage(y, 40);
  y = sectionTitle('4 - RESULTADOS OBTIDOS (em relação ao que foi previsto e o que já foi realizado)', y);
  y += 2;
  const resH = borderedBox(marginL, y, contentW, report.results || '');
  y += resH + 4;

  // Result images (inline after section 4 text)
  for (const imgData of imageDataUrls) {
    if (!imgData) continue;
    const imgH = 65;
    y = checkNewPage(y, imgH + 4);
    try {
      doc.addImage(imgData, 'JPEG', marginL, y, contentW, imgH);
    } catch (e) {
      try { doc.addImage(imgData, 'PNG', marginL, y, contentW, imgH); } catch (e2) {}
    }
    y += imgH + 4;
  }
  y += 2;

  // ─── 5 - CONSIDERAÇÕES DO CONSULTOR ─────────────────────────────────────
  y = checkNewPage(y, 40);
  y = sectionTitle('5 - CONSIDERAÇÕES DO CONSULTOR', y);
  y += 2;
  const notesH = borderedBox(marginL, y, contentW, report.consultant_notes || '');
  y += notesH + 14;

  // ─── 6 - ASSINATURA DO CONSULTOR ─────────────────────────────────────────
  y = checkNewPage(y, 50);
  y = sectionTitle('6. ASSINATURA DO CONSULTOR:', y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  doc.text('Nome:  ' + (consultant?.name || ''), marginL, y);
  y += 8;
  doc.text('Data:  ' + format(today, 'dd/MM/yyyy'), marginL, y);
  y += 10;
  doc.text('Assinatura:', marginL, y);
  doc.setLineWidth(0.3);
  doc.line(marginL + 28, y, marginL + 28 + 70, y);
  y += 14;

  // ─── 7 - CONFIRMAÇÃO DE RECEBIMENTO DO RELATÓRIO PELO CLIENTE ────────────
  y = checkNewPage(y, 50);
  y = sectionTitle('7. CONFIRMAÇÃO DE RECEBIMENTO DO RELATÓRIO PELO CLIENTE', y);
  y += 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('Assinatura do Cliente', marginL, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.text('Nome do Cliente:  ' + (client?.legal_rep_name || ''), marginL, y);
  y += 10;
  doc.text('Assinatura', marginL, y);
  doc.setLineWidth(0.3);
  doc.line(marginL + 24, y, marginL + 24 + 70, y);
  y += 10;
  doc.text('Data:  ' + format(today, 'dd/MM/yyyy'), marginL, y);
  y += 6;

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter();
  }

  const dateStr = format(today, 'dd-MM-yyyy');
  const filename = `RELATÓRIO DE PRESTAÇÃO DE SERVIÇOS_${(client?.company_name || 'cliente')}_${dateStr}.pdf`;
  doc.save(filename);
}