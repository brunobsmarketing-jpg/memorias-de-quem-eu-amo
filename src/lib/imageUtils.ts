export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB por foto
export const MAX_IMAGE_DIMENSION = 1600; // px no lado maior — o vídeo final é 1080x1080, não precisa de mais

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
