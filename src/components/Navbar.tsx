import React from 'react';
import { Package, Shield, User, LogOut, Search, ArrowLeft, RefreshCw, FileSpreadsheet, Sparkles, ArrowUpDown, Lock } from 'lucide-react';
import { User as UserType } from '../types';

interface NavbarProps {
  currentView: 'catalog' | 'admin';
  onNavigate: (view: 'catalog' | 'admin') => void;
  currentUser: UserType | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefreshData?: () => void;
  onOpenSheetsSync?: () => void;
  onOpenApiModal?: () => void;
  onQuickBidirectionalSync?: () => void;
  isSyncingBidirectional?: boolean;
  isLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onOpenLogin,
  onLogout,
  searchQuery,
  onSearchChange,
  onRefreshData,
  onOpenSheetsSync,
  onOpenApiModal,
  onQuickBidirectionalSync,
  isSyncingBidirectional = false,
  isLoading
}) => {

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onNavigate('catalog')}>
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white font-['Outfit',sans-serif]">
                  Controle de Almoxarifado
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/80 text-blue-200 border border-blue-700/50">
                  Estoque Ativo
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">
                Consulta e retirada rápida de peças e materiais
              </p>
            </div>
          </div>

          {/* Search bar on Navbar (when in catalog view) */}
          {currentView === 'catalog' && (
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  id="navbar-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Digite o nome ou código da peça..."
                  className="block w-full pl-9 pr-4 py-1.5 text-sm bg-slate-800/90 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onOpenApiModal && (
              <button
                id="btn-api-protected-action"
                onClick={onOpenApiModal}
                title="Executar auditoria via API externa (Chave protegida no backend)"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/70 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Auditoria API</span>
                <span className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-indigo-900/90 text-indigo-300 border border-indigo-600/40">
                  <Lock className="w-2.5 h-2.5" />
                  Segura
                </span>
              </button>
            )}

            {onQuickBidirectionalSync && (
              <button
                id="btn-quick-bidirectional-sync"
                onClick={onQuickBidirectionalSync}
                disabled={isSyncingBidirectional}
                title="Sincronização bidirecional com Google Sheets (Atualiza existentes e adiciona novos sem duplicar)"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isSyncingBidirectional ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar Planilha</span>
                <span className="sm:hidden">Sincronizar</span>
              </button>
            )}

            {onOpenSheetsSync && (
              <button
                id="btn-open-sheets-sync"
                onClick={onOpenSheetsSync}
                title="Abrir painel detalhado de integração do Google Sheets"
                className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              </button>
            )}

            {onRefreshData && (
              <button
                id="btn-refresh-data"
                onClick={onRefreshData}
                disabled={isLoading}
                title="Atualizar estoque"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}


            {currentView === 'admin' ? (
              <button
                id="btn-back-to-catalog"
                onClick={() => onNavigate('catalog')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar ao Almoxarifado</span>
              </button>
            ) : (
              <button
                id="btn-open-coordinator-panel"
                onClick={() => {
                  if (currentUser) {
                    onNavigate('admin');
                  } else {
                    onOpenLogin();
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  currentUser
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Shield className="h-4 w-4 text-blue-400" />
                <span>Painel do Coordenador</span>
              </button>
            )}

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-medium text-white truncate max-w-[120px]">{currentUser.name}</span>
                  <span className="text-[10px] text-blue-400 font-medium">Coordenador</span>
                </div>
                <button
                  id="btn-logout-user"
                  onClick={onLogout}
                  title="Sair do painel"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
