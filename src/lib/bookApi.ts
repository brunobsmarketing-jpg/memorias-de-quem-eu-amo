import { MemoryBookJob } from '../types';
import { uploadMediaToStorage } from './videoApi';

/** Envia as fotos da biblioteca, os PNGs de cada página composta e o áudio de narração de um
 * MemoryBookJob para o Storage (mesmo bucket do produto de vídeo, ver /api/upload-media),
 * substituindo os data URLs em base64 por URLs públicas. */
export async function uploadMemoryBookMedia(book: MemoryBookJob): Promise<MemoryBookJob> {
  const uploadedPhotos = await Promise.all(
    book.photos.map(async (photo) => ({
      ...photo,
      url: await uploadMediaToStorage(photo.url, `books/${book.id}/photos`),
    }))
  );

  const uploadedPages = await Promise.all(
    book.pages.map(async (page) => ({
      ...page,
      renderedImageUrl: page.renderedImageUrl
        ? await uploadMediaToStorage(page.renderedImageUrl, `books/${book.id}/pages`)
        : page.renderedImageUrl,
    }))
  );

  const uploadedNarration = book.customVoiceAudioUrl
    ? await uploadMediaToStorage(book.customVoiceAudioUrl, `books/${book.id}/audio`)
    : book.customVoiceAudioUrl;

  return {
    ...book,
    photos: uploadedPhotos,
    pages: uploadedPages,
    customVoiceAudioUrl: uploadedNarration,
  };
}

/** Salva (cria ou atualiza) o livro no banco, para o cartão digital público funcionar em qualquer
 * dispositivo. O servidor identifica o dono pelo sessionToken (nunca por book.userId). */
export async function saveMemoryBookRemote(book: MemoryBookJob, sessionToken: string): Promise<void> {
  const response = await fetch('/api/memory-books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
    body: JSON.stringify(book),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar o livro no servidor.');
  }
}

/** Busca um livro pelo id. Retorna null se não existir (nunca lança erro em 404). */
export async function fetchMemoryBookRemote(id: string): Promise<MemoryBookJob | null> {
  const response = await fetch(`/api/memory-books/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Falha ao buscar o livro no servidor.');
  }
  const data = await response.json();
  return data.book as MemoryBookJob;
}
