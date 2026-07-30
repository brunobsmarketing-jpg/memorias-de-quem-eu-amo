import { VideoJob } from '../types';

/**
 * Envia um arquivo em base64 (data URL) para o Supabase Storage e retorna a URL pública.
 * Usado para tirar fotos/áudios do localStorage (que tem cota pequena) e permitir que o
 * cartão digital funcione em qualquer dispositivo, não só no navegador de quem criou.
 */
export async function uploadMediaToStorage(dataUrl: string, folder: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    // Já é uma URL normal (ex: veio de um vídeo já salvo antes) — nada a fazer.
    return dataUrl;
  }
  const response = await fetch('/api/upload-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, folder }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao enviar arquivo para o armazenamento.');
  }
  const data = await response.json();
  return data.url;
}

/** Envia todas as fotos, imagens de IA e áudio de narração de um VideoJob para o Storage,
 * substituindo os data URLs em base64 por URLs públicas permanentes. */
export async function uploadVideoJobMedia(video: VideoJob): Promise<VideoJob> {
  const uploadedPhotos = await Promise.all(
    video.photos.map(async (photo) => ({
      ...photo,
      url: await uploadMediaToStorage(photo.url, `videos/${video.id}/photos`),
    }))
  );

  const uploadedAiImages = await Promise.all(
    (video.aiGeneratedImages || []).map(async (img) => ({
      ...img,
      url: await uploadMediaToStorage(img.url, `videos/${video.id}/ai-images`),
    }))
  );

  const uploadedNarration = video.customVoiceAudioUrl
    ? await uploadMediaToStorage(video.customVoiceAudioUrl, `videos/${video.id}/audio`)
    : video.customVoiceAudioUrl;

  return {
    ...video,
    photos: uploadedPhotos,
    aiGeneratedImages: uploadedAiImages,
    customVoiceAudioUrl: uploadedNarration,
  };
}

/** Salva (cria ou atualiza) o vídeo no banco central, para o cartão digital funcionar em qualquer
 * dispositivo. O servidor identifica o dono pelo sessionToken (nunca por video.userId). */
export async function saveVideoJobRemote(video: VideoJob, sessionToken: string): Promise<void> {
  const response = await fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
    body: JSON.stringify(video),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar vídeo no servidor.');
  }
}

/** Busca um vídeo pelo id no banco central. Retorna null se não existir (nunca lança erro em 404). */
export async function fetchVideoJobRemote(id: string): Promise<VideoJob | null> {
  const response = await fetch(`/api/videos/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Falha ao buscar vídeo no servidor.');
  }
  const data = await response.json();
  return data.video as VideoJob;
}
