import { User, VideoJob, MediaAsset } from '../types';

const USER_STORAGE_KEY = 'memorias_user_data';
const VIDEOS_STORAGE_KEY = 'memorias_videos_data';
const MEDIA_STORAGE_KEY = 'memorias_media_assets';

export function getStoredUser(): User | null {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function saveStoredUser(user: User): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error(e);
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
}

export function getStoredVideos(): VideoJob[] {
  try {
    const data = localStorage.getItem(VIDEOS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function saveVideoJob(video: VideoJob): VideoJob[] {
  const current = getStoredVideos();
  const index = current.findIndex((v) => v.id === video.id);
  let updated: VideoJob[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = video;
  } else {
    updated = [video, ...current];
  }

  // O Supabase já é a fonte da verdade — o localStorage aqui é só um cache rápido para a
  // galeria local. Se a cota estourar (comum quando há vídeos antigos com fotos em base64
  // sobrando de antes desta correção), tentamos progressivamente manter menos vídeos em vez
  // de travar o fluxo do usuário.
  const attempts = [updated, updated.slice(0, 5), [video]];
  for (const attempt of attempts) {
    try {
      localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(attempt));
      return updated;
    } catch (e) {
      console.warn('Não foi possível salvar vídeos no localStorage (cota excedida?), tentando reduzir:', e);
    }
  }
  return updated;
}

export function getVideoJobById(id: string): VideoJob | undefined {
  const videos = getStoredVideos();
  return videos.find((v) => v.id === id);
}

export function getStoredMediaAssets(): MediaAsset[] {
  try {
    const data = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function saveMediaAsset(asset: MediaAsset): MediaAsset[] {
  const current = getStoredMediaAssets();
  const updated = [asset, ...current];
  localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteMediaAsset(id: string): MediaAsset[] {
  const current = getStoredMediaAssets();
  const updated = current.filter((m) => m.id !== id);
  localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
