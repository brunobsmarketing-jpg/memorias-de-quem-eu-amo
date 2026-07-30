import { VideoJob } from '../types';

/** Salva (cria ou atualiza) uma prévia do funil "crie primeiro, pague depois" — diferente de
 * saveVideoJobRemote, não manda x-session-token (a pessoa ainda não tem conta nenhuma). */
export async function saveTrialVideoRemote(video: VideoJob): Promise<void> {
  const response = await fetch('/api/trial-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(video),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar a prévia no servidor.');
  }
}

/** Captura o e-mail no clique de "Liberar sem marca d'água" e devolve o link de checkout da
 * Payt pro produto de vídeo avulso — o desbloqueio de verdade só acontece depois, quando o
 * webhook da Payt confirmar o pagamento. */
export async function requestTrialVideoUnlock(videoId: string, email: string, name: string): Promise<string> {
  const response = await fetch(`/api/trial-videos/${videoId}/request-unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao solicitar liberação do vídeo.');
  }
  const data = await response.json();
  return data.checkoutUrl as string;
}
