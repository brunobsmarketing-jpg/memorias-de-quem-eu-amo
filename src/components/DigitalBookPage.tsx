import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Heart, QrCode, Share2, Check, Sparkles } from 'lucide-react';
import { MemoryBookJob } from '../types';
import { BookVideoPlayer } from './BookVideoPlayer';
import { generateQRCodeDataUrl } from '../lib/qrcode';

interface DigitalBookPageProps {
  book: MemoryBookJob;
  onGoHome: () => void;
}

export const DigitalBookPage: React.FC<DigitalBookPageProps> = ({ book, onGoHome }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    generateQRCodeDataUrl(book.cardUrl).then((url) => setQrCodeDataUrl(url));
  }, [book.cardUrl]);

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(book.cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Falha ao copiar o link:', e);
      toast.error('Não foi possível copiar automaticamente. Copie o link manualmente:', {
        description: book.cardUrl,
        duration: 10000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 flex flex-col items-center justify-between">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Heart className="w-3.5 h-3.5" /> Livro de Memórias
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-100">
            Feliz Dia dos Pais, {book.fatherName}!
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Um álbum de memórias em vídeo, montado com carinho página por página.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <BookVideoPlayer book={book} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-5">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code" className="w-28 h-28 rounded-xl border border-slate-700 bg-white p-1" />
            ) : (
              <div className="w-28 h-28 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                <QrCode className="w-8 h-8" />
              </div>
            )}
            <div>
              <h4 className="font-bold text-slate-100 text-base flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-400" /> QR Code do Livro
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Aponte a câmera do celular para abrir este livro em vídeo a qualquer momento.
              </p>
            </div>
          </div>

          <button
            onClick={handleShareLink}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-amber-400" />}
            {copied ? 'Link Copiado!' : 'Copiar Link para Enviar no WhatsApp'}
          </button>
        </div>

        <div className="text-center pt-6">
          <button
            onClick={onGoHome}
            className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm rounded-2xl shadow-xl transition-transform active:scale-95 inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Crie o Seu Livro de Memórias Também
          </button>
        </div>
      </div>
    </div>
  );
};
