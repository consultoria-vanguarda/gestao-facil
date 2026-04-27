import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileCheck, X } from "lucide-react";
import { api } from '@/api/appApi';
import CpfCnpjInput from "@/components/ui/CpfCnpjInput";
import PhoneInput from "@/components/ui/PhoneInput";
import { validateCPFOrCNPJ, validateEmail, validatePhone } from "@/lib/validators";

const emptyForm = {
  company_name: '',
  document: '',
  phone: '',
  address: '',
  contact_person: '',
  legal_rep_name: '',
  legal_rep_address: '',
  legal_rep_phone: '',
  email: '',
  foco_code_company: '',
  foco_code_rep: '',
  status: 'active',
  doc_cnpj_url: '',
  doc_contrato_social_url: '',
  doc_comprovante_endereco_url: '',
  doc_identidade_rep_url: '',
};

export default function ClientForm({ open, onClose, client, onSave, loading }) {
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState({});

  useEffect(() => {
    if (client) {
      setForm({
        company_name: client.company_name || '',
        document: client.document || '',
        phone: client.phone || '',
        address: client.address || '',
        contact_person: client.contact_person || '',
        legal_rep_name: client.legal_rep_name || '',
        legal_rep_address: client.legal_rep_address || '',
        legal_rep_phone: client.legal_rep_phone || '',
        email: client.email || '',
        foco_code_company: client.foco_code_company || '',
        foco_code_rep: client.foco_code_rep || '',
        status: client.status || 'active',
        doc_cnpj_url: client.doc_cnpj_url || '',
        doc_contrato_social_url: client.doc_contrato_social_url || '',
        doc_comprovante_endereco_url: client.doc_comprovante_endereco_url || '',
        doc_identidade_rep_url: client.doc_identidade_rep_url || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [client]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleFileUpload = async (field, file) => {
    if (!file) return;
    setUploading({ ...uploading, [field]: true });
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setForm({ ...form, [field]: file_url });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploading({ ...uploading, [field]: false });
    }
  };

  const handleRemoveFile = (field) => {
    setForm({ ...form, [field]: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateCPFOrCNPJ(form.document)) {
      alert('Informe um CPF/CNPJ válido no campo de documento.');
      return;
    }
    if (!validatePhone(form.phone)) {
      alert('Informe um telefone válido para o contato principal.');
      return;
    }
    if (!validatePhone(form.legal_rep_phone)) {
      alert('Informe um telefone válido para o representante legal.');
      return;
    }
    if (!validateEmail(form.email)) {
      alert('Informe um e-mail válido.');
      return;
    }
    onSave(form);
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) setTimeout(onClose, 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {client ? 'Atualize as informações do cliente' : 'Preencha os dados do cliente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.company_name} onChange={set('company_name')} required />
            </div>

            <div>
              <Label>CPF/CNPJ *</Label>
              <CpfCnpjInput
                value={form.document}
                onChange={set('document')}
                required
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <Label>Telefone *</Label>
              <PhoneInput value={form.phone} onChange={set('phone')} required placeholder="(00) 00000-0000" />
            </div>

            <div className="col-span-2">
              <Label>Endereço Completo *</Label>
              <Input value={form.address} onChange={set('address')} required />
            </div>

            <div className="col-span-2">
              <Label>Pessoa de Contato *</Label>
              <Input value={form.contact_person} onChange={set('contact_person')} required />
            </div>

            <div className="col-span-2 border-t pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Representante Legal</p>
            </div>

            <div className="col-span-2">
              <Label>Nome do Representante Legal *</Label>
              <Input value={form.legal_rep_name} onChange={set('legal_rep_name')} required />
            </div>

            <div className="col-span-2">
              <Label>Endereço Completo do Representante *</Label>
              <Input value={form.legal_rep_address} onChange={set('legal_rep_address')} required />
            </div>

            <div>
              <Label>Telefone do Representante *</Label>
              <PhoneInput
                value={form.legal_rep_phone}
                onChange={set('legal_rep_phone')}
                required
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label>E-mail *</Label>
              <input type="email" value={form.email} onChange={set('email')} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" />
            </div>

            <div className="col-span-2 border-t pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Códigos Foco</p>
            </div>

            <div>
              <Label>Código Foco da Empresa</Label>
              <Input value={form.foco_code_company} onChange={set('foco_code_company')} />
            </div>

            <div>
              <Label>Código Foco Representante Legal</Label>
              <Input value={form.foco_code_rep} onChange={set('foco_code_rep')} />
            </div>

            <div className="col-span-2 border-t pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Documentos (opcional)</p>
            </div>

            {[
              { field: 'doc_cnpj_url', label: 'Cartão CNPJ' },
              { field: 'doc_contrato_social_url', label: 'Contrato Social' },
              { field: 'doc_comprovante_endereco_url', label: 'Comprovante de Endereço' },
              { field: 'doc_identidade_rep_url', label: 'Documento de Identidade do Representante Legal' },
            ].map(({ field, label }) => (
              <div key={field} className="col-span-2">
                <Label>{label}</Label>
                {form[field] ? (
                  <div className="flex items-center gap-2 mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                    <FileCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <a href={form[field]} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 underline truncate flex-1">
                      Arquivo enviado — clique para visualizar
                    </a>
                    <button type="button" onClick={() => handleRemoveFile(field)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md cursor-pointer hover:border-[#1e3a5f] transition-colors">
                    {uploading[field] ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm text-slate-500">
                      {uploading[field] ? 'Enviando...' : 'Clique para selecionar o arquivo'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(field, e.target.files[0])}
                      disabled={uploading[field]}
                    />
                  </label>
                )}
              </div>
            ))}

          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {client ? 'Salvar' : 'Criar Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}