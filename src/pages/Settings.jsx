import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, User, Bell, Shield, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from 'framer-motion';

export default function Settings() {
  const [saveStatus, setSaveStatus] = useState(null);
  const { refreshUser } = useAuth();

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: ''
  });

  React.useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ full_name: profileForm.full_name });
  };

  const userType = user?.user_type || 'admin';
  const userTypeLabels = {
    admin: 'Administrador',
    saas_admin: 'Administrador da plataforma',
    consultant: 'Consultor',
    client: 'Cliente'
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie suas preferências e perfil</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>Atualize suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-[#1e3a5f] text-white text-2xl">
                      {user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-900">{user?.full_name || 'Usuário'}</p>
                    <p className="text-sm text-slate-500">{userTypeLabels[userType]}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input
                      value={profileForm.email}
                      disabled
                      className="bg-slate-50"
                    />
                    <p className="text-xs text-slate-500 mt-1">O e-mail não pode ser alterado</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : saveStatus === 'success' ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : null}
                    {saveStatus === 'success' ? 'Salvo!' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="notifications">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Configure como você deseja receber atualizações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Notificações por E-mail</p>
                      <p className="text-sm text-slate-500">Receber atualizações importantes por e-mail</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Novos Projetos</p>
                      <p className="text-sm text-slate-500">Ser notificado sobre novos projetos atribuídos</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Tarefas com Prazo</p>
                      <p className="text-sm text-slate-500">Lembrete de tarefas próximas do vencimento</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Mensagens de Clientes</p>
                      <p className="text-sm text-slate-500">Notificar sobre novas mensagens</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="security">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Segurança da Conta</CardTitle>
                <CardDescription>Gerencie a segurança da sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Tipo de Usuário</p>
                      <p className="text-sm text-slate-500">{userTypeLabels[userType]}</p>
                    </div>
                    <Shield className="w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Último Acesso</p>
                      <p className="text-sm text-slate-500">Agora</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Button 
                    variant="outline" 
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => base44.auth.logout()}
                  >
                    Sair da Conta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}