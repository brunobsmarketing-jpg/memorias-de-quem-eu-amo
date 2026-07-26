import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Rede de segurança contra "tela branca": sem isso, qualquer erro de JavaScript não tratado em
// qualquer lugar da árvore de componentes derruba a página inteira sem nenhum aviso pro usuário
// (React desmonta tudo silenciosamente). Com isso, mostra uma mensagem amigável com opção de
// recarregar, em vez de deixar a pessoa travada numa tela em branco sem saber o que aconteceu.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Erro não tratado capturado pelo ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center text-center px-6 space-y-4 font-sans">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <h1 className="text-xl font-bold">Ops, algo deu errado</h1>
          <p className="text-slate-400 text-sm max-w-sm">
            Encontramos um problema inesperado nesta tela. Nenhuma informação foi perdida — tente
            recarregar a página para continuar de onde parou.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
