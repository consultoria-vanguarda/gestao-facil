import { api } from '@/api/appApi';
import { format, lastDayOfMonth } from 'date-fns';

const TAX_ACCOUNT_CODE = '3.2.01';
const TAX_ENTRY_MARKER = 'ref:billing:';

function parseRatePercent(value) {
  const rate = Number(value);
  return Number.isFinite(rate) ? rate : 0;
}

function buildTaxDescription({ ratePercent, receivedDate, entryId }) {
  return `Imposto Simples Nacional (${ratePercent}%) — receb. ${receivedDate} — ${TAX_ENTRY_MARKER}${entryId}`;
}

function buildTaxLoteDescription({ ratePercent, receivedDate, loteKey }) {
  return `Imposto Simples Nacional em lote (${ratePercent}%) — receb. ${receivedDate} — ${loteKey}`;
}

async function resolveTaxChartAccount() {
  const chartAccounts = await api.entities.ChartOfAccounts.list();
  const expenseAccounts = chartAccounts.filter((a) => a.type === 'expense' && a.active !== false);

  const byCode = expenseAccounts.find((a) => a.code === TAX_ACCOUNT_CODE);
  if (byCode) return byCode;

  // Fallback por nome (evita match genérico em "Taxas" via substring "tax")
  return expenseAccounts.find((a) => {
    const name = a.name?.toLowerCase() || '';
    return (
      name.includes('simples nacional')
      || name.includes('imposto unificado')
      || (name.includes('das') && name.includes('imposto'))
      || name.includes('simples')
    );
  }) || null;
}

async function resolveTaxRate(referenceMonth, taxRates) {
  let rates = Array.isArray(taxRates) ? taxRates : [];
  if (rates.length === 0) {
    rates = await api.entities.TaxRate.list();
  }
  const taxRate = rates.find((t) => t.month === referenceMonth);
  return parseRatePercent(taxRate?.rate_percent);
}

async function hasExpenseForBillingEntry(entryId) {
  if (!entryId) return false;
  const expenses = await api.entities.Expense.list();
  const marker = `${TAX_ENTRY_MARKER}${entryId}`;
  return expenses.some((e) => (e.description || '').includes(marker));
}

/**
 * Ao EFETIVAR um recebimento (status -> received), busca a alíquota do mês de referência
 * e cria uma Expense (A Pagar) com vencimento no último dia do mês, na conta 3.2.01
 * (Imposto Unificado - DAS / Simples Nacional).
 *
 * @param {object} entry - BillingEntry que acabou de ser recebido
 * @param {string} receivedDate - Data do recebimento (yyyy-MM-dd)
 * @param {Array} taxRates - Array de TaxRate já carregado (opcional)
 * @returns {object|null} despesa criada ou null se não houver alíquota / já existir
 */
export async function lancaImpostoDespesa(entry, receivedDate, taxRates) {
  if (!receivedDate || !entry?.amount || !entry?.id) return null;

  const referenceMonth = receivedDate.slice(0, 7); // YYYY-MM
  const ratePercent = await resolveTaxRate(referenceMonth, taxRates);
  if (ratePercent <= 0) return null;

  if (await hasExpenseForBillingEntry(entry.id)) return null;

  const taxAmount = Math.round((Number(entry.amount) * ratePercent) / 100 * 100) / 100;
  if (taxAmount <= 0) return null;

  const [y, m] = referenceMonth.split('-');
  const lastDay = lastDayOfMonth(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
  const dueDate = format(lastDay, 'yyyy-MM-dd');
  const taxAccount = await resolveTaxChartAccount();
  const description = buildTaxDescription({ ratePercent, receivedDate, entryId: entry.id });

  const expense = await api.entities.Expense.create({
    project_id: entry.project_id || null,
    chart_account_id: taxAccount?.id || null,
    category: 'administrative',
    description,
    amount: taxAmount,
    due_date: dueDate,
    status: 'to_pay',
  });

  try {
    await api.entities.TaxExpenseEntry.create({
      billing_entry_id: entry.id,
      chart_account_code: taxAccount?.code || TAX_ACCOUNT_CODE,
      reference_month: referenceMonth,
      billed_date: receivedDate,
      revenue_amount: Number(entry.amount),
      tax_rate_percent: ratePercent,
      tax_amount: taxAmount,
      description,
      project_id: entry.project_id || null,
    });
  } catch (err) {
    // Auditoria é complementar; a despesa a pagar já foi criada.
    console.warn('Falha ao registrar tax_expense_entry:', err);
  }

  return expense;
}

/**
 * Versão para lote: lança imposto sobre um valor total (não por entry individual),
 * agrupando tudo em uma única Expense do mês.
 */
export async function lancaImpostoDespesaLote(totalAmount, receivedDate, taxRates, projectId, entryIds = []) {
  if (!receivedDate || !totalAmount) return null;

  const referenceMonth = receivedDate.slice(0, 7);
  const ratePercent = await resolveTaxRate(referenceMonth, taxRates);
  if (ratePercent <= 0) return null;

  const taxAmount = Math.round((Number(totalAmount) * ratePercent) / 100 * 100) / 100;
  if (taxAmount <= 0) return null;

  // Evita duplicar se todas as entradas do lote já tiverem despesa individual
  if (entryIds.length > 0) {
    const already = await Promise.all(entryIds.map((id) => hasExpenseForBillingEntry(id)));
    if (already.every(Boolean)) return null;
  }

  const [y, m] = referenceMonth.split('-');
  const lastDay = lastDayOfMonth(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
  const dueDate = format(lastDay, 'yyyy-MM-dd');
  const taxAccount = await resolveTaxChartAccount();

  const loteKey = entryIds.length > 0
    ? `ref:lote:${entryIds.slice().sort().join(',')}`
    : `ref:lote:${receivedDate}:${taxAmount}`;

  const description = buildTaxLoteDescription({ ratePercent, receivedDate, loteKey });

  const expenses = await api.entities.Expense.list();
  if (expenses.some((e) => (e.description || '').includes(loteKey))) return null;

  const expense = await api.entities.Expense.create({
    project_id: projectId || null,
    chart_account_id: taxAccount?.id || null,
    category: 'administrative',
    description,
    amount: taxAmount,
    due_date: dueDate,
    status: 'to_pay',
  });

  return expense;
}
