import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Building2, Loader2, Plus, ShieldAlert, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function SaasAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  const isSaas = user?.user_type === 'saas_admin';

  const { data: organizations = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['saas-admin', 'organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, custom_domain, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSaas,
  });

  const [selectedOrgId, setSelectedOrgId] = useState(null);

  React.useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  const { data: tenantProfiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['saas-admin', 'profiles', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, user_type, created_date')
        .eq('organization_id', selectedOrgId)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSaas && Boolean(selectedOrgId),
  });

  const createTenantMutation = useMutation({
    mutationFn: async ({ name, slug }) => {
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: name.trim(), slug })
        .select('id')
        .single();
      if (orgErr) throw orgErr;

      const { error: setErr } = await supabase.from('organization_settings').insert({
        organization_id: org.id,
      });
      if (setErr) throw setErr;
      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin', 'organizations'] });
      toast({ title: 'Tenant criado', description: 'Organização e configurações iniciais foram criadas.' });
      setTenantDialogOpen(false);
      setNewTenantName('');
      setNewTenantSlug('');
    },
    onError: (e) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar tenant',
        description: e?.message || 'Tente novamente.',
      });
    },
  });

  const inviteAdminMutation = useMutation({
    mutationFn: async ({ email, password, full_name, organization_slug }) => {
      const { data, error } = await supabase.functions.invoke('saas-invite-tenant-admin', {
        body: { email, password, full_name, organization_slug },
      });
      if (error) {
        let msg = error.message || 'Falha na função';
        try {
          const body = await error.context?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-admin', 'profiles', selectedOrgId] });
      toast({ title: 'Administrador criado', description: 'O usuário pode fazer login no tenant correspondente.' });
      setAdminDialogOpen(false);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
    },
    onError: (e) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar admin',
        description: e?.message || 'Tente novamente.',
      });
    },
  });

  if (!isSaas) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="w-10 h-10 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold">Acesso restrito</h1>
            <p className="text-slate-600 mt-1">
              Esta área é exclusiva para usuários com perfil de administrador da plataforma (SaaS).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmitTenant = (e) => {
    e.preventDefault();
    const slug = normalizeSlug(newTenantSlug);
    if (!newTenantName.trim() || !slug || !SLUG_RE.test(slug)) {
      toast({
        variant: 'destructive',
        title: 'Dados inválidos',
        description: 'Informe nome e um slug válido (minúsculas, números e hífens).',
      });
      return;
    }
    createTenantMutation.mutate({ name: newTenantName, slug });
  };

  const handleSubmitAdmin = (e) => {
    e.preventDefault();
    if (!selectedOrg?.slug) return;
    inviteAdminMutation.mutate({
      email: newAdminEmail.trim(),
      password: newAdminPassword,
      full_name: newAdminName.trim() || newAdminEmail.trim(),
      organization_slug: selectedOrg.slug,
    });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-8 h-8 text-[#1e3a5f]" />
          Administração SaaS
        </h1>
        <p className="text-slate-500 mt-1">
          Gerencie organizações (tenants) e usuários administradores de cada tenant.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Lista de todas as organizações cadastradas na plataforma.</CardDescription>
          </div>
          <Button type="button" onClick={() => setTenantDialogOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" />
            Novo tenant
          </Button>
        </CardHeader>
        <CardContent>
          {loadingOrgs ? (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Domínio customizado</TableHead>
                  <TableHead className="whitespace-nowrap">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded">{o.slug}</code>
                    </TableCell>
                    <TableCell className="text-slate-600">{o.custom_domain || '—'}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuários do tenant
          </CardTitle>
          <CardDescription>
            Selecione um tenant para listar perfis e criar um administrador local.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Tenant</Label>
              <Select
                value={selectedOrgId ?? ''}
                onValueChange={(v) => setSelectedOrgId(v)}
                disabled={organizations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={!selectedOrg}
              onClick={() => setAdminDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo admin do tenant
            </Button>
          </div>

          {loadingProfiles ? (
            <div className="flex items-center gap-2 text-slate-500 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando usuários…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantProfiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{p.full_name}</TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{p.user_type}</span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.created_date ? new Date(p.created_date).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmitTenant}>
            <DialogHeader>
              <DialogTitle>Novo tenant</DialogTitle>
              <DialogDescription>
                Cria uma organização e uma linha em configurações (cores/logo podem ser ajustadas depois pelo
                admin do tenant).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Nome</Label>
                <Input
                  id="tenant-name"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Ex.: Empresa XYZ"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Slug</Label>
                <Input
                  id="tenant-slug"
                  value={newTenantSlug}
                  onChange={(e) => setNewTenantSlug(normalizeSlug(e.target.value))}
                  placeholder="ex.: empresa-xyz"
                />
                <p className="text-xs text-slate-500">Usado em subdomínio e metadados de novos usuários.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTenantDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTenantMutation.isPending}>
                {createTenantMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmitAdmin}>
            <DialogHeader>
              <DialogTitle>Administrador do tenant</DialogTitle>
              <DialogDescription>
                Cria usuário no Auth com perfil <strong>admin</strong> neste tenant:{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">{selectedOrg?.slug}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-pass">Senha inicial</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Nome completo (opcional)</Label>
                <Input
                  id="admin-name"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={inviteAdminMutation.isPending || !selectedOrg}>
                {inviteAdminMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
