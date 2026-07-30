import React from 'react';
import { CaptionStyle } from '../types';
import { CAPTION_FONTS, CAPTION_COLORS, CAPTION_BACKGROUNDS } from '../data/presets';

interface CaptionStyleEditorProps {
  captionStyle: CaptionStyle;
  onChange: (partial: Partial<CaptionStyle>) => void;
  className?: string;
}

/** Seletor de tipografia/cor/fundo da legenda queimada no vídeo — usado tanto no wizard (Passo 4,
 * antes do vídeo ser gerado) quanto na prévia final (VideoPlayer, pra ajustar depois de ver o
 * resultado). Extraído pra componente compartilhado pra não duplicar essa UI nos dois lugares. */
export const CaptionStyleEditor: React.FC<CaptionStyleEditorProps> = ({ captionStyle, onChange, className = '' }) => {
  return (
    <div className={`space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 ${className}`}>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estilo da Legenda</h4>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 font-semibold">Tipografia</p>
        <div className="grid grid-cols-5 gap-1.5">
          {CAPTION_FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => onChange({ fontId: font.id })}
              className={`py-2 rounded-lg border text-[11px] font-bold transition-all ${
                captionStyle.fontId === font.id
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
              style={{ fontFamily: `"${font.previewFontFamily}", sans-serif` }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 font-semibold">Cor do Texto</p>
        <div className="grid grid-cols-5 gap-1.5">
          {CAPTION_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => onChange({ colorId: color.id })}
              title={color.label}
              className={`h-9 rounded-lg border flex items-center justify-center transition-all ${
                captionStyle.colorId === color.id
                  ? 'border-amber-500 ring-1 ring-amber-500'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              style={{ backgroundColor: '#1e293b' }}
            >
              <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: color.hex }} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 font-semibold">Fundo da Legenda</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CAPTION_BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => onChange({ backgroundId: bg.id })}
              className={`py-2 rounded-lg border text-[11px] font-bold transition-all ${
                captionStyle.backgroundId === bg.id
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {bg.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
