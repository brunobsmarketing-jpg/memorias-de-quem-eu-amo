import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Maximize, Minimize } from 'lucide-react';
import { VideoJob, CaptionStyle } from '../types';
import { drawVideoFrame, getAllSlides } from '../lib/video';
import { PRESET_TRACKS, DEFAULT_CAPTION_STYLE } from '../data/presets';
import { fetchVideoJobRemote } from '../lib/videoApi';
import { requestTrialVideoUnlock } from '../lib/trialVideoApi';
import { CaptionStyleEditor } from './CaptionStyleEditor';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface VideoPlayerProps {
  video: VideoJob;
  editableCaptionStyle?: boolean;
  onCaptionStyleChange?: (style: CaptionStyle) => void;
  // Funil "crie primeiro, pague depois" (rota pública /experimente): em vez de baixar o vídeo
  // final direto, gera uma prévia com marca d'água e oferece um CTA pra liberar via Payt.
  trialMode?: boolean;
}

// Dimensões de exportação por formato — o quadrado (1080x1080) é o padrão histórico do
// produto; o vertical (1080x1920, 9:16) é o novo formato alternativo para Stories/Reels.
// A prévia em canvas e o render final no FFmpeg (ver ffmpeg_render.ts) usam os mesmos números.
const CANVAS_DIMENSIONS: Record<'classic' | 'vertical', { width: number; height: number }> = {
  classic: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, editableCaptionStyle = false, onCaptionStyleChange, trialMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasDims = CANVAS_DIMENSIONS[video.aspectRatio === 'vertical' ? 'vertical' : 'classic'];
  const playerFrameRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
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
  // Estado só do funil "crie primeiro, pague depois" (trialMode) — a prévia com marca d'água
  // renderizada de verdade (não o canvas), e o mini-formulário de e-mail pra liberar via Payt.
  const [trialWatermarkUrl, setTrialWatermarkUrl] = useState<string>('');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockName, setUnlockName] = useState('');
  const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);

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
      // Tempo real decorrido desde o último frame — nunca usado "cru": quando a aba fica em
      // segundo plano (troca de aba, minimiza), o requestAnimationFrame fica pausado/muito
      // atrasado pelo navegador, mas o áudio continua tocando no tempo real dele. Ao voltar pra
      // aba, o próximo tick chegava com um delta gigante (ex: 30s de aba escondida), fazendo a
      // prévia pular pra frente de uma vez só (ou pausar cedo demais, achando que acabou) bem
      // longe de onde o áudio realmente está — daí a sensação de "áudio falhando". Limitar o
      // delta evita o salto; ver também o uso de currentTime da narração abaixo.
      const rawDeltaSeconds = (timestamp - lastFrameTimestampRef.current) / 1000;
      const deltaSeconds = Math.min(rawDeltaSeconds, 0.25);
      lastFrameTimestampRef.current = timestamp;

      // Enquanto a narração está tocando de verdade, ela é a fonte da verdade do tempo — lemos
      // a posição real do áudio a cada quadro em vez de acumular um relógio à parte. Isso torna
      // a prévia imune ao problema do delta gigante acima: não importa quanto tempo a aba ficou
      // em segundo plano, o próximo quadro já nasce exatamente sincronizado com o que está
      // audível. Quando a narração termina (ou não existe/está mudo), cai de volta pro relógio
      // por delta, que cobre o silêncio de cauda depois da fala.
      const narrationEl = narrationAudioRef.current;
      const narrationDrivesClock = !!narrationEl && !!video.customVoiceAudioUrl && !narrationEl.paused && !narrationEl.ended;
      const next = narrationDrivesClock ? narrationEl!.currentTime : timeRef.current + deltaSeconds;

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

  // Sincroniza o estado com a tela cheia real do navegador — cobre tanto o botão quanto o
  // usuário saindo pelo Esc ou pelo gesto nativo do celular, que não passam pelo nosso onClick.
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      playerFrameRef.current?.requestFullscreen().catch(() => {
        toast.error('Não foi possível abrir em tela cheia neste navegador.');
      });
    }
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
          aspectRatio: video.aspectRatio,
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
      toast.error('Erro ao gerar o vídeo em MP4: ' + e.message);
    } finally {
      setIsRecordingExport(false);
      setRenderStatusLabel('');
    }
  };

  // Mesmo padrão de fila + polling de handleDownloadVideo, mas gera a versão COM marca d'água
  // (watermark: true) e mostra ela tocando na tela em vez de disparar um download — é assim que
  // a pessoa vê o resultado real antes de decidir comprar.
  const handleGenerateWatermarkedPreview = async () => {
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
          aspectRatio: video.aspectRatio,
          watermark: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar o vídeo para renderização no servidor.');
      }

      const { position } = await response.json();
      setRenderStatusLabel(
        position > 0
          ? `Na fila (${position} vídeo${position > 1 ? 's' : ''} na sua frente)...`
          : 'Renderizando prévia em HD...'
      );

      const MAX_ATTEMPTS = 80;
      const POLL_INTERVAL_MS = 3000;
      let mp4Url: string | null = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await wait(POLL_INTERVAL_MS);
        const updated = await fetchVideoJobRemote(video.id);
        if (updated?.watermarkVideoUrl) {
          mp4Url = updated.watermarkVideoUrl;
          break;
        }
        if (attempt === 4) {
          setRenderStatusLabel('Ainda finalizando — pode haver fila em horários de pico...');
        }
      }

      if (!mp4Url) {
        throw new Error('A renderização está demorando mais do que o esperado. Tente novamente em instantes.');
      }

      setTrialWatermarkUrl(mp4Url);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar a prévia: ' + e.message);
    } finally {
      setIsRecordingExport(false);
      setRenderStatusLabel('');
    }
  };

  const handleRequestUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockEmail.trim()) {
      toast.error('Informe seu e-mail para liberar o vídeo.');
      return;
    }
    setIsRequestingUnlock(true);
    try {
      const checkoutUrl = await requestTrialVideoUnlock(video.id, unlockEmail.trim(), unlockName.trim());
      window.location.href = checkoutUrl;
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Não foi possível continuar. Tente novamente.');
      setIsRequestingUnlock(false);
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
      <div
        ref={playerFrameRef}
        className={`relative w-full ${video.aspectRatio === 'vertical' ? 'max-w-xs' : 'max-w-lg'} ${isFullscreen ? 'max-w-none h-full' : ''} bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group`}
        style={{ aspectRatio: isFullscreen ? undefined : `${canvasDims.width} / ${canvasDims.height}` }}
      >
        {trialMode && trialWatermarkUrl ? (
          <video
            src={trialWatermarkUrl}
            controls
            autoPlay
            className={isFullscreen ? 'max-w-full max-h-full w-auto h-auto object-contain' : 'w-full h-full object-contain bg-black'}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={canvasDims.width}
            height={canvasDims.height}
            className={isFullscreen ? 'max-w-full max-h-full w-auto h-auto object-contain' : 'w-full h-full object-cover'}
          />
        )}

        {/* Video Overlays Controls — sempre visíveis (não só no hover), já que celular não tem
            hover persistente e os controles ficavam invisíveis/exigiam toque duplo no mobile.
            Escondidos quando mostra a prévia com marca d'água (vídeo <video> nativo já tem
            controles próprios — os dois juntos ficariam duplicados/confusos). */}
        {/* Controles flutuam sobre o vídeo/foto (conteúdo de cor arbitrária), não sobre o fundo
            do site — por isso usam preto/branco fixos (bg-black, text-white) em vez dos tokens
            slate-900/950 remapeáveis por tema: no tema claro esses tokens viram quase-branco,
            e um ícone branco em cima de um fundo quase-branco fica invisível (bug real relatado:
            botões de mudo/tela cheia/reiniciar sumindo no tema claro). */}
        {!(trialMode && trialWatermarkUrl) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-6 z-20">
            <div className="flex justify-end gap-2">
              <button
                onClick={handleMuteToggle}
                className="p-3 bg-black/70 hover:bg-black/85 text-white rounded-full backdrop-blur-md border border-white/10 transition-transform active:scale-95"
                title={isMuted ? 'Ativar som' : 'Mudar para mudo'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button
                onClick={handleToggleFullscreen}
                className="p-3 bg-black/70 hover:bg-black/85 text-white rounded-full backdrop-blur-md border border-white/10 transition-transform active:scale-95"
                title={isFullscreen ? 'Sair da tela cheia' : 'Ver em tela cheia'}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
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
                    className="p-3 bg-black/70 hover:bg-black/85 text-white rounded-full backdrop-blur-md border border-white/10"
                    title="Reiniciar"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>

                <span className="text-xs font-mono font-medium text-white/90 bg-black/60 px-2.5 py-1 rounded-md">
                  {Math.floor(currentTime)}s / {Math.floor(duration)}s
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Personalização da Legenda — a escolha inicial já acontece antes de gerar o vídeo (Passo 4
          do wizard), isso aqui é só pra ajustar depois de ver o resultado final. */}
      {editableCaptionStyle && (
        <CaptionStyleEditor
          captionStyle={captionStyle}
          onChange={updateCaptionStyle}
          className="w-full max-w-lg mt-5"
        />
      )}

      {/* Action Buttons */}
      <div className="w-full max-w-lg mt-5 flex flex-col gap-3">
        {trialMode ? (
          trialWatermarkUrl ? (
            <form onSubmit={handleRequestUnlock} className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-sm font-bold text-slate-100 text-center">Gostou? Libere sem marca d'água</p>
              <input
                type="text"
                value={unlockName}
                onChange={(e) => setUnlockName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
              <input
                type="email"
                required
                value={unlockEmail}
                onChange={(e) => setUnlockEmail(e.target.value)}
                placeholder="Seu melhor e-mail"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={isRequestingUnlock}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-black font-extrabold text-sm rounded-xl shadow-lg transition-transform active:scale-98"
              >
                {isRequestingUnlock ? 'Redirecionando...' : "Liberar Vídeo sem Marca d'Água"}
              </button>
              <p className="text-[11px] text-slate-500 text-center">
                Você será redirecionado pro pagamento seguro. O vídeo em HD chega no seu e-mail assim que confirmar.
              </p>
            </form>
          ) : (
            <button
              onClick={handleGenerateWatermarkedPreview}
              disabled={isRecordingExport}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-black font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              {isRecordingExport ? renderStatusLabel || 'Renderizando prévia...' : 'Gerar Prévia do Meu Vídeo'}
            </button>
          )
        ) : (
          <button
            onClick={handleDownloadVideo}
            disabled={isRecordingExport}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
          >
            <Download className="w-4 h-4 text-amber-400" />
            {isRecordingExport ? renderStatusLabel || 'Renderizando vídeo em HD...' : 'Baixar Vídeo em HD (.MP4)'}
          </button>
        )}
      </div>
    </div>
  );
};
