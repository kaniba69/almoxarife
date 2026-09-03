import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Layers, 
  Lock,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { api } from '../api';

interface ApiActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshStock?: () => void;
}

export const ApiActionModal: React.FC<ApiActionModalProps> = ({
  isOpen,
  onClose,
  onRefreshStock
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.executeApiAction({ action: 'inventory_audit' });
      setResult(res);
      if (onRefreshStock) {
        onRefreshStock();
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao executar chamada da API protegida.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="modal-api-action"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Auditoria Inteligente via API</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Chave Protegida
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Requisição executada exclusivamente no backend
              </p>
            </div>
          </div>
          <button
            id="btn-close-api-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Security Banner */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Segurança Garantida:</p>
              <p className="text-blue-700">
                A chave de API (<code className="bg-blue-100/80 px-1 py-0.5 rounded text-blue-800 font-mono">API_KEY</code>) permanece no servidor Node.js. Nenhuma credencial trafega para o navegador ou fica exposta no código-fonte.
              </p>
            </div>
          </div>

          {/* Initial State before execution */}
          {!result && !isLoading && !error && (
            <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">
                Pronto para executar a auditoria
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                Clique no botão abaixo para disparar o diagnóstico de inventário, verificar rupturas e receber recomendações automáticas do backend.
              </p>
              <button
                id="btn-run-api-action-primary"
                onClick={handleExecute}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Executar Auditoria via API</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-10 px-4">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">Processando requisição no backend...</h4>
              <p className="text-xs text-slate-500 mt-1">
                Consultando API externa com a chave protegida e auditando dados de estoque.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Erro na requisição:</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Success / Result State */}
          {result && !isLoading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Top Result Banner */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                    Provedor da Resposta
                  </span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {result.provider}
                  </p>
                </div>
                {result.data?.statusLevel && (
                  <div className="text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Status do Inventário
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold mt-0.5 ${
                      result.data.statusLevel === 'OTIMO'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : result.data.statusLevel === 'ATENCAO'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {result.data.statusLevel}
                    </span>
                  </div>
                )}
              </div>

              {/* Summary Text */}
              {result.data?.summary && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    Resumo do Diagnóstico
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {result.data.summary}
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              {result.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-center">
                    <span className="text-[11px] text-slate-500 block">Total Itens</span>
                    <span className="text-base font-bold text-slate-900">{result.stats.totalItems}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-center">
                    <span className="text-[11px] text-slate-500 block">Unidades Físicas</span>
                    <span className="text-base font-bold text-slate-900">{result.stats.totalUnits}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 text-center">
                    <span className="text-[11px] text-amber-700 block">Estoque Baixo</span>
                    <span className="text-base font-bold text-amber-900">{result.stats.lowStockCount}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 text-center">
                    <span className="text-[11px] text-rose-700 block">Esgotados</span>
                    <span className="text-base font-bold text-rose-900">{result.stats.zeroStockCount}</span>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.data?.recommendations && result.data.recommendations.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Recomendações da Análise
                  </span>
                  <ul className="space-y-1.5">
                    {result.data.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Critical Items if any */}
              {result.data?.criticalItems && result.data.criticalItems.length > 0 && (
                <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 text-xs">
                  <span className="font-semibold text-rose-900 flex items-center gap-1.5 mb-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    Atenção Prioritária (Estoque Crítico):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.data.criticalItems.map((item: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 text-[11px]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {result?.timestamp ? `Executado em ${new Date(result.timestamp).toLocaleTimeString()}` : 'Pronto para execução'}
          </span>
          <div className="flex items-center gap-2">
            {result && (
              <button
                id="btn-reexecute-api-action"
                onClick={handleExecute}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            )}
            <button
              id="btn-close-modal-footer"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
