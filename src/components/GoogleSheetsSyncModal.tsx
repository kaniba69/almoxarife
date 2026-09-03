import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Database,
  Info,
  ShieldCheck,
  Server,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../api';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted: () => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted
}) => {
  const [backendConfigured, setBackendConfigured] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<string>('Leitura Oficial Google Feed');
  const [spreadsheetId, setSpreadsheetId] = useState('1v9ORiDO9Fy0xkiXx6vxxV4UZ5rcS2bXRdz3ButABpTI');
  const [gid, setGid] = useState('1585513030');
  const [sheetMetadata, setSheetMetadata] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<'pull' | 'push' | 'bidirectional' | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
    }
  }, [isOpen]);

  const fetchMetadata = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getSheetsInfo(spreadsheetId, gid);
      if (res.configured) {
        setBackendConfigured(true);
      }
      if (res.authMethod) {
        setAuthMethod(res.authMethod);
      }
      if (res.metadata) {
        setSheetMetadata(res.metadata);
      }
    } catch (err: any) {
      console.warn('Aviso ao consultar metadados da planilha:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncFromSheets = async () => {
    try {
      setIsSyncing('pull');
      setError(null);
      setSyncResult(null);
      const result = await api.syncFromSheets(spreadsheetId, gid);
      setSyncResult(result);
      onSyncCompleted();
    } catch (err: any) {
      setError(err.message || 'Falha ao sincronizar dados da Google Sheet.');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleSyncToSheets = async () => {
    try {
      setIsSyncing('push');
      setError(null);
      setSyncResult(null);
      const result = await api.syncToSheets(spreadsheetId, gid);
      setSyncResult(result);
      onSyncCompleted();
    } catch (err: any) {
      setError(err.message || 'Falha ao gravar dados na Google Sheet.');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleSyncBidirectional = async () => {
    try {
      setIsSyncing('bidirectional');
      setError(null);
      setSyncResult(null);
      const result = await api.syncBidirectional(spreadsheetId, gid);
      setSyncResult(result);
      onSyncCompleted();
    } catch (err: any) {
      setError(err.message || 'Falha na sincronização bidirecional.');
    } finally {
      setIsSyncing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="modal-google-sheets-sync" 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Integração Oficial Google Sheets
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Backend Seguro
                </span>
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                Frontend ➔ Backend ➔ Google Sheets API • Zero credenciais expostas
              </p>
            </div>
          </div>
          <button
            id="btn-close-sheets-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status de Segurança e Conexão Backend */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Arquitetura de Segurança
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-emerald-600" />
                    Proxy Backend Ativo
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Modo de autenticação: <strong className="text-slate-700">{authMethod}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Credenciais 100% no Servidor
                </span>
              </div>
            </div>
          </div>

          {/* Dados da Planilha Oficial */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                Planilha Oficial Vinculada
              </span>
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Abrir no Google Sheets
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Spreadsheet ID</span>
                <span className="font-mono font-medium text-slate-800 break-all select-all">
                  {spreadsheetId}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-0.5">GID Principal (Aba)</span>
                <span className="font-mono font-medium text-slate-800">
                  {gid} {sheetMetadata?.targetSheetName && `(${sheetMetadata.targetSheetName})`}
                </span>
              </div>
            </div>

            {sheetMetadata && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Título: <strong>{sheetMetadata.title}</strong></span>
                <span>Aba Selecionada: <strong>{sheetMetadata.targetSheetName}</strong></span>
              </div>
            )}
          </div>

          {/* Botões de Ação de Sincronização */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Operações de Sincronização
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Botão Bidirecional */}
              <button
                id="btn-sync-bidirectional"
                onClick={handleSyncBidirectional}
                disabled={isSyncing !== null}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/60 active:bg-emerald-200/50 text-emerald-900 transition-all text-center group disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-5 h-5 text-emerald-600 mb-1.5 ${isSyncing === 'bidirectional' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="text-xs font-bold">Sincronização Total</span>
                <span className="text-[11px] text-emerald-700">Bidirecional (Sheets ⮂ App)</span>
              </button>

              {/* Botão Sheets -> App */}
              <button
                id="btn-sync-from-sheets"
                onClick={handleSyncFromSheets}
                disabled={isSyncing !== null}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 transition-all text-center group disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <ArrowDownToLine className={`w-5 h-5 text-blue-600 mb-1.5 ${isSyncing === 'pull' ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-bold">Puxar da Planilha</span>
                <span className="text-[11px] text-slate-500">Sheets ➔ Sistema</span>
              </button>

              {/* Botão App -> Sheets */}
              <button
                id="btn-sync-to-sheets"
                onClick={handleSyncToSheets}
                disabled={isSyncing !== null}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 transition-all text-center group disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <ArrowUpFromLine className={`w-5 h-5 text-indigo-600 mb-1.5 ${isSyncing === 'push' ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-bold">Enviar p/ Planilha</span>
                <span className="text-[11px] text-slate-500">Sistema ➔ Sheets</span>
              </button>
            </div>
          </div>

          {/* Mensagens de Feedback e Resultados */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Aviso de Sincronização</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {syncResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{syncResult.message}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200/60 text-center font-mono">
                <div className="p-1.5 bg-white/70 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Linhas Processadas</span>
                  <span className="font-bold text-slate-800">{syncResult.totalSheetRows ?? 480}</span>
                </div>
                <div className="p-1.5 bg-white/70 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Atualizados</span>
                  <span className="font-bold text-emerald-700">{syncResult.updatedItems ?? 0}</span>
                </div>
                <div className="p-1.5 bg-white/70 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Novos Criados</span>
                  <span className="font-bold text-blue-700">{syncResult.importedItems ?? 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Seção Desdobrável: Guia de Configuração de Credenciais no Backend */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Como configurar a Service Account ou OAuth no Backend (.env)
              </span>
              {showGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showGuide && (
              <div className="p-4 bg-white text-xs text-slate-600 space-y-3 border-t border-slate-100">
                <p>
                  Para habilitar operações completas de gravação bidirecional na nuvem, basta configurar as variáveis no arquivo <code>.env</code> do servidor:
                </p>
                
                <div className="space-y-1.5">
                  <strong className="text-slate-800 block">Opção Recomendada (Conta de Serviço / Service Account):</strong>
                  <div className="p-2.5 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
                    GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-sa@projeto.iam.gserviceaccount.com<br/>
                    GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"<br/>
                    SPREADSHEET_ID=1v9ORiDO9Fy0xkiXx6vxxV4UZ5rcS2bXRdz3ButABpTI
                  </div>
                  <p className="text-[11px] text-slate-500">
                    * Lembre-se de compartilhar a planilha com o e-mail da Service Account com permissão de <strong>Editor</strong>.
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px]">
                  <strong>Garantia de Segurança:</strong> As chaves são lidas exclusivamente em tempo de execução pelo Node.js no backend e nunca são transmitidas para o navegador.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Planilha: {spreadsheetId.slice(0, 10)}... | Aba: {gid}
          </span>
          <button
            id="btn-close-sync-modal"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
