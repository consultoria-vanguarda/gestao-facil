import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SERVICE_AREAS } from '@/components/utils/serviceAreas';
import { publicStorageObjectUrl } from '@/lib/supabasePublicStorage';

const SEBRAE_LOGO_URL = publicStorageObjectUrl(
  'public/695ebd99a400611ea331a00a/8efa5bac6_image.png'
);

const LEGACY_AREA_LABELS = {
  finances: 'Finanças',
  marketing: 'Marketing',
  planning: 'Planejamento',
  associativism: 'Associativismo',
  public_policies: 'Políticas Públicas',
};

// Converts an integer to Portuguese words (plain number, not currency)
function numberToWordsInteger(n) {
  const units = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove',
    'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const tens = ['','dez','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const hundreds = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos',
    'setecentos','oitocentos','novecentos'];

  function intToWords(num) {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    if (num < 20) return units[num];
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' e ' + units[num % 10] : '');
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return hundreds[h] + (rest !== 0 ? ' e ' + intToWords(rest) : '');
    }
    if (num < 1000000) {
      const k = Math.floor(num / 1000);
      const rest = num % 1000;
      const kWord = k === 1 ? 'mil' : intToWords(k) + ' mil';
      return kWord + (rest !== 0 ? (rest < 100 ? ' e ' : ' ') + intToWords(rest) : '');
    }
    const m = Math.floor(num / 1000000);
    const rest = num % 1000000;
    const mWord = m === 1 ? 'um milhão' : intToWords(m) + ' milhões';
    return mWord + (rest !== 0 ? (rest < 100 ? ' e ' : ' ') + intToWords(rest) : '');
  }

  if (n < 0) return 'menos ' + numberToWordsInteger(-n);
  const num = Math.round(n);
  if (num === 0) return 'zero';
  return intToWords(num);
}

// Converts a currency value to Portuguese words (for R$ amounts)
function numberToWordsCurrency(n) {
  const units = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove',
    'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const tens = ['','dez','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const hundreds = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos',
    'setecentos','oitocentos','novecentos'];

  function intToWords(num) {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    if (num < 20) return units[num];
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' e ' + units[num % 10] : '');
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return hundreds[h] + (rest !== 0 ? ' e ' + intToWords(rest) : '');
    }
    if (num < 1000000) {
      const k = Math.floor(num / 1000);
      const rest = num % 1000;
      const kWord = k === 1 ? 'mil' : intToWords(k) + ' mil';
      return kWord + (rest !== 0 ? (rest < 100 ? ' e ' : ' ') + intToWords(rest) : '');
    }
    const m = Math.floor(num / 1000000);
    const rest = num % 1000000;
    const mWord = m === 1 ? 'um milhão' : intToWords(m) + ' milhões';
    return mWord + (rest !== 0 ? (rest < 100 ? ' e ' : ' ') + intToWords(rest) : '');
  }

  if (n < 0) return 'menos ' + numberToWordsCurrency(-n);
  const total = Math.round(n * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;
  let result = '';
  if (reais === 0 && centavos === 0) return 'zero reais';
  if (reais > 0) result = intToWords(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos > 0) {
    const centWord = intToWords(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
    result = result ? result + ' e ' + centWord : centWord;
  }
  return result;
}

// Draw text (left-aligned, no justification) using jsPDF's reliable splitTextToSize
function drawJustifiedText(doc, text, x, y, maxWidth, lineHeight, fontSize, fontStyle = 'normal') {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  const paragraphs = text.split('\n');
  let curY = y;
  for (const para of paragraphs) {
    if (para.trim() === '') { curY += lineHeight * 0.6; continue; }
    const splitLines = doc.splitTextToSize(para, maxWidth);
    for (const line of splitLines) {
      doc.text(line, x, curY);
      curY += lineHeight;
    }
  }
  return curY;
}

function styleToPdfFont(style) {
  if (style.bold && style.italic) return 'bolditalic';
  if (style.bold) return 'bold';
  if (style.italic) return 'italic';
  return 'normal';
}

function parseRichRuns(text, defaultBold = false) {
  const runs = [];
  let bold = !!defaultBold;
  let italic = false;
  let buffer = '';

  const pushBuffer = () => {
    if (!buffer) return;
    const prev = runs[runs.length - 1];
    const style = { bold, italic };
    if (prev && prev.style.bold === style.bold && prev.style.italic === style.italic) {
      prev.text += buffer;
    } else {
      runs.push({ text: buffer, style });
    }
    buffer = '';
  };

  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('**', i)) {
      pushBuffer();
      bold = !bold;
      i += 1;
      continue;
    }
    if (text[i] === '*') {
      pushBuffer();
      italic = !italic;
      continue;
    }
    buffer += text[i];
  }
  pushBuffer();
  return runs;
}

