import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play, Pause, Volume2, VolumeX, Download, CheckCircle2 } from 'lucide-react';
import { MemoryBookJob } from '../types';
import { PRESET_TRACKS } from '../data/presets';
import { fetchMemoryBookRemote } from '../lib/bookApi';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BookVideoPlayerProps {
  book: MemoryBookJob;
}

/**
 * Player do Livro de Memórias. Antes do MP4 final existir, mostra uma prévia leve em CSS
 * (crossfade + leve zoom entre as páginas já compostas) em vez de recriar em canvas o mesmo
 * efeito Ken Burns/transição que o FFmpeg já faz no servidor — assim que o vídeo é renderizado
 * (sob demanda, ao clicar em "Gerar Vídeo"), troca para um <video> nativo com o MP4 de verdade.
 */
export const BookVideoPlayer: React.FC<BookVideoPlayerProps> = ({ book }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecordingExport, setIsRecordingExport] = useState(false);
  const [renderStatusLabel, setRenderStatusLabel] = useState('');
  const [videoUrl, setVideoUrl] = useState(book.unlockedVideoUrl || '');
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);

  const pages = book.pages.filter((p) => !!p.renderedImageUrl);
  const pageDurationMs = Math.max(1500, (book.durationSeconds / Math.max(1, pages.length)) * 1000);
  const selectedTrack = PRESET_TRACKS.find((t) => t.id === book.selectedTrackId) || PRESET_TRACKS[0];
  // As páginas em si continuam sempre no formato 4:5 (ver bookTemplates.ts) — no formato
  // vertical, o vídeo final tarja essa página num quadro 9:16 (ver ffmpeg_book_render.ts).
  // A prévia aqui reflete isso pra não prometer um enquadramento diferente do resultado real.
  const isVertical = book.aspectRatio === 'vertical';
  const previewAspectRatio = isVertical ? '1080 / 1920' : '1080 / 1350';

  useEffect(() => {
    if (!isPlaying || pages.length === 0) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % pages.length);
    }, pageDurationMs);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, pageDurationMs, pages.length]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      musicRef.current?.pause();
      narrationRef.current?.pause();
    } else {
      setIsPlaying(true);
      if (musicRef.current && !isMuted) {
        musicRef.current.volume = 0.25;
        musicRef.current.play().catch(() => {});
      }
      if (narrationRef.current && !isMuted && book.customVoiceAudioUrl) {
        narrationRef.current.volume = 1.0;
        narrationRef.current.play().catch(() => {});
      }
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (musicRef.current) musicRef.current.muted = !isMuted;
    if (narrationRef.current) narrationRef.current.muted = !isMuted;
  };

  // Mesmo padrão de fila + polling de VideoPlayer.tsx (handleDownloadVideo), adaptado para o
  // endpoint de render do livro.
  const handleGenerateVideo = async () => {
    setIsRecordingExport(true);
    setRenderStatusLabel('Enviando para a fila de renderização...');
    try {
      const response = await fetch('/api/render-book-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          pageImageUrls: pages.map((p) => p.renderedImageUrl),
          narrationAudioDataUrl: book.customVoiceAudioUrl,
          selectedTrackId: book.selectedTrackId,
          aspectRatio: book.aspectRatio,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar o livro para renderização no servidor.');
      }

      const { position } = await response.json();
      setRenderStatusLabel(
        position > 0 ? `Na fila (${position} livro${position > 1 ? 's' : ''} na sua frente)...` : 'Renderizando vídeo em HD...'
      );

      const MAX_ATTEMPTS = 80;
      const POLL_INTERVAL_MS = 3000;
      let mp4Url: string | null = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await wait(POLL_INTERVAL_MS);
        const updated = await fetchMemoryBookRemote(book.id);
        if (updated?.unlockedVideoUrl) {
          mp4Url = updated.unlockedVideoUrl;
          break;
        }
        if (attempt === 4) {
          setRenderStatusLabel('Ainda finalizando — pode haver fila em horários de pico...');
        }
      }

      if (!mp4Url) {
        throw new Error('A renderização está demorando mais do que o esperado. Tente novamente em instantes.');
      }

      setVideoUrl(mp4Url);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar o vídeo em MP4: ' + e.message);
    } finally {
      setIsRecordingExport(false);
      setRenderStatusLabel('');
    }
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) return;
    const videoBlob = await (await fetch(videoUrl)).blob();
    const blobUrl = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Livro_de_Memorias_${book.fatherName.replace(/\s+/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  if (videoUrl) {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <video
          src={videoUrl}
          controls
          className={`w-full ${isVertical ? 'max-w-xs' : 'max-w-lg'} rounded-2xl shadow-2xl border border-slate-800`}
          style={{ aspectRatio: previewAspectRatio }}
        />
        <button
          onClick={handleDownloadVideo}
          className="w-full max-w-lg py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
        >
          <Download className="w-4 h-4 text-amber-400" /> Baixar Vídeo em HD (.MP4)
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {selectedTrack && <audio ref={musicRef} src={selectedTrack.audioUrl} loop crossOrigin="anonymous" />}
      {book.customVoiceAudioUrl && <audio ref={narrationRef} src={book.customVoiceAudioUrl} crossOrigin="anonymous" />}

      <div
        className={`relative w-full ${isVertical ? 'max-w-xs' : 'max-w-lg'} bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800`}
        style={{ aspectRatio: previewAspectRatio }}
      >
        {pages.map((page, i) => (
          <img
            key={page.id}
            src={page.renderedImageUrl}
            alt=""
            className={`absolute inset-0 w-full h-full ${isVertical ? 'object-contain bg-black' : 'object-cover'}`}
            style={{
              opacity: i === activeIndex ? 1 : 0,
              transform: i === activeIndex && isPlaying ? 'scale(1.06)' : 'scale(1)',
              transitionProperty: 'opacity, transform',
              transitionDuration: `700ms, ${pageDurationMs}ms`,
            }}
          />
        ))}

        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md bg-slate-900/70 border border-white/10 text-white shadow-lg">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Prévia do Livro
          </span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex flex-col justify-between p-6 z-20">
          <div className="flex justify-end">
            <button
              onClick={handleMuteToggle}
              className="p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md border border-white/10 transition-transform active:scale-95"
              title={isMuted ? 'Ativar som' : 'Mudar para mudo'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="p-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg mt-5 flex flex-col gap-3">
        <button
          onClick={handleGenerateVideo}
          disabled={isRecordingExport || pages.length === 0}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Download className="w-4 h-4" />
          {isRecordingExport ? renderStatusLabel || 'Renderizando vídeo em HD...' : 'Gerar Vídeo em HD (.MP4)'}
        </button>
      </div>
    </div>
  );
};
