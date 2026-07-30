import ffmpeg from 'fluent-ffmpeg';
import ffmpegStaticPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { PRESET_TRACKS, CAPTION_FONTS, CAPTION_COLORS } from '../data/presets';
import { CaptionStyle } from '../types';
import {
  saveBase64ToTempFile,
  downloadUrlToTempFile,
  writeTempTextFile,
  getMediaDurationSeconds as getMediaDurationSecondsShared,
  quoteFilterPath,
  buildAudioMixFilters,
} from './ffmpeg_shared';

// O binário do pacote ffmpeg-static no Linux (usado em produção) não inclui o filtro
// drawtext. O build de produção baixa um binário completo (com drawtext) para
// "ffmpeg-bin/bin/ffmpeg" (ver render.yaml); se existir, usamos ele. Localmente
// (Windows/Mac) essa pasta não existe, então caímos no ffmpeg-static normal, que já
// inclui drawtext.
const customFfmpegPath = path.join(process.cwd(), 'ffmpeg-bin', 'bin', 'ffmpeg');
const ffmpegPath = fs.existsSync(customFfmpegPath) ? customFfmpegPath : ffmpegStaticPath;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface RenderVideoParams {
  videoId: string;
  fatherName: string;
  photos: Array<string | { url: string }>; // data URLs, file paths, ou objetos PhotoItem do front-end
  aiImages?: { prompt: string; url: string }[];
  useAIImages?: boolean;
  tributeText: string;
  narrationAudioDataUrl?: string;
  selectedTrackId?: string;
  captionStyle?: CaptionStyle;
  aspectRatio?: 'classic' | 'vertical';
  // Quando true, renderiza a prévia do funil "crie primeiro, pague depois" (ver
  // buildWatermarkGridFilters abaixo) — vídeo real, mas coberto o suficiente pra não dar pra usar
  // sem pagar. Nunca usado junto com dedução de crédito (esse job nunca teve dono pago ainda).
  watermark?: boolean;
}

const WATERMARK_TEXT = 'PRÉVIA — MEMORA.COM.BR';

/**
 * Cobre o frame inteiro com o mesmo texto repetido em grade (estilo banco de imagens) — o
 * drawtext do FFmpeg não suporta rotação de texto nativamente (só dá pra girar renderizando uma
 * imagem à parte), então a grade fica na horizontal mesmo; ainda assim quebra o suficiente pra
 * impedir uso direto do vídeo. O tamanho da célula é fixo em pixels e o número de colunas/linhas
 * é calculado a partir da largura/altura reais de saída, então funciona igual nos dois formatos
 * (clássico 1080x1080 e vertical 1080x1920) sem precisar de grade hardcoded por formato.
 */
function buildWatermarkGridFilters(
  videoLabel: string,
  outputWidth: number,
  outputHeight: number,
  tempFilesToDelete: string[]
): { filters: string[]; videoLabel: string } {
  const CELL_WIDTH = 380;
  const CELL_HEIGHT = 230;
  const cols = Math.ceil(outputWidth / CELL_WIDTH);
  const rows = Math.ceil(outputHeight / CELL_HEIGHT);

  const watermarkTextPath = writeTempTextFile(WATERMARK_TEXT, 'watermark');
  tempFilesToDelete.push(watermarkTextPath);

  const filters: string[] = [];
  let label = videoLabel;
  let cellIndex = 0;
  for (let row = 0; row < rows; row++) {
    // Desloca linhas alternadas em meia célula (padrão "tijolo") — evita que a grade pareça um
    // reticulado perfeitamente alinhado, o que facilitaria recortar entre as marcas.
    const rowOffsetX = row % 2 === 0 ? 0 : CELL_WIDTH / 2;
    for (let col = 0; col < cols; col++) {
      const x = col * CELL_WIDTH + rowOffsetX;
      const y = row * CELL_HEIGHT;
      const outLabel = `vwm${cellIndex}`;
      filters.push(
        `[${label}]drawtext=textfile=${quoteFilterPath(watermarkTextPath)}:fontfile=${quoteFilterPath(TITLE_FONT_PATH)}:` +
        `fontsize=26:fontcolor=white@0.45:borderw=2:bordercolor=black@0.35:x=${x}:y=${y}[${outLabel}]`
      );
      label = outLabel;
      cellIndex++;
    }
  }

  return { filters, videoLabel: label };
}

