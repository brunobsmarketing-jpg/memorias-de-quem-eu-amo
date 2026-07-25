import { VideoJob } from '../types';
import { PRESET_TRACKS } from '../data/presets';

export interface VideoRenderFrame {
  currentPhotoUrl: string;
  nextPhotoUrl?: string;
  fadeProgress: number; // 0 to 1
  zoomScale: number;
  subtitleText: string;
  watermark: boolean;
}

export function getAllSlides(video: VideoJob): { id: string; url: string; title?: string }[] {
  const userPhotos = (video.photos || [])
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ id: p.id, url: p.url }));

  if (video.useAIImages && video.aiGeneratedImages && video.aiGeneratedImages.length > 0) {
    const aiSlides = video.aiGeneratedImages.map((img, i) => ({
      id: `ai-slide-${i}`,
      url: img.url,
      title: img.prompt,
    }));
    // Interleave AI illustrations after user photos
    return [...userPhotos, ...aiSlides];
  }

  return userPhotos;
}

// Draw a single HD frame on canvas with Ken Burns effect, fade transition, subtitles, and watermark
export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentImg: HTMLImageElement | null,
  nextImg: HTMLImageElement | null,
  fadeProgress: number,
  zoomScale: number,
  subtitleText: string,
  watermark: boolean,
  fatherName: string
) {
  // Clear canvas background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Helper to draw image cover with zoom scale
  const drawImageCover = (img: HTMLImageElement, scale: number, opacity: number) => {
    ctx.save();
    ctx.globalAlpha = opacity;

    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let renderW = width;
    let renderH = height;

    if (imgAspect > canvasAspect) {
      renderW = height * imgAspect;
    } else {
      renderH = width / imgAspect;
    }

    // Apply scale (Ken Burns)
    renderW *= scale;
    renderH *= scale;

    const x = (width - renderW) / 2;
    const y = (height - renderH) / 2;

    ctx.drawImage(img, x, y, renderW, renderH);
    ctx.restore();
  };

  // Draw current image
  if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
    drawImageCover(currentImg, zoomScale, 1 - fadeProgress);
  }

  // Draw next image during transition
  if (nextImg && nextImg.complete && nextImg.naturalWidth > 0 && fadeProgress > 0) {
    drawImageCover(nextImg, 1.0 + fadeProgress * 0.05, fadeProgress);
  }

  // Vignette overlay
  const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0.1)');
  grad.addColorStop(1, 'rgba(15,23,42,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtitle Overlay Card
  if (subtitleText) {
    ctx.save();
    const padding = 40;
    const cardWidth = width - padding * 2;
    const cardHeight = 160;
    const cardX = padding;
    const cardY = height - cardHeight - 80;

    // Dark glass background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 20) : ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    ctx.fill();
    ctx.stroke();

    // Subtitle text
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap subtitle text if long
    const words = subtitleText.split(' ');
    let line = '';
    const lines: string[] = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > cardWidth - 60 && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const startY = cardY + cardHeight / 2 - (lines.length - 1) * 20;
    lines.forEach((l, i) => {
      ctx.fillText(l.trim(), width / 2, startY + i * 40);
    });

    ctx.restore();
  }

  // Header Title
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Homenagem para ${fatherName || 'Meu Pai'}`, width / 2, 60);
  ctx.restore();

  // Watermark Banner if needed
  if (watermark) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-25 * Math.PI) / 180);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'; // Warm translucent red
    ctx.fillRect(-width, -50, width * 2, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 12;
    ctx.fillText('PRÉVIA - MEMÓRIAS DE QUEM EU AMO', 0, 0);

    ctx.restore();
  }
}
