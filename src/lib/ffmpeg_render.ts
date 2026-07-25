import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { PRESET_TRACKS } from '../data/presets';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface RenderVideoParams {
  videoId: string;
  fatherName: string;
  photos: string[]; // data URLs or file paths
  aiImages?: { prompt: string; url: string }[];
  useAIImages?: boolean;
  tributeText: string;
  narrationAudioDataUrl?: string;
  selectedTrackId?: string;
}

const FPS = 30;
const MIN_DURATION = 20;
const MAX_DURATION = 75;
const NARRATION_TAIL_SECONDS = 1.5;
// Fonte empacotada no próprio projeto (assets/fonts) em vez de um caminho do sistema operacional —
// um caminho como "C:/Windows/Fonts/arial.ttf" não existiria no Linux do servidor de produção.
const FONT_PATH = path.join(process.cwd(), 'assets', 'fonts', 'Poppins-Bold.ttf');
const FONT_FAMILY = 'PoppinsBoldMemorias';
GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);

const CANVAS_SIZE = 1080;

/**
 * Desenha um retângulo com cantos arredondados (compatibilidade — nem toda build do canvas tem roundRect nativo).
 */
function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Renderiza o título (nome do pai) como PNG transparente 1080x1080, para ser sobreposto ao vídeo
 * via overlay do FFmpeg — evita depender do filtro drawtext, que não existe no build estático
 * do FFmpeg usado em produção (Linux).
 */
function renderTitlePng(text: string): Buffer {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.font = `46px "${FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(text, CANVAS_SIZE / 2, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, CANVAS_SIZE / 2, 70);
  return canvas.toBuffer('image/png');
}

/**
 * Renderiza um cartão de legenda (fundo semitransparente + texto) como PNG transparente 1080x1080.
 */
function renderSubtitlePng(lines: string[]): Buffer {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');

  const padding = 40;
  const cardWidth = CANVAS_SIZE - padding * 2;
  const lineHeight = 50;
  const cardHeight = Math.max(120, lines.length * lineHeight + 60);
  const cardX = padding;
  const cardY = CANVAS_SIZE - cardHeight - 80;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 20);
  ctx.fill();

  ctx.font = `42px "${FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  const startY = cardY + cardHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_SIZE / 2, startY + i * lineHeight);
  });

  return canvas.toBuffer('image/png');
}

function savePngToTempFile(buffer: Buffer, prefix: string): string {
  const tempDir = path.join(process.cwd(), 'public', 'renders', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function saveBase64ToTempFile(dataUrl: string, prefix: string, ext: string): string {
  const tempDir = path.join(process.cwd(), 'public', 'renders', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
  const filePath = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
}

async function downloadUrlToTempFile(url: string, prefix: string, ext: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'public', 'renders', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar recurso remoto (${response.status}): ${url}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

/**
 * Usa o próprio binário do FFmpeg (sem depender de ffprobe) para ler a duração
 * de um arquivo de áudio a partir do cabeçalho impresso no stderr.
 */
function getMediaDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(0);
    const proc = spawn(ffmpegPath as string, ['-i', filePath]);
    let stderrOutput = '';
    proc.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });
    proc.on('close', () => {
      const match = stderrOutput.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
      } else {
        resolve(0);
      }
    });
    proc.on('error', () => resolve(0));
  });
}

