import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl, createHourlyRatesViabilityUrl } from './utils';
import { api } from '@/api/appApi';
import { APP_LOGO_URL } from '@/lib/branding';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { READ_ONLY_BLOCKED_EVENT } from '@/lib/organizationScope';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Briefcase, 
  FolderKanban,
  Clock,
  Receipt,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FileText,
  Shield,
  Calculator,
  CreditCard,
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AiAssistant from '@/components/ai/AiAssistant';

const adminMenuItems = [
  { name: 'Áreas de Atuação', icon: Briefcase, page: 'ServiceAreas' },
  { name: 'Consultores', icon: Users, page: 'Consultants' },
  { name: 'Clientes', icon: Building2, page: 'Clients' },
  { name: 'Atendimentos', icon: FolderKanban, page: 'Projects' },

  { name: 'Financeiro', icon: BarChart3, page: 'Financial' },

  { name: 'Valores/Hora', icon: BarChart3, page: 'HourlyRates' },
  { name: 'Análise de Viabilidade', icon: Calculator, page: 'HourlyRates', viabilityTab: true },
];

const saasAdminExtraItem = { name: 'Admin SaaS', icon: Shield, page: 'SaasAdmin' };
const subscriptionItem = { name: 'Minha Assinatura', icon: CreditCard, page: 'MySubscription' };

const consultantMenuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'ConsultantDashboard' },
  { name: 'Meus Projetos', icon: FolderKanban, page: 'ConsultantProjects' },
  { name: 'Minhas Horas', icon: Clock, page: 'ConsultantTimeEntries' },
  { name: 'Minhas Despesas', icon: Receipt, page: 'ConsultantExpenses' },
  { name: 'Análise de Viabilidade', icon: Calculator, page: 'HourlyRates', viabilityTab: true },
];

const clientMenuItems = [
  { name: 'Portal', icon: LayoutDashboard, page: 'ClientPortal' },
  { name: 'Documentos', icon: FileText, page: 'ClientDocuments' },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [readOnlyDialogOpen, setReadOnlyDialogOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { subscription } = useTenant();
  const location = useLocation();
  const viabilityTabActive =
    new URLSearchParams(location.search || '').get('tab') === 'viability';

  // Utilizador já foi resolvido no AuthProvider antes de renderizar rotas autenticadas.
  // Evita um segundo fetch + ecrã "Carregando..." (que parecia refresh ao voltar o foco).
  const userType = String(user?.user_type || 'admin').toLowerCase();

  const isPlatformAdminOnly =
    userType === 'saas_admin' && String(user?.organization_slug || '').toLowerCase() === 'admin';

  const menuItems =
    isPlatformAdminOnly
      ? [saasAdminExtraItem]
      : userType === 'saas_admin'
        ? [...adminMenuItems, subscriptionItem, saasAdminExtraItem]
      : userType === 'admin'
        ? [...adminMenuItems, subscriptionItem]
        : userType === 'consultant'
          ? consultantMenuItems
          : clientMenuItems;
  const readOnlyMode =
    !isPlatformAdminOnly && Boolean(subscription && !subscription.isActive);

  React.useEffect(() => {
    const onReadOnlyBlocked = () => setReadOnlyDialogOpen(true);
    window.addEventListener(READ_ONLY_BLOCKED_EVENT, onReadOnlyBlocked);
    return () => {
      window.removeEventListener(READ_ONLY_BLOCKED_EVENT, onReadOnlyBlocked);
    };
  }, []);

  const handleLogout = async () => {
    await api.auth.logout();
    window.location.assign('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header Navigation */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50">
        <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-3 min-w-0">
          {/* Logo + menu desktop (scroll horizontal se couber no ecrã) */}
          <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
            <Link to={createPageUrl('Dashboard')} className="shrink-0">
              <img src={APP_LOGO_URL} alt="GestãoUP" className="h-8 w-auto object-contain" />
            </Link>
            
            {/* Desktop Menu */}
            <nav
              className="hidden lg:flex flex-1 min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain py-1 px-0.5 scroll-smooth [scrollbar-width:thin]"
              aria-label="Navegação principal"
            >
              {menuItems.map((item) => {
                const to = item.viabilityTab ? createHourlyRatesViabilityUrl() : createPageUrl(item.page);
                const isActive =
                  currentPageName === item.page &&
                  (!item.viabilityTab || viabilityTabActive);
                return (
                  <Link
                    key={item.viabilityTab ? `${item.page}-viability` : item.page}
                    to={to}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0
                      ${isActive 
                        ? 'bg-[#1e3a5f] text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2"
                  aria-label="Menu do usuário"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[#1e3a5f] text-white text-sm">
                      {user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.full_name || 'Usuário'}</p>
                    <p className="text-xs text-slate-500 capitalize">{userType}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[60]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.full_name || 'Usuário'}</p>
                    {user?.email && (
                      <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                {(userType === 'admin' ||
                  (userType === 'saas_admin' && !isPlatformAdminOnly) ||
                  userType === 'consultant') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        to={createHourlyRatesViabilityUrl()}
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <Calculator className="w-4 h-4" />
                        Análise de Viabilidade
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                  onSelect={(e) => {
                    e.preventDefault();
                    handleLogout();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="lg:hidden text-slate-600"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg">
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => {
                const to = item.viabilityTab ? createHourlyRatesViabilityUrl() : createPageUrl(item.page);
                const isActive =
                  currentPageName === item.page &&
                  (!item.viabilityTab || viabilityTabActive);
                return (
                  <Link
                    key={item.viabilityTab ? `${item.page}-viability` : item.page}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${isActive 
                        ? 'bg-[#1e3a5f] text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-16 min-h-screen">
        <div className="p-6 lg:p-8">
          {readOnlyMode && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Sua organização está em modo somente leitura porque a assinatura não está ativa.
            </div>
          )}
          {children}
        </div>
      </main>

      {(user || isAuthenticated) && <AiAssistant />}

      <Dialog open={readOnlyDialogOpen} onOpenChange={setReadOnlyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro bloqueado em modo leitura</DialogTitle>
            <DialogDescription>
              Sua organização está com a assinatura inativa e, por isso, não é possível cadastrar ou alterar dados.
              Ative a assinatura em <strong>Minha Assinatura</strong> para liberar o sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setReadOnlyDialogOpen(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}