// 'classic' (1080x1080) é o formato quadrado histórico do produto; 'vertical' (1080x1920, 9:16)
// é o novo formato alternativo pensado para Stories/Reels/WhatsApp Status — mesma prévia em
// canvas usa esses mesmos números (ver CANVAS_DIMENSIONS em VideoPlayer.tsx).
const OUTPUT_DIMENSIONS: Record<'classic' | 'vertical', { width: number; height: number }> = {
  classic: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
};

// 24fps é suficiente para slides estáticos (sem zoom contínuo) e reduz o trabalho de codificação.
const FPS = 24;
const MIN_DURATION = 20;
// Piso bem menor que MIN_DURATION, usado só quando existe narração real — ver comentário
// no cálculo de totalDuration abaixo sobre por que não usar MIN_DURATION nesse caso.
const NARRATION_MIN_DURATION = 6;
const MAX_DURATION = 75;
const NARRATION_TAIL_SECONDS = 1.5;
// Fontes empacotadas no próprio projeto (assets/fonts) em vez de um caminho do sistema operacional —
// um caminho como "C:/Windows/Fonts/arial.ttf" não existiria no Linux do servidor de produção.
// O título fixo do vídeo sempre usa a fonte padrão (Poppins); a legenda usa a tipografia
// escolhida pelo usuário (ver resolveCaptionStyle).
// IMPORTANTE: caminho RELATIVO (não process.cwd() + absoluto) de propósito — no Windows, um
// caminho absoluto tem ":" no drive letter (ex: "C:/Users/..."), que precisa ser escapado pro
// parser de filtros do FFmpeg não quebrar (ver quoteFilterPath); mas esse escape faz o parâmetro
// "fontfile" falhar silenciosamente ao abrir a fonte de verdade e cair numa fonte padrão do
// sistema. Caminho relativo nunca tem esse ":", então nunca precisa do escape — resolve certo
// tanto no FFmpeg local (Windows) quanto em produção (Linux), já que o processo do FFmpeg roda
// com o mesmo diretório de trabalho do servidor Node (a raiz do projeto).
const TITLE_FONT_PATH = path.join('assets', 'fonts', 'Poppins-Bold.ttf');

function hexToFFmpegColor(hex: string): string {
  return `0x${hex.replace('#', '')}`;
}

function resolveCaptionStyle(captionStyle?: CaptionStyle) {
  const fontOption = CAPTION_FONTS.find((f) => f.id === captionStyle?.fontId) || CAPTION_FONTS[0];
  const colorOption = CAPTION_COLORS.find((c) => c.id === captionStyle?.colorId) || CAPTION_COLORS[0];
  const backgroundId = captionStyle?.backgroundId || 'dark';

  return {
    fontPath: path.join('assets', 'fonts', fontOption.ttfFileName),
    fontColor: hexToFFmpegColor(colorOption.hex),
    backgroundId,
  };
}

function getMediaDurationSeconds(filePath: string): Promise<number> {
  return getMediaDurationSecondsShared(ffmpegPath as string | null, filePath);
}

