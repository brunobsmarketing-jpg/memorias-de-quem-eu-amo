import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, CheckCircle2 } from 'lucide-react';
import { VideoJob, CaptionStyle } from '../types';
import { drawVideoFrame, getAllSlides } from '../lib/video';
import { PRESET_TRACKS, CAPTION_FONTS, CAPTION_COLORS, CAPTION_BACKGROUNDS } from '../data/presets';
import { fetchVideoJobRemote } from '../lib/videoApi';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontId: CAPTION_FONTS[0].id,
  colorId: CAPTION_COLORS[0].id,
  backgroundId: 'dark',
};

interface VideoPlayerProps {
  video: VideoJob;
  editableCaptionStyle?: boolean;
  onCaptionStyleChange?: (style: CaptionStyle) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, editableCaptionStyle = false, onCaptionStyleChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  // Relógio interno da prévia — vive num ref (não num state) porque precisa ser atualizado a
  // cada frame sem disparar reconciliação do React a cada 33ms (era isso que causava
  // travamento e desincronizava o áudio, que toca em tempo real independente do React).
  const timeRef = useRef<number>(0);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const lastStateSyncRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.durationSeconds || 30);
  const [narrationDuration, setNarrationDuration] = useState<number | null>(null);
  const [slides, setSlides] = useState<{ id: string; url: string }[]>([]);
  const [preloadedImages, setPreloadedImages] = useState<HTMLImageElement[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isRecordingExport, setIsRecordingExport] = useState<boolean>(false);
  const [renderStatusLabel, setRenderStatusLabel] = useState<string>('');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(video.captionStyle || DEFAULT_CAPTION_STYLE);

  const updateCaptionStyle = (partial: Partial<CaptionStyle>) => {
    setCaptionStyle((prev) => {
      const next = { ...prev, ...partial };
      onCaptionStyleChange?.(next);
      return next;
    });
  };

  // Load slides and images
  useEffect(() => {
    const list = getAllSlides(video);
    setSlides(list);

    // Preload HTMLImageElement for canvas rendering
    let loadedCount = 0;
    const imgObjects: HTMLImageElement[] = [];

    if (list.length === 0) {
      setIsReady(true);
      return;
    }

    list.forEach((slide, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = slide.url;
      img.onload = () => {
        loadedCount++;
        imgObjects[index] = img;
        if (loadedCount === list.length) {
          setPreloadedImages(imgObjects);
          setIsReady(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        // Fallback placeholder image
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, 800, 800);
          ctx.fillStyle = '#ffffff';
          ctx.font = '30px sans-serif';
          ctx.fillText('Foto de Homenagem', 250, 400);
        }
        const fallbackImg = new Image();
        fallbackImg.src = canvas.toDataURL();
        imgObjects[index] = fallbackImg;
        if (loadedCount === list.length) {
          setPreloadedImages(imgObjects);
          setIsReady(true);
        }
      };
    });
  }, [video]);

  // Audio track configuration
  const selectedTrack = PRESET_TRACKS.find((t) => t.id === video.selectedTrackId) || PRESET_TRACKS[0];

  // A prévia precisa durar o mesmo tempo que o vídeo final renderizado no servidor, que é
  // calculado a partir da duração REAL da narração (ver ffmpeg_render.ts) — não da quantidade
  // de fotos. Sem isso, a prévia corta a narração e dessincroniza a legenda quando o texto é
  // mais longo do que "quantidade de fotos x 6s".
  useEffect(() => {
    if (narrationDuration && narrationDuration > 0) {
      const MIN_DURATION = 20;
      const MAX_DURATION = 75;
      const NARRATION_TAIL_SECONDS = 1.5;
      setDuration(Math.min(MAX_DURATION, Math.max(MIN_DURATION, narrationDuration + NARRATION_TAIL_SECONDS)));
    }
  }, [narrationDuration]);

  // Animation Loop Effect — desenha um frame a partir de "time" (segundos), sem depender do
  // state currentTime (só usado pra exibir a barra de progresso, atualizado a uma taxa mais
  // baixa logo abaixo).
  const drawFrameAt = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || preloadedImages.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalSlides = preloadedImages.length;
    const slideDuration = duration / totalSlides;

    const rawSlideIndex = Math.floor(time / slideDuration);
    const currentSlideIndex = Math.min(rawSlideIndex, totalSlides - 1);
    const nextSlideIndex = (currentSlideIndex + 1) % totalSlides;

    const slideTime = time % slideDuration;
    const transitionTime = 1.2; // 1.2s cross-fade transition
    let fadeProgress = 0;

    if (slideDuration - slideTime <= transitionTime && currentSlideIndex < totalSlides - 1) {
      fadeProgress = (transitionTime - (slideDuration - slideTime)) / transitionTime;
    }

    // Gentle Ken Burns zoom scale (from 1.0 to 1.12 over slide duration)
    const zoomProgress = slideTime / slideDuration;
    const zoomScale = 1.0 + zoomProgress * 0.12;

    // Extract subtitle portion corresponding to current slide
    const textSentences = (video.tributeText || 'Uma homenagem especial de quem te ama.').split(/(?<=[.!?])\s+/);
    const subtitleIndex = Math.min(Math.floor((time / duration) * textSentences.length), textSentences.length - 1);
    const currentSubtitle = textSentences[subtitleIndex] || video.tributeText;

    drawVideoFrame(
      ctx,
      canvas.width,
      canvas.height,
      preloadedImages[currentSlideIndex] || null,
      fadeProgress > 0 ? preloadedImages[nextSlideIndex] || null : null,
      fadeProgress,
      zoomScale,
      currentSubtitle,
      video.fatherName,
      captionStyle
    );
  };

  // Redesenha o frame atual (parado) sempre que algo visual mudar (legenda, imagens, etc.)
  // mesmo sem estar tocando — sem isso, mudar o estilo de legenda só refletiria na próxima vez
  // que desse play.
  useEffect(() => {
    if (!isReady || isPlaying) return;
    drawFrameAt(timeRef.current);
  }, [isReady, preloadedImages, captionStyle, duration, video]);

  useEffect(() => {
    if (!isPlaying || !isReady || preloadedImages.length === 0) return;

    let animFrameId: number;
    lastFrameTimestampRef.current = null;

    const tick = (timestamp: number) => {
      if (lastFrameTimestampRef.current === null) {
        lastFrameTimestampRef.current = timestamp;
      }
      // Tempo real decorrido desde o último frame (não um incremento fixo assumido) — é isso
      // que mantém a prévia sincronizada com o áudio, que toca no relógio real do navegador
      // independente de quantos frames o React consegue desenhar por segundo.
      const deltaSeconds = (timestamp - lastFrameTimestampRef.current) / 1000;
      lastFrameTimestampRef.current = timestamp;

      const next = timeRef.current + deltaSeconds;

      if (next >= duration) {
        timeRef.current = duration;
        drawFrameAt(duration);
        setCurrentTime(duration);
        setIsPlaying(false);
        musicAudioRef.current?.pause();
        narrationAudioRef.current?.pause();
        return;
      }

      timeRef.current = next;
      drawFrameAt(next);

      // Só sincroniza o state (barra de progresso/contador) uns 10x por segundo — não precisa
      // de mais que isso pra parecer fluido, e evita re-render do React a 60fps.
      if (timestamp - lastStateSyncRef.current >= 100) {
        lastStateSyncRef.current = timestamp;
        setCurrentTime(next);
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isPlaying, duration, isReady, preloadedImages, video, captionStyle]);

  // Audio Playback Sync
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      musicAudioRef.current?.pause();
      narrationAudioRef.current?.pause();
    } else {
      setIsPlaying(true);
      if (musicAudioRef.current && !isMuted) {
        musicAudioRef.current.volume = 0.25; // Gentle background music volume
        musicAudioRef.current.play().catch(() => {});
      }
      if (narrationAudioRef.current && !isMuted && video.customVoiceAudioUrl) {
        narrationAudioRef.current.volume = 1.0;
        narrationAudioRef.current.play().catch(() => {});
      }
    }
  };

  const handleRestart = () => {
    timeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
    if (musicAudioRef.current) {
      musicAudioRef.current.currentTime = 0;
      if (!isMuted) musicAudioRef.current.play().catch(() => {});
    }
    if (narrationAudioRef.current) {
      narrationAudioRef.current.currentTime = 0;
      if (!isMuted) narrationAudioRef.current.play().catch(() => {});
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (musicAudioRef.current) musicAudioRef.current.muted = !isMuted;
    if (narrationAudioRef.current) narrationAudioRef.current.muted = !isMuted;
  };

  // Envia o vídeo para a fila de renderização no servidor (FFmpeg) e acompanha o progresso
  // via polling, em vez de manter a requisição HTTP aberta — em horários de pico o vídeo
  // pode ficar alguns instantes na fila antes de começar a renderizar de fato (ver
  // RenderQueue em server.ts), e uma conexão longa correria risco de timeout no proxy.
  const handleDownloadVideo = async () => {
    setIsRecordingExport(true);
    setRenderStatusLabel('Enviando para a fila de renderização...');
    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          fatherName: video.fatherName,
          photos: video.photos,
          aiImages: video.aiGeneratedImages,
          useAIImages: video.useAIImages,
          tributeText: video.tributeText,
          narrationAudioDataUrl: video.customVoiceAudioUrl,
          selectedTrackId: video.selectedTrackId,
          captionStyle,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar o vídeo para renderização no servidor.');
      }

      const { position } = await response.json();
      setRenderStatusLabel(
        position > 0
          ? `Na fila (${position} vídeo${position > 1 ? 's' : ''} na sua frente)...`
          : 'Renderizando vídeo em HD...'
      );

      const MAX_ATTEMPTS = 80; // até ~4min no total, cobre fila + renderização em picos
      const POLL_INTERVAL_MS = 3000;
      let mp4Url: string | null = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await wait(POLL_INTERVAL_MS);
        const updated = await fetchVideoJobRemote(video.id);
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

      // Baixa o arquivo via fetch e cria uma blob URL (mesma origem da página) antes de
      // disparar o download. O mp4Url é do Supabase Storage (outra origem) — a maioria dos
      // navegadores ignora o atributo "download" em links de origem diferente e só abre/
      // reproduz o vídeo em vez de salvar o arquivo, o que fazia o download "não funcionar".
      setRenderStatusLabel('Preparando arquivo para download...');
      const videoBlob = await (await fetch(mp4Url)).blob();
      const blobUrl = URL.createObjectURL(videoBlob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Memoria_${video.fatherName.replace(/\s+/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao gerar o vídeo em MP4: ' + e.message);
    } finally {
      setIsRecordingExport(false);
      setRenderStatusLabel('');
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Background Audio Elements */}
      {selectedTrack && (
        <audio
          ref={musicAudioRef}
          src={selectedTrack.audioUrl}
          loop
          crossOrigin="anonymous"
        />
      )}
      {video.customVoiceAudioUrl && (
        <audio
          ref={narrationAudioRef}
          src={video.customVoiceAudioUrl}
          crossOrigin="anonymous"
          onLoadedMetadata={(e: React.SyntheticEvent<HTMLAudioElement>) => setNarrationDuration(e.currentTarget.duration)}
        />
      )}

      {/* Main Canvas Frame */}
      <div className="relative w-full max-w-lg aspect-square bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={1080}
          height={1080}
          className="w-full h-full object-cover"
        />

        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md bg-slate-900/70 border border-white/10 text-white shadow-lg">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> HD Sem Marca d'Água
          </span>
        </div>

        {/* Video Overlays Controls — sempre visíveis (não só no hover), já que celular não tem
            hover persistente e os controles ficavam invisíveis/exigiam toque duplo no mobile */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-between p-6 z-20">
          <div className="flex justify-end">
            <button
              onClick={handleMuteToggle}
              className="p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md border border-white/10 transition-transform active:scale-95"
              title={isMuted ? 'Ativar som' : 'Mudar para mudo'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Progress bar */}
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleRestart}
                  className="p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md border border-white/10"
                  title="Reiniciar"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              <span className="text-xs font-mono font-medium text-slate-300 bg-slate-950/60 px-2.5 py-1 rounded-md">
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Personalização da Legenda */}
      {editableCaptionStyle && (
        <div className="w-full max-w-lg mt-5 space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estilo da Legenda</h4>

          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500 font-semibold">Tipografia</p>
            <div className="grid grid-cols-5 gap-1.5">
              {CAPTION_FONTS.map((font) => (
                <button
                  key={font.id}
                  onClick={() => updateCaptionStyle({ fontId: font.id })}
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
                  onClick={() => updateCaptionStyle({ colorId: color.id })}
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
                  onClick={() => updateCaptionStyle({ backgroundId: bg.id })}
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
      )}

      {/* Action Buttons */}
      <div className="w-full max-w-lg mt-5 flex flex-col gap-3">
        <button
          onClick={handleDownloadVideo}
          disabled={isRecordingExport}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
        >
          <Download className="w-4 h-4 text-amber-400" />
          {isRecordingExport ? renderStatusLabel || 'Renderizando vídeo em HD...' : 'Baixar Vídeo em HD (.MP4)'}
        </button>
      </div>
    </div>
  );
};