function splitIntoSentences(text: string): string[] {
  const cleaned = (text || '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Quebra um texto em linhas curtas para caber no cartão de legenda do vídeo. */
function wrapTextForSubtitle(text: string, maxCharsPerLine = 28, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    const tail = lines.slice(maxLines - 1).join(' ');
    return [...head, tail];
  }
  return lines;
}

/**
 * Serviço de Renderização Server-Side de Vídeo MP4 usando FFmpeg.
 * Gera o slideshow em MP4 com efeito Ken Burns, transições de crossfade entre fotos,
 * narração + trilha sonora mixadas, e legendas queimadas sincronizadas com o texto.
 */
export async function renderVideoWithFFmpeg(params: RenderVideoParams): Promise<string> {
  const publicRendersDir = path.join(process.cwd(), 'public', 'renders');
  if (!fs.existsSync(publicRendersDir)) {
    fs.mkdirSync(publicRendersDir, { recursive: true });
  }

  const outputFileName = `render_${params.videoId}.mp4`;
  const outputFilePath = path.join(publicRendersDir, outputFileName);
  const publicVideoUrl = `/renders/${outputFileName}`;

  if (fs.existsSync(outputFilePath)) {
    return publicVideoUrl;
  }

  const allImageUrls: string[] = [...params.photos];
  if (params.useAIImages && params.aiImages && params.aiImages.length > 0) {
    params.aiImages.forEach((img) => allImageUrls.push(img.url));
  }

  const tempFilesToDelete: string[] = [];

  try {
    // 1. Salvar imagens em arquivos temporários
    const imageTempPaths: string[] = allImageUrls.map((url, i) => {
      if (url.startsWith('data:image')) {
        const ext = url.includes('png') ? 'png' : 'jpg';
        const p = saveBase64ToTempFile(url, `img_${i}`, ext);
        tempFilesToDelete.push(p);
        return p;
      }
      return url;
    });

    if (imageTempPaths.length === 0) {
      throw new Error('Nenhuma foto disponível para renderizar o vídeo.');
    }

    // 2. Salvar narração em arquivo temporário, se houver
    let narrationTempPath = '';
    if (params.narrationAudioDataUrl && params.narrationAudioDataUrl.startsWith('data:audio')) {
      narrationTempPath = saveBase64ToTempFile(params.narrationAudioDataUrl, 'narration', 'mp3');
      tempFilesToDelete.push(narrationTempPath);
    }

    // 3. Baixar a trilha sonora escolhida
    const track = PRESET_TRACKS.find((t) => t.id === params.selectedTrackId) || PRESET_TRACKS[0];
    let musicTempPath = '';
    try {
      musicTempPath = await downloadUrlToTempFile(track.audioUrl, 'music', 'mp3');
      tempFilesToDelete.push(musicTempPath);
    } catch (musicErr) {
      console.warn('⚠️ Não foi possível baixar a trilha sonora, seguindo sem música de fundo:', musicErr);
    }

    // 4. Calcular a duração total do vídeo com base na narração (se existir)
    let totalDuration: number;
    if (narrationTempPath) {
      const narrationDuration = await getMediaDurationSeconds(narrationTempPath);
      totalDuration = narrationDuration > 0
        ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, narrationDuration + NARRATION_TAIL_SECONDS))
        : Math.max(MIN_DURATION, imageTempPaths.length * 5);
    } else {
      totalDuration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, imageTempPaths.length * 5));
    }

    const n = imageTempPaths.length;
    const transitionDuration = n > 1 ? Math.min(1.1, (totalDuration / n) * 0.35) : 0;
    // Duração individual de cada clipe para que, após consumidas as sobreposições do crossfade,
    // a duração final do vídeo bata com totalDuration.
    const clipDuration = n > 1
      ? (totalDuration + (n - 1) * transitionDuration) / n
      : totalDuration;

    // Gera o título e as legendas como PNGs transparentes (via canvas), para sobrepor ao vídeo
    // com o filtro overlay — mais portável que drawtext, que não existe no FFmpeg estático do Linux.
    const titlePngPath = savePngToTempFile(
      renderTitlePng(`Homenagem para ${params.fatherName || 'Meu Pai'}`),
      'title'
    );
    tempFilesToDelete.push(titlePngPath);

    const sentences = splitIntoSentences(params.tributeText);
    const subtitlePngPaths = sentences.map((sentence, idx) => {
      const p = savePngToTempFile(renderSubtitlePng(wrapTextForSubtitle(sentence)), `sub_${idx}`);
      tempFilesToDelete.push(p);
      return p;
    });

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Inputs de imagem (cada uma em loop pela duração do seu clipe)
      imageTempPaths.forEach((imgPath) => {
        command.input(imgPath).inputOptions(['-loop 1', `-t ${clipDuration.toFixed(3)}`]);
      });

      const titleInputIndex = imageTempPaths.length;
      command.input(titlePngPath).inputOptions(['-loop 1', `-t ${totalDuration.toFixed(3)}`]);

      const subtitleInputIndexes = subtitlePngPaths.map((p, idx) => {
        command.input(p).inputOptions(['-loop 1', `-t ${totalDuration.toFixed(3)}`]);
        return imageTempPaths.length + 1 + idx;
      });

      const mediaInputsBase = imageTempPaths.length + 1 + subtitlePngPaths.length;

      let narrationInputIndex = -1;
      if (narrationTempPath) {
        narrationInputIndex = mediaInputsBase;
        command.input(narrationTempPath);
      }

      let musicInputIndex = -1;
      if (musicTempPath) {
        musicInputIndex = mediaInputsBase + (narrationTempPath ? 1 : 0);
        command.input(musicTempPath);
      }

      const filters: string[] = [];

      // --- Vídeo: Ken Burns por foto + crossfade entre elas ---
      for (let i = 0; i < n; i++) {
        filters.push(
          `[${i}:v]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,fps=${FPS},` +
          `zoompan=z='min(zoom+0.0006,1.15)':d=${Math.max(2, Math.round(clipDuration * FPS))}:` +
          `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1080:fps=${FPS},setsar=1[v${i}]`
        );
      }

      let videoLabel = 'v0';
      if (n > 1) {
        let prevLabel = 'v0';
        for (let k = 1; k < n; k++) {
          const offset = k * (clipDuration - transitionDuration);
          const outLabel = k === n - 1 ? 'vxfinal' : `vx${k}`;
          filters.push(
            `[${prevLabel}][v${k}]xfade=transition=fade:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`
          );
          prevLabel = outLabel;
        }
        videoLabel = prevLabel;
      }

      // --- Título fixo com o nome do pai (overlay do PNG gerado via canvas) ---
      filters.push(`[${videoLabel}][${titleInputIndex}:v]overlay=0:0[vtitle]`);
      videoLabel = 'vtitle';

      // --- Legendas, sincronizadas por trecho do texto (overlay dos PNGs gerados via canvas) ---
      if (sentences.length > 0) {
        const perChunk = totalDuration / sentences.length;
        subtitleInputIndexes.forEach((inputIdx, idx) => {
          const start = idx * perChunk;
          const end = (idx + 1) * perChunk;
          const outLabel = `vsub${idx}`;
          filters.push(
            `[${videoLabel}][${inputIdx}:v]overlay=0:0:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'[${outLabel}]`
          );
          videoLabel = outLabel;
        });
      }

      // --- Áudio: narração + trilha sonora mixadas ---
      let audioLabel = '';
      if (narrationInputIndex >= 0 && musicInputIndex >= 0) {
        // apad+atrim garante que a narração preencha toda a duração do vídeo com silêncio,
        // senão o amix (duration=first) e o -shortest cortariam o vídeo no tamanho da narração.
        filters.push(`[${narrationInputIndex}:a]volume=1.0,apad,atrim=0:${totalDuration.toFixed(2)}[an]`);
        filters.push(
          `[${musicInputIndex}:a]aloop=loop=-1:size=2000000000,atrim=0:${totalDuration.toFixed(2)},` +
          `volume=0.18,afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5[am]`
        );
        filters.push(`[an][am]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
        audioLabel = 'aout';
      } else if (narrationInputIndex >= 0) {
        filters.push(`[${narrationInputIndex}:a]volume=1.0,apad,atrim=0:${totalDuration.toFixed(2)}[aout]`);
        audioLabel = 'aout';
      } else if (musicInputIndex >= 0) {
        filters.push(
          `[${musicInputIndex}:a]aloop=loop=-1:size=2000000000,atrim=0:${totalDuration.toFixed(2)},` +
          `volume=0.35,afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5[aout]`
        );
        audioLabel = 'aout';
      }

      const outputLabels = audioLabel ? [videoLabel, audioLabel] : [videoLabel];
      command.complexFilter(filters, outputLabels);

      const outputOptions = [
        '-c:v libx264',
        '-pix_fmt yuv420p',
        `-r ${FPS}`,
        `-t ${totalDuration.toFixed(2)}`,
      ];
      if (audioLabel) {
        outputOptions.push('-c:a aac', '-b:a 192k', '-shortest');
      }

      command
        .outputOptions(outputOptions)
        .output(outputFilePath)
        .on('start', (cmdLine) => {
          console.log('🎬 Comando FFmpeg:', cmdLine);
        })
        .on('end', () => {
          console.log(`✅ Renderização FFmpeg concluída: ${outputFilePath}`);
          tempFilesToDelete.forEach((f) => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
          resolve(publicVideoUrl);
        })
        .on('error', (err) => {
          console.error('❌ Erro na renderização FFmpeg:', err);
          tempFilesToDelete.forEach((f) => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
          reject(err);
        })
        .run();
    });
  } catch (err) {
    tempFilesToDelete.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    console.error('Erro na preparação do FFmpeg:', err);
    throw err;
  }
}
