import React from 'react';
import { ArrowLeft, Film, BookImage, ArrowRight } from 'lucide-react';

interface ChooseCreationTypeProps {
  onChoose: (type: 'video' | 'book') => void;
  onCancel: () => void;
}

/** Primeira tela do fluxo de criação: a pessoa escolhe que tipo de homenagem quer montar antes
 * de entrar no wizard correspondente (CreateVideoWizard ou CreateMemoryBookWizard). */
export const ChooseCreationType: React.FC<ChooseCreationTypeProps> = ({ onChoose, onCancel }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Cancelar
        </button>
        <h2 className="text-xl font-extrabold text-slate-100">Criar Homenagem</h2>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100">Que tipo de homenagem você quer criar?</h3>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Escolha o formato abaixo — os dois viram um vídeo em HD pra compartilhar com o seu pai.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <button
          onClick={() => onChoose('video')}
          className="text-left p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-3xl transition-all group shadow-lg"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
            <Film className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-100 text-lg mb-1.5">Vídeo Slideshow Clássico</h4>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Suas fotos em slideshow com narração, trilha sonora e legendas — o formato original, rápido de montar.
          </p>
          <span className="text-amber-400 font-bold text-xs flex items-center gap-1 group-hover:gap-2 transition-all">
            Escolher este <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <button
          onClick={() => onChoose('book')}
          className="text-left p-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-3xl transition-all group shadow-lg"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
            <BookImage className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-100 text-lg mb-1.5">Livro de Memórias</h4>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Monte páginas estilo revista (capa, colagem, tiras de filme, carta) e vire um vídeo com efeito de páginas.
          </p>
          <span className="text-amber-400 font-bold text-xs flex items-center gap-1 group-hover:gap-2 transition-all">
            Escolher este <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
