import { api } from '@/api/appApi';
import { format, lastDayOfMonth } from 'date-fns';

/**
 * Ao EFETIVAR um recebimento (status -> received), busca a alíquota do mês de referência
 * e cria uma Expense (A Pagar) com vencimento no último dia do mês, lançada na conta
 * do Plano de Contas que contém o nome do imposto (ex: "Simples Nacional").
 *
 * @param {object} entry - BillingEntry que acabou de ser recebido
 * @param {string} receivedDate - Data do recebimento (yyyy-MM-dd)
 * @param {Array} taxRates - Array de TaxRate já carregado
 */
export async function lancaImpostoDespesa(entry, receivedDate, taxRates) {
  if (!receivedDate || !entry?.amount) return;

  // Mês de referência = mês do recebimento
  const referenceMonth = receivedDate.slice(0, 7); // YYYY-MM

  // Busca alíquota do mês
  const taxRate = taxRates.find(t => t.month === referenceMonth);
  const ratePercent = taxRate?.rate_percent || 0;

  if (ratePercent <= 0) return; // sem alíquota cadastrada, não lança

  const taxAmount = Math.round((entry.amount * ratePercent) / 100 * 100) / 100;

  // Vencimento = último dia do mês do recebimento
  const [y, m] = referenceMonth.split('-');
  const lastDay = lastDayOfMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
  const dueDate = format(lastDay, 'yyyy-MM-dd');

  // Busca conta do Plano de Contas pelo nome (type = expense)
  // Tenta encontrar conta com "Simples" no nome, ou "Imposto", ou "Tax"
  const chartAccounts = await api.entities.ChartOfAccounts.filter({ type: 'expense' });
  const taxAccount = chartAccounts.find(a =>
    a.name?.toLowerCase().includes('simples') ||
    a.name?.toLowerCase().includes('imposto') ||
    a.name?.toLowerCase().includes('das') ||
    a.name?.toLowerCase().includes('inss') ||
    a.name?.toLowerCase().includes('tax')
  );

  // Verifica se já existe despesa de imposto para este billing_entry
  const existing = await api.entities.Expense.filter({ description: `Imposto (${ratePercent}%) — receb. ${receivedDate} — ${entry.id}` });
  if (existing.length > 0) return;

  await api.entities.Expense.create({
    project_id: entry.project_id || '',
    chart_account_id: taxAccount?.id || '',
    category: 'administrative',
    description: `Imposto (${ratePercent}%) — receb. ${receivedDate} — ${entry.id}`,
    amount: taxAmount,
    due_date: dueDate,
    status: 'to_pay',
  });
}

/**
 * Versão para lote: lança imposto sobre um valor total (não por entry individual),
 * agrupando tudo em uma única Expense do mês.
 */
export async function lancaImpostoDespesaLote(totalAmount, receivedDate, taxRates, projectId) {
  if (!receivedDate || !totalAmount) return;

  const referenceMonth = receivedDate.slice(0, 7);
  const taxRate = taxRates.find(t => t.month === referenceMonth);
  const ratePercent = taxRate?.rate_percent || 0;

  if (ratePercent <= 0) return;

  const taxAmount = Math.round((totalAmount * ratePercent) / 100 * 100) / 100;

  const [y, m] = referenceMonth.split('-');
  const lastDay = lastDayOfMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
  const dueDate = format(lastDay, 'yyyy-MM-dd');

  const chartAccounts = await api.entities.ChartOfAccounts.filter({ type: 'expense' });
  const taxAccount = chartAccounts.find(a =>
    a.name?.toLowerCase().includes('simples') ||
    a.name?.toLowerCase().includes('imposto') ||
    a.name?.toLowerCase().includes('das') ||
    a.name?.toLowerCase().includes('inss') ||
    a.name?.toLowerCase().includes('tax')
  );

  await api.entities.Expense.create({
    project_id: projectId || '',
    chart_account_id: taxAccount?.id || '',
    category: 'administrative',
    description: `Imposto em lote (${ratePercent}%) — receb. ${receivedDate}`,
    amount: taxAmount,
    due_date: dueDate,
    status: 'to_pay',
  });
}