import React, { useEffect, useState, useRef } from 'react';
import { Heart, QrCode, Download, Sparkles, ExternalLink, Share2, Check, Loader2 } from 'lucide-react';
import { VideoJob } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { generateQRCodeDataUrl } from '../lib/qrcode';

interface DigitalCardPageProps {
  video: VideoJob;
  onGoHome: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

/** Desenha uma imagem cobrindo todo o retângulo (igual ao CSS background-size: cover). */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let renderW = width;
  let renderH = height;
  if (imgAspect > targetAspect) {
    renderW = height * imgAspect;
  } else {
    renderH = width / imgAspect;
  }
  const x = (width - renderW) / 2;
  const y = (height - renderH) / 2;
  ctx.drawImage(img, x, y, renderW, renderH);
}

export const DigitalCardPage: React.FC<DigitalCardPageProps> = ({ video, onGoHome }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState<boolean>(false);
  const cardBackgroundRef = useRef<string>('');

  useEffect(() => {
    generateQRCodeDataUrl(video.cardUrl).then((url) => setQrCodeDataUrl(url));
  }, [video.cardUrl]);

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(video.cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Falha ao copiar o link:', e);
      alert(`Não foi possível copiar automaticamente. Copie o link manualmente:\n\n${video.cardUrl}`);
    }
  };

  const getOrGenerateCardBackground = async (): Promise<string> => {
    if (cardBackgroundRef.current) return cardBackgroundRef.current;
    const response = await fetch('/api/generate-card-background', { method: 'POST' });
    if (!response.ok) throw new Error('Falha ao gerar a ilustração do cartão.');
    const data = await response.json();
    cardBackgroundRef.current = data.imageDataUrl;
    return data.imageDataUrl;
  };

  const handleDownloadCardPDF = async () => {
    setIsGeneratingCard(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fundo ilustrado gerado por IA (paleta de azuis vivos), com fallback para gradiente
      // simples caso a geração falhe.
      try {
        const bgDataUrl = await getOrGenerateCardBackground();
        const bgImg = await loadImage(bgDataUrl);
        drawImageCover(ctx, bgImg, 1200, 1600);
      } catch (e) {
        console.warn('Não foi possível gerar a ilustração do cartão, usando fundo simples:', e);
        const grad = ctx.createLinearGradient(0, 0, 1200, 1600);
        grad.addColorStop(0, '#1e3a8a');
        grad.addColorStop(0.5, '#2563eb');
        grad.addColorStop(1, '#0c1445');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 1600);
      }

      // Véu escuro suave para garantir legibilidade do texto sobre a ilustração
      const veil = ctx.createLinearGradient(0, 0, 0, 1600);
      veil.addColorStop(0, 'rgba(8,15,40,0.45)');
      veil.addColorStop(0.25, 'rgba(8,15,40,0.15)');
      veil.addColorStop(0.7, 'rgba(8,15,40,0.25)');
      veil.addColorStop(1, 'rgba(8,15,40,0.6)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, 1200, 1600);

      // Border frame
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 10;
      ctx.strokeRect(40, 40, 1120, 1520);

      // Title
      ctx.fillStyle = '#fef9c3';
      ctx.font = 'bold 54px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText('Homenagem de Dia dos Pais', 600, 160);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(`Para meu querido Pai, ${video.fatherName}`, 600, 240);
      ctx.shadowBlur = 0;

      // Message box
      ctx.fillStyle = 'rgba(8,15,40,0.55)';
      ctx.fillRect(100, 320, 1000, 500);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '32px sans-serif';

      // Wrap tribute text
      const words = video.tributeText.split(' ');
      let line = '';
      const lines: string[] = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > 920) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      lines.forEach((l, idx) => {
        ctx.fillText(l.trim(), 600, 380 + idx * 50);
      });

      // QR Code Image draw
      if (qrCodeDataUrl) {
        const qrImg = await loadImage(qrCodeDataUrl);
        const qrPadding = 20;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(450 - qrPadding, 920 - qrPadding, 300 + qrPadding * 2, 300 + qrPadding * 2);
        ctx.drawImage(qrImg, 450, 920, 300, 300);
      }

      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 30px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText('Aponte a câmera do celular para assistir ao vídeo em HD', 600, 1280);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '24px sans-serif';
      ctx.fillText('Criado com carinho em "Memórias de Quem Eu Amo"', 600, 1420);
      ctx.shadowBlur = 0;

      const link = document.createElement('a');
      link.download = `Cartao_Digital_${video.fatherName.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e: any) {
      console.error('Erro ao gerar cartão imprimível:', e);
      alert('Não foi possível gerar o cartão imprimível agora. Tente novamente.');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 flex flex-col items-center justify-between">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Heart className="w-3.5 h-3.5 text-ember-400 fill-ember-500" /> Cartão Digital Especial
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-100">
            Feliz Dia dos Pais, {video.fatherName}!
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Uma mensagem especial de amor e gratidão gravada em memórias inesquecíveis.
          </p>
        </div>

        {/* Video Player Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <VideoPlayer video={video} />
        </div>

        {/* Emotional Message Text Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Mensagem da Homenagem</h3>
          <blockquote className="text-slate-200 text-base sm:text-lg italic leading-relaxed font-serif border-l-2 border-amber-500 pl-4">
            "{video.tributeText}"
          </blockquote>
        </div>

        {/* QR Code & Share Box */}
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
                <QrCode className="w-4 h-4 text-amber-400" /> QR Code do Cartão
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Aponte a câmera do seu celular para abrir este vídeo e cartão a qualquer momento.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleShareLink}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-amber-400" />}
              {copied ? 'Link Copiado!' : 'Copiar Link para Enviar no WhatsApp'}
            </button>

            <button
              onClick={handleDownloadCardPDF}
              disabled={isGeneratingCard}
              className="px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-60 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-2"
            >
              {isGeneratingCard ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando ilustração...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Baixar Cartão Imprimível
                </>
              )}
            </button>
          </div>
        </div>

        {/* CTA "Crie o seu também" */}
        <div className="text-center pt-6">
          <button
            onClick={onGoHome}
            className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm rounded-2xl shadow-xl transition-transform active:scale-95 inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Crie o Seu Vídeo Homenagem Também
          </button>
        </div>
      </div>
    </div>
  );
};