function measureText(doc, text, fontSize, style) {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', styleToPdfFont(style));
  return doc.getTextWidth(text || '');
}

function wrapRichRuns(doc, runs, maxWidth, fontSize) {
  const lines = [];
  let current = [];
  let currentW = 0;

  const pushLine = () => {
    if (current.length === 0) return;
    lines.push(current);
    current = [];
    currentW = 0;
  };

  for (const run of runs) {
    const parts = String(run.text || '').split(/(\s+)/).filter((p) => p.length > 0);
    for (const part of parts) {
      const isSpace = /^\s+$/.test(part);
      if (isSpace && current.length === 0) continue;

      const w = measureText(doc, part, fontSize, run.style);
      if (!isSpace && current.length > 0 && currentW + w > maxWidth) {
        pushLine();
      }
      if (isSpace && current.length === 0) continue;
      current.push({ text: part, style: run.style });
      currentW += w;
    }
  }
  pushLine();
  return lines;
}

function drawRichLine(doc, runs, x, y, fontSize, black) {
  let cx = x;
  for (const run of runs) {
    if (!run.text) continue;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', styleToPdfFont(run.style));
    doc.setTextColor(...black);
    doc.text(run.text, cx, y);
    cx += doc.getTextWidth(run.text);
  }
}

// Draw a bordered box with justified text inside, returns height used
function drawJustifiedBox(doc, x, y, w, text, fontSize, black, padding = 3) {
  const maxW = w - padding * 2;
  const lineH = fontSize * 0.45;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');

  // Pre-calculate height
  let totalLines = 0;
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { totalLines += 0.6; continue; }
    const lines = doc.splitTextToSize(para, maxW);
    totalLines += lines.length;
  }
  const h = Math.max(14, totalLines * lineH + padding * 2 + 2);

  doc.setDrawColor(...black);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  doc.setTextColor(...black);
  drawJustifiedText(doc, text, x + padding, y + padding + lineH, maxW, lineH, fontSize);

  return h;
}

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

// Build schedule rows from project - uses schedule_config if available, otherwise auto-generates
function buildScheduleRows(project) {
  const savedConfig = project.schedule_config;
  if (savedConfig && savedConfig.length > 0) {
    const offDates = new Set(savedConfig.filter(r => r.isDayOff || r.is_day_off).map(r => r.date));
    const workRows = savedConfig.filter(r => !r.isDayOff && !r.is_day_off && !offDates.has(r.date));
    const configTotalHours = workRows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);
    const estimatedHours = parseFloat(project.estimated_hours) || 0;
    const isConfigValid = estimatedHours === 0 || Math.abs(configTotalHours - estimatedHours) <= 0.5;
    if (isConfigValid) {
      return workRows.map(r => {
        let dateObj;
        if (r.date && r.date.includes('/')) {
          const [dd, mm, yyyy] = r.date.split('/');
          dateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
        } else if (r.date) {
          dateObj = new Date(r.date + 'T12:00:00');
        } else {
          dateObj = new Date();
        }
        return {
          activity: r.activity || '',
          delivery: r.delivery || '',
          modality: r.modality || '',
          date: r.date && r.date.includes('/') ? r.date : (r.date ? format(dateObj, 'dd/MM/yyyy') : ''),
          dateObj,
          hours: parseFloat(r.hours) || 0,
        };
      });
    }
  }

  // Fallback: gerar automaticamente a partir das atividades (sem folgas customizadas)
  const activities = project.activities || [];
  const startDate = project.start_date;
  const hoursPerDay = parseFloat(project.hours_per_day) || 4;

  if (!startDate || activities.length === 0) return [];

  const HOLIDAYS = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];
  function isHoliday(d) {
    const md = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return HOLIDAYS.includes(md);
  }
  function nextWorkDay(d) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + 1);
    while (nd.getDay() === 0 || isHoliday(nd)) nd.setDate(nd.getDate() + 1);
    return nd;
  }

  const rows = [];
  let current = new Date(startDate + 'T12:00:00');
  while (current.getDay() === 0 || isHoliday(current)) current = nextWorkDay(current);

  for (const act of activities) {
    const numDays = act.days ? Math.max(1, parseInt(act.days)) : Math.ceil((parseFloat(act.hours) || 0) / hoursPerDay);
    const totalHrs = parseFloat(act.hours) || hoursPerDay;

    const totalInt = Math.round(totalHrs);
    const baseH = Math.floor(totalInt / numDays);
    const extraDays = totalInt % numDays;

    for (let d = 0; d < numDays; d++) {
      const hours = baseH + (d < extraDays ? 1 : 0);
      rows.push({
        activity: act.description || '',
        delivery: act.delivery || '',
        modality: act.modality || '',
        date: format(current, 'dd/MM/yyyy'),
        dateObj: new Date(current),
        hours: hours,
      });
      current = nextWorkDay(current);
    }
  }
  return rows;
}

