import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload } from "lucide-react";
import { api } from '@/api/appApi';
import MoneyInput from "@/components/ui/MoneyInput";
import { parseMoneyBRToNumber, validateISODate, validateMoney } from "@/lib/validators";

const CATEGORIES = {
  travel: "Deslocamento",
  materials: "Materiais",
  tools: "Ferramentas",
  administrative: "Administrativo",
  meals: "Refeições",
  software: "Software",
  other: "Outros"
};

const createEmptyForm = () => ({
  project_id: '',
  consultant_id: '',
  category: 'other',
  description: '',
  amount: '',
  date: '',
  receipt_url: '',
  reimbursable: false,
});

export default function ExpenseForm({ open, onClose, expense, onSave, loading, projects, consultants }) {
  const [form, setForm] = useState(createEmptyForm);
  const [uploading, setUploading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(3);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        project_id: expense.project_id || '',
        consultant_id: expense.consultant_id || '',
        category: expense.category || 'other',
        description: expense.description || '',
        amount: expense.amount?.toString() || '',
        date: expense.date || '',
        receipt_url: expense.receipt_url || '',
        reimbursable: expense.reimbursable || false
      });
      setIsRecurring(false);
    } else {
      setForm(createEmptyForm());
      setIsRecurring(false);
    }
  }, [expense, open]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setForm((prev) => ({ ...prev, receipt_url: file_url }));
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateMoney(form.amount, { min: 0 })) {
      alert('Informe um valor (R$) válido para a despesa.');
      return;
    }
    if (!validateISODate(form.date)) {
      alert('Informe uma data válida para a despesa.');
      return;
    }
    const amountNumber = parseMoneyBRToNumber(form.amount) || 0;
    const base = {
      ...form,
      amount: amountNumber,
      status: 'to_pay',
      project_id: form.project_id || null,
      consultant_id: form.consultant_id || null,
      receipt_url: form.receipt_url || null,
    };
    if (!isRecurring || expense) {
      onSave(base);
    } else {
      const entries = [];
      for (let i = 0; i < recurringMonths; i++) {
        const due = new Date(form.date + 'T12:00:00');
        due.setMonth(due.getMonth() + i);
        const dueStr = due.toISOString().split('T')[0];
        entries.push({
          ...base,
          due_date: dueStr,
          date: dueStr,
          description: `${form.description}${recurringMonths > 1 ? ` (${i + 1}/${recurringMonths})` : ''}`.trim(),
        });
      }
      onSave(entries);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} modal>
      <DialogContent className="max-w-lg" aria-describedby="expense-description">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
          <DialogDescription id="expense-description">
            Registre despesas do projeto ou despesas gerais
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$) *</Label>
                    <MoneyInput
                      value={form.amount}
                      onChange={(v) => setForm({ ...form, amount: v })}
                      required
                    />
            </div>
            <div>
              <Label>Data *</Label>
              <Input 
                type="date"
                value={form.date} 
                onChange={(e) => setForm({...form, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Projeto (opcional)</Label>
              <Select value={form.project_id || undefined} onValueChange={(v) => setForm({...form, project_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Consultor</Label>
              <Select value={form.consultant_id || undefined} onValueChange={(v) => setForm({...form, consultant_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {consultants?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({...form, description: e.target.value})}
              rows={2}
            />
          </div>
          <div>
            <Label>Comprovante</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="receipt-upload"
                accept="image/*,.pdf"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => document.getElementById('receipt-upload').click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {form.receipt_url ? 'Substituir' : 'Anexar'}
              </Button>
              {form.receipt_url && (
                <a href={form.receipt_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  Ver comprovante
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="reimbursable" 
              checked={form.reimbursable}
              onCheckedChange={(v) => setForm({...form, reimbursable: v})}
            />
            <Label htmlFor="reimbursable" className="cursor-pointer">Despesa reembolsável</Label>
          </div>

          {/* Recurring option — only for new expenses */}
          {!expense && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={(v) => setIsRecurring(!!v)}
                />
                <Label htmlFor="recurring" className="cursor-pointer font-medium">Despesa recorrente</Label>
              </div>
              {isRecurring && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label>Primeiro vencimento *</Label>
                    <input type="date" value={form.date}
                      onChange={(e) => setForm({...form, date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" required />
                  </div>
                  <div>
                    <Label>Quantos meses *</Label>
                    <input type="number" min="2" max="60" value={recurringMonths}
                      onChange={(e) => setRecurringMonths(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mt-1" />
                  </div>
                  <div className="col-span-2 text-xs text-slate-500 bg-slate-50 rounded p-2">
                    Serão criadas <strong>{recurringMonths}</strong> despesas mensais de{' '}
                    <strong>R$ {(parseMoneyBRToNumber(form.amount) || 0).toFixed(2)}</strong> cada,
                    vencendo todo dia <strong>{form.date ? new Date(form.date + 'T12:00:00').getDate() : '?'}</strong> por{' '}
                    {recurringMonths} {recurringMonths === 1 ? 'mês' : 'meses'}.
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {expense ? 'Salvar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}