function splitIntoSentences(text: string): string[] {
  const cleaned = (text || '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Quebra um texto em linhas curtas para caber na legenda queimada no vídeo. */
function wrapTextForSubtitle(text: string, maxCharsPerLine = 28, maxLines = 3): string {
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
    return [...head, tail].join('\n');
  }
  return lines.join('\n');
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

  // Sufixo diferente pra versão com marca d'água — sem isso, renderizar a prévia (watermark)
  // e depois a versão limpa do MESMO videoId (após o desbloqueio) acharia o arquivo da prévia
  // já em disco e devolveria ele de novo, sem nunca gerar a versão sem marca d'água de verdade.
  const outputFileName = `render_${params.videoId}${params.watermark ? '_wm' : ''}.mp4`;
  const outputFilePath = path.join(publicRendersDir, outputFileName);
  const publicVideoUrl = `/renders/${outputFileName}`;

  if (fs.existsSync(outputFilePath)) {
    return publicVideoUrl;
  }

  // O front-end manda video.photos como objetos PhotoItem ({id, url, name, order}), não strings —
  // normaliza aqui para aceitar tanto strings quanto objetos com .url.
  const allImageUrls: string[] = params.photos.map((p: any) => (typeof p === 'string' ? p : p.url));
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

    // 2. Salvar narração em arquivo temporário, se houver — pode chegar como data URL (base64,
    // caso acabou de ser gerada) ou como URL https do Supabase Storage (caso o vídeo já tenha
    // sido sincronizado antes do download, quando o data URL é substituído por uma URL permanente).
    let narrationTempPath = '';
    if (params.narrationAudioDataUrl?.startsWith('data:audio')) {
      narrationTempPath = saveBase64ToTempFile(params.narrationAudioDataUrl, 'narration', 'mp3');
      tempFilesToDelete.push(narrationTempPath);
    } else if (params.narrationAudioDataUrl?.startsWith('http')) {
      try {
        narrationTempPath = await downloadUrlToTempFile(params.narrationAudioDataUrl, 'narration', 'mp3');
        tempFilesToDelete.push(narrationTempPath);
      } catch (narrationErr) {
        console.warn('⚠️ Não foi possível baixar a narração, seguindo sem ela:', narrationErr);
      }
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
    // IMPORTANTE: quando há narração real, a duração do vídeo segue o tamanho DELA (+ o
    // silêncio de cauda), sem aplicar o piso mínimo (MIN_DURATION) por cima — aplicar o piso
    // aqui fazia o vídeo continuar tocando fotos além do fim da narração real, e como o áudio
    // já tinha acabado, o restante ficava mudo (apad só preenche silêncio, não repete a fala).
    // Um piso bem menor (NARRATION_MIN_DURATION) só evita um vídeo degenerado quase instantâneo
    // se a narração vier anormalmente curta.
    let totalDuration: number;
    if (narrationTempPath) {
      const narrationDuration = await getMediaDurationSeconds(narrationTempPath);
      totalDuration = narrationDuration > 0
        ? Math.min(MAX_DURATION, Math.max(NARRATION_MIN_DURATION, narrationDuration + NARRATION_TAIL_SECONDS))
        : Math.max(MIN_DURATION, imageTempPaths.length * 5);
    } else {
      totalDuration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, imageTempPaths.length * 5));
    }

    const { width: outputWidth, height: outputHeight } = OUTPUT_DIMENSIONS[params.aspectRatio === 'vertical' ? 'vertical' : 'classic'];

    const n = imageTempPaths.length;
    // Slide estático (sem Ken Burns/crossfade) — cada foto dura o mesmo tempo, sem sobreposição.
    const clipDuration = totalDuration / n;
    // Fade para preto na entrada/saída de cada slide — mais leve que crossfade (não precisa
    // manter duas fotos "vivas" na memória ao mesmo tempo, só corta com fade cada uma por vez).
    const fadeDuration = Math.min(0.5, clipDuration * 0.2);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Inputs de imagem (cada uma em loop pela duração do seu clipe)
      imageTempPaths.forEach((imgPath) => {
        command.input(imgPath).inputOptions(['-loop 1', `-t ${clipDuration.toFixed(3)}`]);
      });

      let narrationInputIndex = -1;
      if (narrationTempPath) {
        narrationInputIndex = imageTempPaths.length;
        command.input(narrationTempPath);
      }

      let musicInputIndex = -1;
      if (musicTempPath) {
        musicInputIndex = imageTempPaths.length + (narrationTempPath ? 1 : 0);
        command.input(musicTempPath);
      }

      const filters: string[] = [];

      // --- Vídeo: slide estático por foto, com fade para preto na entrada/saída ---
      for (let i = 0; i < n; i++) {
        const fadeOutStart = Math.max(0, clipDuration - fadeDuration);
        filters.push(
          `[${i}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},fps=${FPS},` +
          `fade=t=in:st=0:d=${fadeDuration.toFixed(3)},fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)},setsar=1[v${i}]`
        );
      }

      let videoLabel = 'v0';
      if (n > 1) {
        const concatInputs = Array.from({ length: n }, (_, i) => `[v${i}]`).join('');
        filters.push(`${concatInputs}concat=n=${n}:v=1:a=0[vconcat]`);
        videoLabel = 'vconcat';
      }

      // --- Título fixo com o nome do pai ---
      const titleTextPath = writeTempTextFile(`Homenagem para ${params.fatherName || 'Meu Pai'}`, 'title');
      tempFilesToDelete.push(titleTextPath);
      filters.push(
        `[${videoLabel}]drawtext=textfile=${quoteFilterPath(titleTextPath)}:fontfile=${quoteFilterPath(TITLE_FONT_PATH)}:` +
        `fontsize=46:fontcolor=white:borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=70[vtitle]`
      );
      videoLabel = 'vtitle';

      // --- Legendas queimadas, sincronizadas por trecho do texto, com a tipografia/cor/fundo
      // escolhidos pelo usuário no wizard ---
      const caption = resolveCaptionStyle(params.captionStyle);
      const captionBoxParams =
        caption.backgroundId === 'none'
          ? 'borderw=3:bordercolor=black@0.7'
          : caption.backgroundId === 'light'
          ? 'box=1:boxcolor=white@0.75:boxborderw=24'
          : 'box=1:boxcolor=black@0.55:boxborderw=24';

      const sentences = splitIntoSentences(params.tributeText);
      if (sentences.length > 0) {
        // Frases mais longas levam mais tempo pra serem faladas que frases curtas — dividir a
        // duração em partes IGUAIS por número de frases (como era antes) ignora isso e desalinha
        // a legenda da narração real ao longo do vídeo. Aproxima o tempo de fala de cada frase
        // pela proporção de caracteres dela sobre o texto inteiro, que acompanha bem melhor o
        // ritmo real da fala do que uma divisão por contagem de frases.
        const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
        let cursor = 0;
        sentences.forEach((sentence, idx) => {
          const chunkDuration = (sentence.length / totalChars) * totalDuration;
          const start = cursor;
          const end = cursor + chunkDuration;
          cursor = end;
          const wrapped = wrapTextForSubtitle(sentence);
          const subPath = writeTempTextFile(wrapped, `sub_${idx}`);
          tempFilesToDelete.push(subPath);
          const outLabel = `vsub${idx}`;
          filters.push(
            `[${videoLabel}]drawtext=textfile=${quoteFilterPath(subPath)}:fontfile=${quoteFilterPath(caption.fontPath)}:` +
            `fontsize=42:fontcolor=${caption.fontColor}:line_spacing=8:${captionBoxParams}:` +
            `x=(w-text_w)/2:y=h-300:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'[${outLabel}]`
          );
          videoLabel = outLabel;
        });
      }

      // --- Marca d'água (só na prévia do funil "crie primeiro, pague depois") ---
      if (params.watermark) {
        const watermarkResult = buildWatermarkGridFilters(videoLabel, outputWidth, outputHeight, tempFilesToDelete);
        filters.push(...watermarkResult.filters);
        videoLabel = watermarkResult.videoLabel;
      }

      // --- Áudio: narração + trilha sonora mixadas ---
      // apad+atrim garante que a narração preencha toda a duração do vídeo com silêncio,
      // senão o amix (duration=first) e o -shortest cortariam o vídeo no tamanho da narração.
      const audioMix = buildAudioMixFilters({ narrationInputIndex, musicInputIndex, totalDuration });
      filters.push(...audioMix.filters);
      const audioLabel = audioMix.audioLabel;

      const outputLabels = audioLabel ? [videoLabel, audioLabel] : [videoLabel];
      command.complexFilter(filters, outputLabels);

      const outputOptions = [
        '-c:v libx264',
        '-preset veryfast', // menos memória/CPU no encoder (troca um pouco de eficiência de compressão por leveza)
        '-threads 1', // evita overhead de múltiplas threads em ambientes com pouca CPU/RAM (ex: Render free tier)
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
