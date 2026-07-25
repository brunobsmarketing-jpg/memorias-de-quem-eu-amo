import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, CheckCircle2 } from 'lucide-react';
import { VideoJob } from '../types';
import { drawVideoFrame, getAllSlides } from '../lib/video';
import { PRESET_TRACKS } from '../data/presets';

interface VideoPlayerProps {
  video: VideoJob;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.durationSeconds || 30);
  const [slides, setSlides] = useState<{ id: string; url: string }[]>([]);
  const [preloadedImages, setPreloadedImages] = useState<HTMLImageElement[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isRecordingExport, setIsRecordingExport] = useState<boolean>(false);

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

  // Animation Loop Effect
  useEffect(() => {
    if (!isReady || preloadedImages.length === 0) return;

    let animFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalSlides = preloadedImages.length;
    const slideDuration = duration / totalSlides;

    const render = () => {
      const time = currentTime;

      // Determine current slide and next slide for fade transition
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
        video.fatherName
      );

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + 0.033; // ~30 FPS
          if (next >= duration) {
            setIsPlaying(false);
            if (musicAudioRef.current) musicAudioRef.current.pause();
            if (narrationAudioRef.current) narrationAudioRef.current.pause();
            return 0;
          }
          return next;
        });
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isPlaying, currentTime, duration, isReady, preloadedImages, video]);

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

  // Render MP4 on Server via FFmpeg and download/get link
  const handleDownloadVideo = async () => {
    setIsRecordingExport(true);
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
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao renderizar vídeo no servidor.');
      }

      const data = await response.json();
      if (data.mp4Url) {
        const a = document.createElement('a');
        a.href = data.mp4Url;
        a.download = `Memoria_${video.fatherName.replace(/\s+/g, '_')}.mp4`;
        a.target = '_blank';
        a.click();
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao gerar link de download do vídeo em MP4: ' + e.message);
    } finally {
      setIsRecordingExport(false);
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

        {/* Video Overlays Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-6 z-20">
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
                  className="p-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
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

      {/* Action Buttons */}
      <div className="w-full max-w-lg mt-5 flex flex-col gap-3">
        <button
          onClick={handleDownloadVideo}
          disabled={isRecordingExport}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
        >
          <Download className="w-4 h-4 text-amber-400" />
          {isRecordingExport ? 'Renderizando vídeo em HD...' : 'Baixar Vídeo em HD (.MP4)'}
        </button>
      </div>
    </div>
  );
};
