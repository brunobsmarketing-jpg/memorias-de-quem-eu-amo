import ffmpeg from 'fluent-ffmpeg';
import ffmpegStaticPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { PRESET_TRACKS } from '../data/presets';
import { BOOK_PAGE_WIDTH, BOOK_PAGE_HEIGHT } from '../data/bookTemplates';
import {
  saveBase64ToTempFile,
  downloadUrlToTempFile,
  getMediaDurationSeconds,
  buildAudioMixFilters,
} from './ffmpeg_shared';

// Mesmo binário usado pelo render do slideshow (ver ffmpeg_render.ts) — aqui não precisamos do
// build customizado com drawtext, já que todo o texto de cada página já vem "queimado" no PNG
// composto no navegador (ver src/lib/bookRenderer.ts).
const customFfmpegPath = path.join(process.cwd(), 'ffmpeg-bin', 'bin', 'ffmpeg');
const ffmpegPath = fs.existsSync(customFfmpegPath) ? customFfmpegPath : ffmpegStaticPath;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface RenderMemoryBookParams {
  bookId: string;
  pageImageUrls: string[]; // PNG (data URL ou URL do Storage) de cada página, já na ordem final
  narrationAudioDataUrl?: string;
  selectedTrackId?: string;
  aspectRatio?: 'classic' | 'vertical';
}

// No formato vertical, a página em si continua desenhada no seu tamanho normal 4:5 (os
// templates em bookTemplates.ts têm coordenadas fracionárias pensadas pra essa proporção —
// esticar pra 9:16 distorceria fotos/textos) — em vez disso, ela é centralizada com barras
// pretas (letterbox) dentro de um quadro 9:16, como uma "página flutuando" num vídeo vertical.
const VERTICAL_OUTPUT_HEIGHT = 1920;

const FPS = 24;
const MIN_DURATION = 15;
// Piso bem menor que MIN_DURATION, usado só quando existe narração real — ver comentário
// no cálculo de totalDuration abaixo sobre por que não usar MIN_DURATION nesse caso.
const NARRATION_MIN_DURATION = 6;
const MAX_DURATION = 90;
const SECONDS_PER_PAGE = 5;
const NARRATION_TAIL_SECONDS = 2.5;
// Duração da transição de "virar página" entre um slide e o próximo.
const TRANSITION_DURATION = 0.8;
// Zoom máximo do efeito Ken Burns sobre cada página parada.
const MAX_ZOOM = 1.12;

/**
 * Renderiza o Livro de Memórias em MP4: cada página (já composta como PNG no navegador) vira
 * um slide com um leve zoom contínuo (Ken Burns) e as páginas são encadeadas com uma transição
 * de deslize (efeito "virando página"), depois narração + trilha sonora são mixadas por cima —
 * reaproveitando os mesmos helpers usados no render do slideshow original.
 */
