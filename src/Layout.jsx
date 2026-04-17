import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
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
  Shield
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

const adminMenuItems = [
  { name: 'Áreas de Atuação', icon: Briefcase, page: 'ServiceAreas' },
  { name: 'Consultores', icon: Users, page: 'Consultants' },
  { name: 'Clientes', icon: Building2, page: 'Clients' },
  { name: 'Atendimentos', icon: FolderKanban, page: 'Projects' },

  { name: 'Financeiro', icon: BarChart3, page: 'Financial' },

  { name: 'Valores/Hora', icon: BarChart3, page: 'HourlyRates' },
];

const saasAdminExtraItem = { name: 'Admin SaaS', icon: Shield, page: 'SaasAdmin' };

const consultantMenuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'ConsultantDashboard' },
  { name: 'Meus Projetos', icon: FolderKanban, page: 'ConsultantProjects' },
  { name: 'Minhas Horas', icon: Clock, page: 'ConsultantTimeEntries' },
  { name: 'Minhas Despesas', icon: Receipt, page: 'ConsultantExpenses' },
];

const clientMenuItems = [
  { name: 'Portal', icon: LayoutDashboard, page: 'ClientPortal' },
  { name: 'Documentos', icon: FileText, page: 'ClientDocuments' },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  // Utilizador já foi resolvido no AuthProvider antes de renderizar rotas autenticadas.
  // Evita um segundo fetch + ecrã "Carregando..." (que parecia refresh ao voltar o foco).
  const userType = user?.user_type || 'admin';

  const menuItems =
    userType === 'saas_admin'
      ? [...adminMenuItems, saasAdminExtraItem]
      : userType === 'admin'
        ? adminMenuItems
        : userType === 'consultant'
          ? consultantMenuItems
          : clientMenuItems;

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.assign('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header Navigation */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50">
        <div className="h-full px-4 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to={createPageUrl('Dashboard')}>
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695ebd99a400611ea331a00a/dd42951c1_Logomarca.JPG" alt="Vanguarda Consultoria" className="h-8 w-auto object-contain" />
            </Link>
            
            {/* Desktop Menu */}
            <nav className="hidden lg:flex items-center gap-1">
              {menuItems.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${isActive 
                        ? 'bg-[#1e3a5f] text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
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
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
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
          {children}
        </div>
      </main>
    </div>
  );
}