// Get ordinal month label based on date relative to project start
function getMonthLabel(dateObj, startDateObj) {
  const startMonth = startDateObj.getFullYear() * 12 + startDateObj.getMonth();
  const rowMonth = dateObj.getFullYear() * 12 + dateObj.getMonth();
  const diff = rowMonth - startMonth;
  const ordinals = ['1º Mês','2º Mês','3º Mês','4º Mês','5º Mês','6º Mês',
    '7º Mês','8º Mês','9º Mês','10º Mês','11º Mês','12º Mês'];
  return ordinals[diff] || `${diff+1}º Mês`;
}

export async function downloadConsultingProposal(project, client) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const black = [0, 0, 0];
  const today = new Date();
  const todayStr = format(today, 'dd/MM/yyyy');

  // Load logo
  let logoDataUrl = null;
  try { logoDataUrl = await loadImageAsBase64(SEBRAE_LOGO_URL); } catch(e) {}

  // ─── Header ───────────────────────────────────────────────────────────────
  const headerY = 12;
  const headerH = 26;
  const logoX = marginL + 2;
  const logoY = headerY + 2;
  const logoW = 22;
  const logoH = 22;

  function drawHeader() {
    // Outer border
    doc.setDrawColor(...black);
    doc.setLineWidth(0.5);
    doc.rect(marginL, headerY, contentW, headerH);

    // Logo
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);

    // Vertical divider after logo
    const divX = logoX + logoW + 2;
    doc.setLineWidth(0.4);
    doc.line(divX, headerY, divX, headerY + headerH);

    // Right side text
    const txtX = divX + 4;
    const rightW = contentW - (divX - marginL) - 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.text('PROPOSTA TÉCNICA PARA REALIZAÇÃO', txtX + rightW / 2, headerY + 7, { align: 'center' });
    doc.text('DE SERVIÇOS AO CLIENTE', txtX + rightW / 2, headerY + 12, { align: 'center' });

    // Horizontal divider
    const divY = headerY + 16;
    doc.setLineWidth(0.4);
    doc.line(divX, divY, marginL + contentW, divY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSULTORIA DE GESTÃO SOB DEMANDA', txtX + rightW / 2, headerY + 22, { align: 'center' });
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  function drawFooter(pageNum) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Uso Interno', marginL, 290);
  }

  // ─── Section title (bold, optionally underlined) ───────────────────────────
  function sectionTitle(text, y, noUnderline = false) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(text, marginL, y);
    if (!noUnderline) {
      const w = doc.getTextWidth(text);
      doc.setLineWidth(0.3);
      doc.line(marginL, y + 0.8, marginL + w, y + 0.8);
    }
    return y + 6;
  }

  // ─── Simple bordered box with plain text (uses jsPDF splitTextToSize, no overlap) ──
  function borderedBox(x, y, w, h, text, opts = {}) {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    if (text) {
      const fs = opts.fontSize || 10;
      const pad = 3;
      const lineH = fs * 0.52;
      doc.setFontSize(fs);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(...black);
      const paragraphs = text.split('\n');
      let ty = y + pad + lineH;
      for (const para of paragraphs) {
        if (para.trim() === '') { ty += lineH * 0.6; continue; }
        const lines = doc.splitTextToSize(para, w - pad * 2 - 1);
        for (let li = 0; li < lines.length; li++) {
          const isLastLine = li === lines.length - 1;
          if (opts.justify && !isLastLine) {
            justifyLine(lines[li], x + pad, ty, w - pad * 2);
          } else {
            doc.text(lines[li], x + pad, ty);
          }
          ty += lineH;
        }
      }
    }
  }

  // ─── Row in a simple table ────────────────────────────────────────────────
  function tableRow(x, y, w, h, label, value, labelW) {
    const lw = labelW || w * 0.35;
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.line(x + lw, y, x + lw, y + h);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(label, x + 3, y + h/2 + 1.5);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || '', w - lw - 4);
    doc.text(lines, x + lw + 3, y + h/2 + 1.5 - ((lines.length-1)*2.5));
  }

  // ─── Draw a justified line (distribute word spacing to fill maxWidth) ───────
  function justifyLine(text, x, y, maxWidth) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 1) { doc.text(text, x, y); return; }
    const totalWordWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
    const gap = (maxWidth - totalWordWidth) / (words.length - 1);
    let cx = x;
    for (const word of words) {
      doc.text(word, cx, y);
      cx += doc.getTextWidth(word) + gap;
    }
  }

  const pageBottom = 275;

  // ─── Tokenize text into renderable justified lines ───────────────────────
  function tokenize(text, fontSize, bold = false) {
    const result = [];
    for (const para of (text || '').split('\n')) {
      if (para.trim() === '') { result.push({ spacer: true }); continue; }
      const richRuns = parseRichRuns(para, bold);
      const lines = wrapRichRuns(doc, richRuns, contentW - 8, fontSize);
      lines.forEach((lineRuns, i, arr) => {
        const plainText = lineRuns.map((r) => r.text).join('');
        result.push({
          text: plainText,
          runs: lineRuns,
          hasRich: lineRuns.some((r) => r.style.bold || r.style.italic),
          isLast: i === arr.length - 1,
          bold,
        });
      });
    }
    return result;
  }

  // ─── Multi-page justified box ─────────────────────────────────────────────
  // Renders tokens inside bordered box(es), breaking across pages as needed.
  // Returns final y after the last box.
  function drawBoxMultiPage(tokens, startY, fontSize = 10, pad = 4) {
    if (!tokens || tokens.length === 0) {
      doc.setDrawColor(...black); doc.setLineWidth(0.3);
      doc.rect(marginL, startY, contentW, 14);
      return startY + 20;
    }
    const lineH = fontSize * 0.52;
    const maxW = contentW - pad * 2;
    let y = startY;
    let idx = 0;
    while (idx < tokens.length) {
      const available = pageBottom - y - pad * 2 - lineH;
      let used = 0; let count = 0; let j = idx;
      while (j < tokens.length) {
        const step = tokens[j].spacer ? lineH * 0.6 : lineH;
        if (used + step > available) break;
        used += step; count++; j++;
      }
      if (count === 0) count = 1;
      const boxH = used + pad * 2 + lineH * 0.3;
      doc.setDrawColor(...black); doc.setLineWidth(0.3);
      doc.rect(marginL, y, contentW, boxH);
      let ty = y + pad + lineH;
      for (let k = idx; k < idx + count && k < tokens.length; k++) {
        const tok = tokens[k];
        if (tok.spacer) { ty += lineH * 0.6; continue; }
        doc.setTextColor(...black);
        if (tok.runs && tok.runs.length > 0) {
          drawRichLine(doc, tok.runs, marginL + pad, ty, fontSize, black);
        } else if (!tok.isLast && !tok.bold && !tok.hasRich) {
          justifyLine(tok.text, marginL + pad, ty, maxW);
        } else {
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', tok.bold ? 'bold' : 'normal');
          doc.text(tok.text, marginL + pad, ty);
        }
        ty += lineH;
      }
      idx += count;
      y += boxH + 6;
      if (idx < tokens.length) {
        doc.addPage(); drawHeader(); drawFooter();
        y = headerY + headerH + 10;
      }
    }
    return y;
  }

  // ========== PAGE 1 ==========
  drawHeader();
  drawFooter(1);

  // Date line
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(`Goiânia, ${todayStr}.`, pageW - marginR, headerY + headerH + 8, { align: 'right' });

  let y = headerY + headerH + 16;

  // 1 - DADOS DO CLIENTE
  y = sectionTitle('1 - DADOS DO CLIENTE', y, true);
  y += 2;

  const clientRows = [
    ['1.1.  Razão Social: ', client?.company_name || ''],
    ['1.2.  CNPJ: ', client?.document || ''],
    ['1.3.  Endereço de execução do serviço com CEP: ', client?.address || ''],
    ['1.4.  Representante Legal: ', client?.legal_rep_name || ''],
    ['1.5.  Código FOCO da empresa: ', client?.foco_code_company || ''],
    ['1.6.  Código FOCO Representante Legal: ', client?.foco_code_rep || ''],
  ];
  // Linha superior do bloco
  doc.setDrawColor(...black);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginL + contentW, y);
  for (const [label, val] of clientRows) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    const fullText = label + val;
    const textLines = doc.splitTextToSize(fullText, contentW - 6);
    const lineH = 5.2;
    const rowH = textLines.length > 1 ? textLines.length * lineH + 3 : 6.5;
    for (let li = 0; li < textLines.length; li++) {
      doc.text(textLines[li], marginL + 3, y + 4.5 + li * lineH);
    }
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.line(marginL, y + rowH, marginL + contentW, y + rowH);
    y += rowH;
  }
  y += 6;

  // 2 - ÁREA/SUBÁREA
  y = sectionTitle('2 - ÁREA/SUBÁREA', y, true);
  y += 2;

  const areaLabel = project.area === 'custom'
    ? (project.custom_area || '')
    : (SERVICE_AREAS?.[project.area]?.label || LEGACY_AREA_LABELS[project.area] || project.area || '');
  const subareaLabel = project.subarea || project.custom_subarea || '';

  // Linha superior do bloco área/subárea
  doc.setDrawColor(...black);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginL + contentW, y);
  for (const [label, val] of [['2.1  ÁREA: ', areaLabel], ['2.2.  SUBÁREA: ', subareaLabel]]) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    doc.text(label + val, marginL + 3, y + 3.8);
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.line(marginL, y + 6, marginL + contentW, y + 6);
    y += 6;
  }
  y += 3;

  // Objective box (suporta negrito/itálico via marcadores **texto** e *texto*)
  const objectiveText = '2.3. OBJETIVO: ' + (project.objective || '');
  y = drawBoxMultiPage(tokenize(objectiveText, 10), y);

  // 3 - NECESSIDADES DO CLIENTE
  y = sectionTitle('3 - NECESSIDADES DO CLIENTE', y);
  y += 2;
  y = drawBoxMultiPage(tokenize(project.client_needs || '', 10), y);

  // 4 - DETALHAMENTO
  const detailText = project.service_detail || '';
  if (detailText.trim()) {
    if (y + 20 > pageBottom) { doc.addPage(); drawHeader(); drawFooter(); y = headerY + headerH + 10; }
    y = sectionTitle('4 - DETALHAMENTO DO SERVIÇO A SER REALIZADO', y);
    y += 4;

    // Montar tokens do detalhe + bloco produto final no mesmo box
    const customProdFinal = project.produto_final && project.produto_final.trim();
    const tokens4 = tokenize(detailText, 10);
    // separador
    tokens4.push({ spacer: true });
    if (customProdFinal) {
      tokenize(customProdFinal, 10).forEach(t => tokens4.push(t));
    } else {
      tokenize('PRODUTO FINAL A SER DISPONIBILIZADO PARA O CLIENTE:', 10, true).forEach(t => tokens4.push(t));
      tokens4.push({ text: '01 (um) PLANO DE NEGÓCIO.', isLast: true, bold: false });
      tokenize('Obs: Os custos de aquisição, implantação e treinamento não fazem parte da presente proposta.', 10, true).forEach(t => tokens4.push(t));
    }
    y = drawBoxMultiPage(tokens4, y);
  }

  // Pré-cálculo do cronograma para usar no item 5 e na tabela do item 6.
  const scheduleRows = buildScheduleRows(project);
  const monthsCovered = new Set(
    scheduleRows
      .map((r) => {
        if (!r?.dateObj || Number.isNaN(new Date(r.dateObj).getTime())) return null;
        const d = new Date(r.dateObj);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })
      .filter(Boolean)
  );
  const durationMonths = Math.max(1, monthsCovered.size || 0);
  const monthsWord = numberToWordsInteger(durationMonths);

  // 5 - HORAS TÉCNICAS
  const estimatedHours = parseFloat(project.estimated_hours) || 0;
  const hoursWord = numberToWordsInteger(estimatedHours);
  const hoursText = `Para a realização do trabalho foram estimadas ${estimatedHours} (${hoursWord}) horas técnicas a serem realizadas durante ${durationMonths} (${monthsWord}) meses de trabalho, contados a partir da data de início dos trabalhos conforme cronograma.`;
  
  // Calculate height based on borderedBox logic
  {
    const fs5 = 10;
    const pad5 = 3;
    const lineH5 = fs5 * 0.52;
    doc.setFontSize(fs5);
    doc.setFont('helvetica', 'normal');
    
    let totalLines5 = 0;
    for (const para of hoursText.split('\n')) {
      if (para.trim() === '') { totalLines5 += 0.6; continue; }
      totalLines5 += doc.splitTextToSize(para, contentW - pad5 * 2).length;
    }
    const hoursH = totalLines5 * lineH5 + pad5 * 2 + 2;
    
    if (y + 12 + hoursH > pageBottom) { doc.addPage(); drawHeader(); drawFooter(); y = headerY + headerH + 10; }
    y = sectionTitle('5 – PREVISÃO DE HORAS TÉCNICAS (Quantidade de horas e duração):', y);
    y += 4;
    borderedBox(marginL, y, contentW, hoursH, hoursText, { fontSize: fs5, justify: true });
    y += hoursH + 8;
  }

  // ========== CRONOGRAMA - página nova só se necessário ==========
  if (y + 40 > pageBottom) {
    doc.addPage();
    drawHeader();
    drawFooter();
    y = headerY + headerH + 10;
  }

  // 6 - CRONOGRAMA
  y = sectionTitle('6 – PREVISÃO DE CRONOGRAMA PARA EXECUÇÃO:', y);
  y += 4;

  // Build schedule rows
  const startDateObj = project.start_date ? new Date(project.start_date + 'T12:00:00') : new Date();

  // Build table body with rowSpan for Atividades, Mês (per month block), Entregas
  const tableBody = [];

  // We need to track month spans globally (not per activity) since Mês changes across activities
  // Group consecutive rows with same month for "Mês" merging across entire table
  let i = 0;
  let globalRowIdx = 0;
  // First pass: assign month labels to all rows
  const allRowsWithMonth = scheduleRows.map(r => ({
    ...r,
    monthLabel: getMonthLabel(r.dateObj, startDateObj),
  }));

  // Group rows by activity (consecutive same activity = merge Atividades + Entregas)
  // Group rows by month (consecutive same month across all rows = merge Mês)
  let rowIdx = 0;
  while (rowIdx < allRowsWithMonth.length) {
    const actRow = allRowsWithMonth[rowIdx];
    // Count how many consecutive rows have the same activity
    let actEnd = rowIdx;
    while (actEnd < allRowsWithMonth.length && allRowsWithMonth[actEnd].activity === actRow.activity) actEnd++;
    const actSpan = actEnd - rowIdx;

    for (let a = 0; a < actSpan; a++) {
      const r = allRowsWithMonth[rowIdx + a];
      const row = [];

      // Col 0: Atividades - rowSpan for all rows of this activity
      if (a === 0) {
        row.push({ content: r.activity, rowSpan: actSpan, styles: { valign: 'middle', halign: 'center', fontSize: 8, textColor: [220, 0, 0] } });
      }

      // Col 1: Mês - each row always shows its month label (filled, no gaps)
      row.push({ content: r.monthLabel, styles: { halign: 'center', fontSize: 8, valign: 'middle', textColor: [220, 0, 0] } });

      // Col 2: Data
      row.push({ content: r.date, styles: { halign: 'center', fontSize: 8, textColor: [220, 0, 0] } });

      // Col 3: Presencial/Remota/Escritório
      row.push({ content: r.modality || '', styles: { halign: 'center', fontSize: 8, textColor: [220, 0, 0] } });

      // Col 4: Quantidade de horas
      row.push({ content: r.hours ? r.hours.toFixed(0) : '', styles: { halign: 'center', fontSize: 8, textColor: [220, 0, 0] } });

      // Col 5: Entregas/Relatórios - rowSpan for all rows of this activity
      if (a === 0) {
        row.push({ content: r.delivery || '', rowSpan: actSpan, styles: { valign: 'middle', halign: 'center', fontSize: 8, textColor: [220, 0, 0] } });
      }

      tableBody.push(row);
    }
    rowIdx = actEnd;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    head: [[
      { content: 'Atividades', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: 'Mês', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: 'Data', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: 'Presencial\n/ Remota/\nEscritório', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: 'Quantidade\nde horas', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: 'Entregas/Relatórios', styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
    ]],
    showFoot: 'lastPage',
    body: tableBody,
    foot: [[
      { content: 'TOTAL DE HORAS', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } },
      { content: `${estimatedHours}`, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9, textColor: [220, 0, 0] } },
    ]],
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 18 },
      5: { cellWidth: 'auto' },
    },
    styles: {
      lineColor: black,
      lineWidth: 0.3,
      cellPadding: 2,
      fontSize: 8,
      textColor: black,
      overflow: 'linebreak',
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.3,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.3,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
  });

  y = doc.lastAutoTable.finalY + 8;

  // 7 - CONDIÇÕES
  // If near bottom, add new page
  if (y > 220) { doc.addPage(); drawHeader(); drawFooter(3); y = headerY + headerH + 10; }

  y = sectionTitle('7 – CONDIÇÕES PARA REALIZAÇÃO DA CONSULTORIA:', y);
  y += 2;

  const cond1 = 'Para a realização dos trabalhos será necessário o fornecimento de informações que é de responsabilidade do cliente.';
  const cond2 = 'A empresa deverá designar um profissional do quadro, que independente das suas atribuições será responsável pela condução junto com o consultor do processo de implantação das ações de melhorias. Portanto, deve ter conhecimento dos processos da empresa, confiança da direção e facilidade de relacionamento interno. Será o interlocutor entre a empresa e o SEBRAE para o cumprimento das atividades previstas nesta proposta.';
  const cond3 = 'Como o trabalho tem caráter de levantamento de informações para orientação da consultoria, parte do serviço pode ocorrer no escritório do consultor designado para o trabalho, sendo responsabilidade do cliente, avaliar e atestar as atividades de compilação e formatação dos dados.';

  const condAll = cond1 + '\n\n' + cond2 + '\n\n' + cond3;
  y = drawBoxMultiPage(tokenize(condAll, 10), y);

  // ========== PAGE 3 (or continue) - Values + Aceite ==========
  if (y > 200) { doc.addPage(); drawHeader(); drawFooter(3); y = headerY + headerH + 10; }

  // 8 - DISCRIMINAÇÃO DOS VALORES
  y = sectionTitle('8 – DISCRIMINAÇÃO DOS VALORES:', y);
  y += 4;

  const contractedValue = parseFloat(project.contracted_value) || 0;
  const subsidyPct = parseFloat(project.subsidy_percent) || 70;
  const subsidyValue = contractedValue * (subsidyPct / 100);
  const clientValue = contractedValue - subsidyValue;

  const fmtBRL = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const paymentMap = { avista: 'À Vista', cartao: 'Cartão em até 10x' };
  const paymentStr = paymentMap[project.payment_method] || project.payment_method || '';

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    head: [[
      { content: '', styles: { cellWidth: 'auto' } },
      { content: 'QUANTIDADE', styles: { halign: 'center', fontStyle: 'bold', fontSize: 10, cellWidth: 35 } },
      { content: 'VALOR TOTAL', styles: { halign: 'center', fontStyle: 'bold', fontSize: 10, cellWidth: 40 } },
    ]],
    body: [
      [
        { content: '1) Valor total da consultoria (Hora Técnica) *', styles: { fontStyle: 'normal' } },
        { content: `${estimatedHours} horas`, styles: { halign: 'center' } },
        { content: fmtBRL(contractedValue), styles: { halign: 'center' } },
      ],
      [
        { content: '2) Percentual de subsídio concedido', styles: { fontStyle: 'normal' } },
        { content: `${subsidyPct}%`, styles: { halign: 'center' } },
        { content: fmtBRL(subsidyValue), styles: { halign: 'center' } },
      ],
      [
        { content: '3) Valor a ser pago pelo cliente**', colSpan: 2, styles: { fontStyle: 'bold' } },
        { content: fmtBRL(clientValue), styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: 'FORMA DE PAGAMENTO (À Vista/Cartão)', styles: { fontStyle: 'normal' } },
        { content: 'À Vista / Cartão em até 10x', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    styles: {
      lineColor: black,
      lineWidth: 0.3,
      fontSize: 10,
      textColor: black,
      cellPadding: 3,
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
    },
  });

  const clientValueWords = numberToWordsCurrency(clientValue);
  const notesText8 = `*O valor total da consultoria inclui os valores das horas de Consultoria a serem realizadas na empresa e no escritório do consultor credenciado e dos deslocamentos e alimentação para o atendimento, se houver, conforme apresentando na tabela acima (item 1).\nNeste valor não estão inclusos os valores referentes à locação de espaço físico, equipamentos e lanches para a realização das atividades que envolverão os colaboradores, sendo de responsabilidade da empresa, se ocorrer.\n**O valor a ser pago pelo cliente já estabelece o percentual concedido pelo Sebrae, conforme apresentando na tabela acima (item 3).\nO valor a ser pago será de ${fmtBRL(clientValue)} (${clientValueWords})`;

  // Notas campo 8: caixa manual com texto justificado, continuação visual da tabela acima
  {
    const notesStartY = doc.lastAutoTable.finalY;
    const fs8 = 9;
    const pad8 = 3;
    const lineH8 = fs8 * 0.52;
    doc.setFontSize(fs8);
    doc.setFont('helvetica', 'normal');
    const notes8Paragraphs = notesText8.split('\n');
    let totalNoteLines8 = 0;
    for (const para of notes8Paragraphs) {
      if (para.trim() === '') { totalNoteLines8 += 0.6; continue; }
      totalNoteLines8 += doc.splitTextToSize(para, contentW - pad8 * 2).length;
    }
    const notesBoxH = Math.max(20, totalNoteLines8 * lineH8 + pad8 * 2 + 6);
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(marginL, notesStartY, contentW, notesBoxH);
    let ty8 = notesStartY + pad8 + lineH8;
    for (const para of notes8Paragraphs) {
      if (para.trim() === '') { ty8 += lineH8 * 0.6; continue; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fs8);
      doc.setTextColor(...black);
      const noteLines = doc.splitTextToSize(para, contentW - pad8 * 2);
      for (let li = 0; li < noteLines.length; li++) {
        const isLast = li === noteLines.length - 1;
        if (!isLast) { justifyLine(noteLines[li], marginL + pad8, ty8, contentW - pad8 * 2); }
        else { doc.text(noteLines[li], marginL + pad8, ty8); }
        ty8 += lineH8;
      }
      ty8 += lineH8 * 0.3;
    }
    y = notesStartY + notesBoxH + 12;
  }

  // 9 - ACEITE
  if (y > 230) { doc.addPage(); drawHeader(); drawFooter(); y = headerY + headerH + 10; }
  y = sectionTitle('9 – ACEITE DO CLIENTE:', y);
  y += 2;

  // Renderiza parágrafo com trecho em negrito inline (palavra a palavra)
  const aceiteFontSize = 10;
  const aceiteLineH = 5.5;
  const renderParagraph = (paraText, boldPhrase, startY) => {
    doc.setFontSize(aceiteFontSize);
    doc.setTextColor(...black);
    if (!boldPhrase || paraText.indexOf(boldPhrase) === -1) {
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(paraText, contentW);
      for (const line of lines) { doc.text(line, marginL, startY); startY += aceiteLineH; }
      return startY;
    }
    const bStart = paraText.indexOf(boldPhrase);
    const bEnd = bStart + boldPhrase.length;
    const makeTokens = (txt, bold) => txt.split(' ').filter(Boolean).map(w => ({ w, bold }));
    const tokens = [
      ...makeTokens(paraText.substring(0, bStart), false),
      ...makeTokens(paraText.substring(bStart, bEnd), true),
      ...makeTokens(paraText.substring(bEnd), false),
    ];
    let cx = marginL;
    let cy = startY;
    for (let i = 0; i < tokens.length; i++) {
      const { w, bold } = tokens[i];
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const spaceW = doc.getTextWidth(' ');
      const wordW = doc.getTextWidth(w);
      if (cx + wordW > marginL + contentW && cx > marginL) { cx = marginL; cy += aceiteLineH; }
      doc.text(w, cx, cy);
      cx += wordW + (i < tokens.length - 1 ? spaceW : 0);
    }
    return cy + aceiteLineH;
  };

  const aceite1 = 'O aceite da proposta se dará a partir da autorização formal do representante legal da empresa para a elaboração do contrato, mencionando a ciência de que o início do trabalho se dará após a assinatura do contrato firmado entre as partes.';
  const aceite2 = 'Para a confecção do contrato de prestação de serviços ente o SEBRAE e a empresa deverão ser encaminhados junto com o aceite da proposta uma cópia legível do CNPJ, Contrato Social com a última alteração, documentos de identificação do representante legal da empresa e comprovante de endereço.';
  const aceite2Bold = 'CNPJ, Contrato Social com a última alteração, documentos de identificação do representante legal da empresa e comprovante de endereço';
  const aceite3 = 'Esta proposta tem validade de 30 dias, contados a partir da data de sua emissão.';

  if (y + 40 > 275) { doc.addPage(); drawHeader(); drawFooter(); y = headerY + headerH + 10; }
  doc.setTextColor(...black);
  y = renderParagraph(aceite1, null, y);
  y += aceiteLineH * 0.6;
  y = renderParagraph(aceite2, aceite2Bold, y);
  y += aceiteLineH * 0.6;
  y = renderParagraph(aceite3, null, y);
  y += 6;

  // Date + signature
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(`DATA: ${todayStr}`, pageW / 2, y + 6, { align: 'center' });
  y += 24; // espaço entre data e linha de assinatura

  // Linha de assinatura centralizada
  const sigLineW = 90;
  const sigLineX = (pageW - sigLineW) / 2;
  doc.setDrawColor(...black);
  doc.setLineWidth(0.4);
  doc.line(sigLineX, y, sigLineX + sigLineW, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.legal_rep_name || 'Nome do Representante Legal', pageW / 2, y, { align: 'center' });
  doc.text('ASSINATURA DO CLIENTE', pageW / 2, y + 6, { align: 'center' });
  doc.text('REPRESENTANTE LEGAL CONFORME DOCUMENTAÇÃO SOLICITADA', pageW / 2, y + 12, { align: 'center' });
  y += 22;

  // 10 - CONTATOS SEBRAE
  if (y > 240) { doc.addPage(); drawHeader(); drawFooter(); y = headerY + headerH + 10; }
  y = sectionTitle('10 – PESSOAS DE CONTATOS DO SEBRAE/GO:', y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    tableWidth: contentW,
    body: [
      [
        { content: 'GESTOR RESPONSÁVEL', styles: { fontStyle: 'bold' } },
        { content: project.sebrae_manager_name || '' },
        { content: 'FONE', styles: { fontStyle: 'bold' } },
        { content: project.sebrae_manager_phone || '' },
      ],
      [
        { content: 'GERENTE DA REGIONAL', styles: { fontStyle: 'bold' } },
        { content: project.sebrae_regional_name || '' },
        { content: 'FONE', styles: { fontStyle: 'bold' } },
        { content: project.sebrae_regional_phone || '' },
      ],
    ],
    styles: {
      lineColor: black,
      lineWidth: 0.3,
      fontSize: 10,
      textColor: black,
      cellPadding: 4,
      fillColor: [255, 255, 255],
    },
    headStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22 },
      3: { cellWidth: 40 },
    },
  });

  // Add "Uso Interno" to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p);
  }

  const dateStr = format(today, 'dd-MM-yyyy');
  const filename = `PROPOSTA DE CONSULTORIA_${(client?.company_name || 'cliente')}_${dateStr}.pdf`;
  doc.save(filename);
}