export async function renderMemoryBookWithFFmpeg(params: RenderMemoryBookParams): Promise<string> {
  const publicRendersDir = path.join(process.cwd(), 'public', 'renders');
  if (!fs.existsSync(publicRendersDir)) {
    fs.mkdirSync(publicRendersDir, { recursive: true });
  }

  const outputFileName = `book_${params.bookId}.mp4`;
  const outputFilePath = path.join(publicRendersDir, outputFileName);
  const publicVideoUrl = `/renders/${outputFileName}`;

  if (fs.existsSync(outputFilePath)) {
    return publicVideoUrl;
  }

  if (!params.pageImageUrls || params.pageImageUrls.length === 0) {
    throw new Error('Nenhuma página disponível para renderizar o vídeo do livro.');
  }

  const tempFilesToDelete: string[] = [];

  try {
    const pageTempPaths: string[] = params.pageImageUrls.map((url, i) => {
      if (url.startsWith('data:image')) {
        const p = saveBase64ToTempFile(url, `page_${i}`, 'png');
        tempFilesToDelete.push(p);
        return p;
      }
      return url;
    });

    // Narração e trilha sonora baixadas em PARALELO (eram sequenciais à toa) — tira alguns
    // segundos do tempo total até o vídeo do livro ficar pronto.
    const track = PRESET_TRACKS.find((t) => t.id === params.selectedTrackId) || PRESET_TRACKS[0];

    const narrationPromise: Promise<string> = params.narrationAudioDataUrl?.startsWith('data:audio')
      ? Promise.resolve(saveBase64ToTempFile(params.narrationAudioDataUrl, 'narration', 'mp3'))
      : params.narrationAudioDataUrl?.startsWith('http')
        ? downloadUrlToTempFile(params.narrationAudioDataUrl, 'narration', 'mp3').catch((narrationErr) => {
            console.warn('⚠️ Não foi possível baixar a narração, seguindo sem ela:', narrationErr);
            return '';
          })
        : Promise.resolve('');

    const musicPromise: Promise<string> = downloadUrlToTempFile(track.audioUrl, 'music', 'mp3').catch((musicErr) => {
      console.warn('⚠️ Não foi possível baixar a trilha sonora, seguindo sem música de fundo:', musicErr);
      return '';
    });

    const [narrationTempPath, musicTempPath] = await Promise.all([narrationPromise, musicPromise]);
    if (narrationTempPath) tempFilesToDelete.push(narrationTempPath);
    if (musicTempPath) tempFilesToDelete.push(musicTempPath);

    const n = pageTempPaths.length;

    // IMPORTANTE: quando há narração real, a duração segue o tamanho DELA (+ silêncio de
    // cauda), sem aplicar o piso mínimo (MIN_DURATION) por cima — aplicar o piso aqui fazia o
    // vídeo continuar passando páginas além do fim da narração real, e como o áudio já tinha
    // acabado (apad só preenche silêncio, não repete a fala), o restante ficava mudo.
    let totalDuration: number;
    if (narrationTempPath) {
      const narrationDuration = await getMediaDurationSeconds(ffmpegPath as string | null, narrationTempPath);
      totalDuration = narrationDuration > 0
        ? Math.min(MAX_DURATION, Math.max(NARRATION_MIN_DURATION, narrationDuration + NARRATION_TAIL_SECONDS))
        : Math.max(MIN_DURATION, n * SECONDS_PER_PAGE);
    } else {
      totalDuration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, n * SECONDS_PER_PAGE));
    }

    // Cada página fica visível pelo mesmo tempo; a transição consome uma fatia desse tempo do
    // fim de uma página e do início da próxima, então não pode ser maior que a própria página.
    const pageDuration = totalDuration / n;
    const transitionDuration = Math.min(TRANSITION_DURATION, pageDuration * 0.3);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Importante: aqui NÃO limitamos a entrada com "-t pageDuration" como no slideshow simples
      // (ffmpeg_render.ts) — como cada página passa pelo zoompan (Ken Burns) logo abaixo, um
      // "-t" na entrada faz o ffmpeg pré-gerar ~framesPerPage cópias do frame estático, e o
      // zoompan então gera framesPerPage frames de SAÍDA pra cada uma delas — multiplicando a
      // duração real de cada página muito além do pretendido. Isso desalinha os offsets do
      // xfade calculados a partir de pageDuration, fazendo a página 0 "engolir" o vídeo inteiro
      // e as demais páginas some/repetirem fora de ordem no resultado final. O zoompan já define
      // a duração exata da página sozinho via d=framesPerPage e fps=FPS, então a entrada só
      // precisa ficar em loop infinito de um único frame.
      pageTempPaths.forEach((imgPath) => {
        command.input(imgPath).inputOptions(['-loop 1']);
      });

      let narrationInputIndex = -1;
      if (narrationTempPath) {
        narrationInputIndex = pageTempPaths.length;
        command.input(narrationTempPath);
      }

      let musicInputIndex = -1;
      if (musicTempPath) {
        musicInputIndex = pageTempPaths.length + (narrationTempPath ? 1 : 0);
        command.input(musicTempPath);
      }

      const filters: string[] = [];
      const framesPerPage = Math.max(1, Math.round(pageDuration * FPS));

      // No formato vertical, a página (sempre composta em 4:5) fica centralizada com barras
      // pretas até completar um quadro 9:16 — ver comentário de VERTICAL_OUTPUT_HEIGHT acima.
      const isVertical = params.aspectRatio === 'vertical';
      const padFilter = isVertical
        ? `,pad=${BOOK_PAGE_WIDTH}:${VERTICAL_OUTPUT_HEIGHT}:0:${Math.round((VERTICAL_OUTPUT_HEIGHT - BOOK_PAGE_HEIGHT) / 2)}:color=black`
        : '';

      // --- Vídeo: cada página com um leve zoom contínuo (Ken Burns) ---
      for (let i = 0; i < n; i++) {
        filters.push(
          `[${i}:v]scale=${BOOK_PAGE_WIDTH}:${BOOK_PAGE_HEIGHT},` +
          `zoompan=z='min(zoom+0.0008,${MAX_ZOOM})':d=${framesPerPage}:s=${BOOK_PAGE_WIDTH}x${BOOK_PAGE_HEIGHT}:fps=${FPS}${padFilter},setsar=1[vz${i}]`
        );
      }

      // --- Encadeia as páginas com uma transição de deslize, simulando "virar a página" ---
      let videoLabel = 'vz0';
      let cumulativeDuration = 0;
      for (let i = 1; i < n; i++) {
        cumulativeDuration += pageDuration;
        const offset = cumulativeDuration - i * transitionDuration;
        const outLabel = `vx${i}`;
        filters.push(
          `[${videoLabel}][vz${i}]xfade=transition=slideleft:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`
        );
        videoLabel = outLabel;
      }

      // --- Áudio: narração + trilha sonora mixadas (mesma lógica do slideshow original) ---
      const totalRenderedDuration = n > 1 ? totalDuration - (n - 1) * transitionDuration : totalDuration;
      const audioMix = buildAudioMixFilters({
        narrationInputIndex,
        musicInputIndex,
        totalDuration: totalRenderedDuration,
      });
      filters.push(...audioMix.filters);
      const audioLabel = audioMix.audioLabel;

      const outputLabels = audioLabel ? [videoLabel, audioLabel] : [videoLabel];
      command.complexFilter(filters, outputLabels);

      const outputOptions = [
        '-c:v libx264',
        '-preset superfast', // mais rápido que "veryfast" — arquivo um pouco maior, imperceptível num vídeo curto
        '-threads 1',
        '-pix_fmt yuv420p',
        `-r ${FPS}`,
        `-t ${totalRenderedDuration.toFixed(2)}`,
      ];
      if (audioLabel) {
        outputOptions.push('-c:a aac', '-b:a 192k', '-shortest');
      }

      command
        .outputOptions(outputOptions)
        .output(outputFilePath)
        .on('start', (cmdLine) => {
          console.log('🎬 Comando FFmpeg (livro):', cmdLine);
        })
        .on('end', () => {
          console.log(`✅ Renderização do livro concluída: ${outputFilePath}`);
          tempFilesToDelete.forEach((f) => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
          resolve(publicVideoUrl);
        })
        .on('error', (err) => {
          console.error('❌ Erro na renderização do livro:', err);
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
    console.error('Erro na preparação do FFmpeg (livro):', err);
    throw err;
  }
}
