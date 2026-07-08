import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    
    // Guardar log do erro no localStorage para nosso Diagnóstico/Painel de Métricas recuperar!
    try {
      const storedLogs = JSON.parse(localStorage.getItem('opera_crash_logs') || '[]');
      const newCrash = {
        message: error.message || String(error),
        componentStack: errorInfo.componentStack || '',
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('opera_crash_logs', JSON.stringify([newCrash, ...storedLogs].slice(0, 10)));
    } catch (err) {
      console.error("Failed to persist crash logs:", err);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      // Limpar estados que podem estar corrompidos de forma segura sem apagar credenciais de usuário
      localStorage.removeItem('opera_cached_newsale_form');
      localStorage.removeItem('opera_cached_contract_form');
      localStorage.removeItem('opera_active_tab');
      sessionStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error("Failed to clear cached data:", err);
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans selection:bg-yellow-400 selection:text-black">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="w-full max-w-lg bg-neutral-950 p-8 sm:p-12 rounded-[2.5rem] border border-red-500/20 shadow-2xl space-y-8 relative z-10 text-center">
            
            {/* Header com Ícone */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] flex items-center justify-center animate-pulse">
                <AlertTriangle size={40} className="stroke-[2.5]" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-400 mt-2">
                Falha Recuperável
              </h1>
              <p className="text-[9px] font-black tracking-[0.3em] text-neutral-500 uppercase">
                Opera Formação • Módulo de Blindagem Global
              </p>
            </div>

            {/* Explicação Amigável */}
            <div className="space-y-3 text-neutral-400 text-xs font-medium leading-relaxed max-w-sm mx-auto">
              <p>
                Detectamos uma instabilidade temporária na renderização do app. Nossa barreira de segurança evitou que o aplicativo congelasse completamente.
              </p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">
                Seus dados de vendas e formulários estão salvos localmente.
              </p>
            </div>

            {/* Código de Erro / Informações Técnicas */}
            <div className="bg-black/80 rounded-2xl p-4 text-left border border-white/5 space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-red-400 font-mono">
                <AlertCircle size={10} />
                <span>Info Diagnóstico:</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono break-all leading-normal">
                {this.state.error?.message || "Ocorreu uma exceção desconhecida no componente React."}
              </p>
              {this.state.error?.stack && (
                <p className="text-[9px] text-neutral-600 font-mono whitespace-pre-wrap leading-tight mt-1">
                  {this.state.error.stack.split('\n').slice(0, 2).join('\n')}
                </p>
              )}
            </div>

            {/* Ações de Recuperação sem fechar o App */}
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={this.handleReload}
                className="w-full h-16 bg-yellow-400 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-yellow-400/20"
              >
                <RotateCcw size={16} strokeWidth={2.5} />
                <span>Restaurar Aplicativo</span>
              </button>

              <button 
                onClick={this.handleClearCache}
                className="w-full h-12 bg-neutral-900 text-neutral-400 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <ShieldCheck size={14} />
                <span>Limpar Estados Temporários e Forçar Sync</span>
              </button>
            </div>

            <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest pt-2">
              Proteção do Sistema © Opera Inteligência
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
