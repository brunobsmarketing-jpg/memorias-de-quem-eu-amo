export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB por foto
export const MAX_IMAGE_DIMENSION = 1600; // px no lado maior — o vídeo final é 1080x1080, não precisa de mais

/** Carrega uma imagem via URL/data URL, marcando crossOrigin para não "sujar" canvases (evita
 * SecurityError em toDataURL/toBlob quando a imagem vem de outra origem, ex: Supabase Storage). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

/** Desenha uma imagem cobrindo um retângulo arbitrário do canvas (igual ao CSS background-size: cover). */
export function drawImageCoverRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let renderW = width;
  let renderH = height;
  if (imgAspect > targetAspect) {
    renderW = height * imgAspect;
  } else {
    renderH = width / imgAspect;
  }
  const offsetX = x + (width - renderW) / 2;
  const offsetY = y + (height - renderH) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  ctx.restore();
}

/** Quebra um texto em linhas que cabem em maxWidth, usando a fonte já configurada no ctx. */
export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(testLine).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function formatFileSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Lê um arquivo de imagem e devolve uma data URL já redimensionada (lado maior até
 * MAX_IMAGE_DIMENSION) e recomprimida em JPEG — evita fotos gigantes do celular (4000x3000+)
 * deixarem o upload lento ou pesarem demais na memória do navegador/servidor à toa, já que
 * o vídeo final é renderizado em 1080x1080.
 */
export async function resizeImageToDataUrl(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
  quality = 0.85
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    image.src = dataUrl;
  });

  const { width, height } = img;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  if (scale >= 1) {
    // Já está dentro do tamanho ideal, não precisa recomprimir (evita perda de qualidade à toa)
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
