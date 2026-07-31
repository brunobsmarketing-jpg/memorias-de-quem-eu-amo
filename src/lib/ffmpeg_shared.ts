import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Helpers de FFmpeg reaproveitados tanto pelo render do slideshow (ffmpeg_render.ts) quanto
 * pelo render do Livro de Memórias (ffmpeg_book_render.ts) — arquivos temporários, leitura de
 * duração de mídia, escape de caminho para o filtergraph e mixagem de áudio (narração + trilha).
 */

export function saveBase64ToTempFile(dataUrl: string, prefix: string, ext: string): string {
  const tempDir = path.join(process.cwd(), 'public', 'renders', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
  const filePath = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
}

export async function downloadUrlToTempFile(url: string, prefix: string, ext: string): Promise<string> {
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

export function writeTempTextFile(content: string, prefix: string): string {
  const tempDir = path.join(process.cwd(), 'public', 'renders', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Usa o próprio binário do FFmpeg (sem depender de ffprobe) para ler a duração real de um
 * arquivo de áudio — decodificando o arquivo inteiro (via "-f null -") em vez de confiar só no
 * cabeçalho impresso por "ffmpeg -i" sem decodificar nada. O cabeçalho é uma ESTIMATIVA (calculada
 * a partir do bitrate ou de um índice VBR do próprio arquivo) e pode vir errada — principalmente
 * em MP3s gerados por APIs de TTS (como a ElevenLabs) que nem sempre incluem um índice VBR preciso
 * — o que já foi suspeito de causar a narração e a legenda saindo dessincronizadas do vídeo do
 * Livro de Memórias (cada página ficando na tela por bem mais tempo que devia, e o vídeo
 * continuando bem depois da narração real já ter acabado). Decodificar o áudio inteiro é mais
 * lento que só ler o cabeçalho, mas a duração real da narração (no máximo ~90s) é rápida de
 * decodificar, e o resultado é sempre exato, nunca uma estimativa.
 */
export function getMediaDurationSeconds(ffmpegPath: string | null, filePath: string): Promise<number> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(0);
    const proc = spawn(ffmpegPath, ['-i', filePath, '-vn', '-f', 'null', '-']);
    let stderrOutput = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });
    proc.on('close', () => {
      // Depois de decodificar tudo, a ÚLTIMA linha de progresso ("time=HH:MM:SS.ms") reflete
      // exatamente até onde o áudio foi decodificado com sucesso — a duração real, não uma
      // estimativa. Se por algum motivo nenhuma linha de progresso aparecer (arquivo vazio/
      // corrompido), cai pro "Duration:" do cabeçalho como último recurso.
      const progressMatches = [...stderrOutput.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
      const lastProgress = progressMatches[progressMatches.length - 1];
      if (lastProgress) {
        const hours = parseInt(lastProgress[1], 10);
        const minutes = parseInt(lastProgress[2], 10);
        const seconds = parseFloat(lastProgress[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
        return;
      }
      const headerMatch = stderrOutput.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (headerMatch) {
        const hours = parseInt(headerMatch[1], 10);
        const minutes = parseInt(headerMatch[2], 10);
        const seconds = parseFloat(headerMatch[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
      } else {
        resolve(0);
      }
    });
    proc.on('error', () => resolve(0));
  });
}

/**
 * Caminho normalizado e entre aspas simples, pronto para uso como valor de opção no filtergraph do FFmpeg.
 * O ':' do drive letter do Windows (ex: C:/...) precisa ser escapado mesmo dentro de aspas simples,
 * senão o parser de filtros do FFmpeg o interpreta como separador de opção.
 */
export function quoteFilterPath(p: string): string {
  const forwardSlashes = p.replace(/\\/g, '/');
  const escapedColon = forwardSlashes.replace(/:/g, '\\:');
  return `'${escapedColon}'`;
}

export interface AudioMixInputs {
  narrationInputIndex: number; // -1 se não houver narração
  musicInputIndex: number; // -1 se não houver trilha
  totalDuration: number;
  narrationVolume?: number;
  /** Volume da trilha quando ela toca sozinha (sem narração) — sozinha pode ficar mais alta. */
  musicOnlyVolume?: number;
  /** Volume da trilha quando mixada com narração — mais baixa para não competir com a voz. */
  musicWithNarrationVolume?: number;
}

export interface AudioMixResult {
  filters: string[];
  audioLabel: string; // '' se não houver nenhuma faixa de áudio
}

/**
 * Monta os filtros de mixagem de narração + trilha sonora (apad/atrim para a narração preencher
 * a duração toda, loop + fade-out pra trilha, amix quando as duas existem). Extraído do render
 * do slideshow original para ser reaproveitado pelo render do Livro de Memórias.
 */
export function buildAudioMixFilters({
  narrationInputIndex,
  musicInputIndex,
  totalDuration,
  narrationVolume = 1.0,
  musicOnlyVolume = 0.35,
  musicWithNarrationVolume = 0.18,
}: AudioMixInputs): AudioMixResult {
  const filters: string[] = [];
  let audioLabel = '';

  if (narrationInputIndex >= 0 && musicInputIndex >= 0) {
    filters.push(`[${narrationInputIndex}:a]volume=${narrationVolume},apad,atrim=0:${totalDuration.toFixed(2)}[an]`);
    filters.push(
      `[${musicInputIndex}:a]aloop=loop=-1:size=2000000000,atrim=0:${totalDuration.toFixed(2)},` +
      `volume=${musicWithNarrationVolume},afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5[am]`
    );
    // normalize=0 é essencial aqui: por padrão o amix RENORMALIZA os volumes ao somar as faixas
    // (pra evitar clipping), o que na prática anula boa parte da diferença de volume que acabamos
    // de configurar acima (narração bem mais alta que a trilha) — mesmo com volume=1.0 na
    // narração e volume=0.18 na trilha, sem "normalize=0" o resultado final saía com a trilha
    // quase tão alta quanto a narração (bug real relatado: música "abafando" a voz).
    filters.push(`[an][am]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`);
    audioLabel = 'aout';
  } else if (narrationInputIndex >= 0) {
    filters.push(`[${narrationInputIndex}:a]volume=${narrationVolume},apad,atrim=0:${totalDuration.toFixed(2)}[aout]`);
    audioLabel = 'aout';
  } else if (musicInputIndex >= 0) {
    filters.push(
      `[${musicInputIndex}:a]aloop=loop=-1:size=2000000000,atrim=0:${totalDuration.toFixed(2)},` +
      `volume=${musicOnlyVolume},afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5[aout]`
    );
    audioLabel = 'aout';
  }

  return { filters, audioLabel };
}
