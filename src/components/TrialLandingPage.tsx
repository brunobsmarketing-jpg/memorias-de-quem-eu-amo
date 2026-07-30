import React from 'react';
import { Upload, Wand2, Mic, PlayCircle, CheckCircle2, ArrowRight, Sparkles, Clock, CalendarHeart } from 'lucide-react';

interface TrialLandingPageProps {
  onStart: () => void;
}

const STEPS = [
  {
    icon: Upload,
    title: 'Envie as fotos do seu pai',
    description: 'Escolha as fotos mais especiais — ou use o modo 100% IA se não tiver fotos suficientes.',
  },
  {
    icon: Wand2,
    title: 'Não sabe o que escrever? A IA cria o texto por você',
    description: 'Conte uma lembrança marcante, ou deixe a IA escrever um texto emocionante do zero.',
  },
  {
    icon: Mic,
    title: 'Escolha a voz e a trilha sonora',
    description: 'Narração profissional por IA, ou grave sua própria voz e o sistema clona ela.',
  },
  {
    icon: PlayCircle,
    title: 'Veja o vídeo pronto na hora',
    description: 'Assista o resultado real, com marca d\'água. Gostou? Libere sem marca d\'água.',
  },
];

// Segundo domingo de agosto de 2026 — calculado uma vez só (não precisa ser reativo por segundo,
// só não pode ficar hardcoded como texto fixo tipo "faltam 9 dias", que ficaria errado no dia
// seguinte). Se a página ainda estiver no ar depois da data, o badge simplesmente some.
const FATHERS_DAY_2026 = new Date('2026-08-09T23:59:59-03:00');
function getDaysUntilFathersDay(): number | null {
  const diffMs = FATHERS_DAY_2026.getTime() - Date.now();
  if (diffMs <= 0) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Página de entrada da rota pública /experimente — pensada pra quem chega direto de um anúncio
 * (Instagram/WhatsApp), sem contexto nenhum do produto. Sem isso, a pessoa caía direto no Passo 1
 * do wizard (upload de fotos) sem entender o que estava fazendo nem que dava pra ver o vídeo
 * pronto antes de pagar qualquer coisa — o que é exatamente o diferencial desse funil. */
export const TrialLandingPage: React.FC<TrialLandingPageProps> = ({ onStart }) => {
  const daysLeft = getDaysUntilFathersDay();

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-6">
      {/* Logo — reforça confiança logo de cara pra quem chega de anúncio sem contexto nenhum.
          logo-icon.png tem fundo opaco (não é PNG transparente), então usa o mesmo tratamento
          do cabeçalho principal (App.tsx): cantos arredondados + sombra, em vez do logo-full.png
          "cru" (que tem bastante espaço em branco em volta e destoa do fundo creme da página). */}
      <div className="flex justify-center items-center gap-2.5">
        <img src="/logo-icon.png" alt="Memora" className="w-9 h-9 rounded-xl shadow-md" />
        <span className="font-extrabold text-lg tracking-tight text-slate-100">Memora</span>
      </div>

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Teste Grátis
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Menos de 3 minutos
          </div>
          {daysLeft !== null && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
              <CalendarHeart className="w-3.5 h-3.5" />
              Faltam {daysLeft} dia{daysLeft === 1 ? '' : 's'} para o Dia dos Pais
            </div>
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-slate-100 tracking-tight leading-tight">
          O Presente Que Vai Fazer Seu Pai Chorar de Emoção — Você Vê o Vídeo Antes de Pagar Qualquer Coisa
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          A Memora transforma fotos esquecidas no seu celular numa homenagem em vídeo, com
          narração e trilha sonora — pronta em menos de 3 minutos. Assista o resultado completo
          agora, de graça.
        </p>

        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-base rounded-2xl shadow-xl transition-all active:scale-98"
        >
          Criar um Vídeo Especial pro Meu Pai <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Como funciona */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-serif text-xl font-semibold text-slate-100">Como funciona</h2>
          <p className="text-slate-500 text-xs">Rápido e fácil — sem precisar saber editar vídeo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-0.5">Passo {i + 1}</p>
                  <h3 className="font-bold text-slate-100 text-sm mb-1">{step.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-amber-300">Sem cadastro, sem cartão de crédito pra testar.</strong> Você
            só informa seu e-mail se decidir liberar o vídeo em HD, sem marca d'água.
          </p>
        </div>

        <button
          onClick={onStart}
          className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-base rounded-2xl shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2"
        >
          Criar um Vídeo Especial pro Meu Pai <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
