/**
 * Rascunho local dos wizards (vídeo/livro) — protege contra perder o progresso se a aba
 * fechar, travar ou o navegador reiniciar no meio do preenchimento. As fotos em base64 podem
 * ser grandes o bastante pra estourar a cota do localStorage (mesmo risco documentado em
 * credits.ts), então salvar e carregar nunca lançam erro pra fora: pior caso, o rascunho
 * simplesmente não é salvo/recuperado, sem travar o resto do wizard.
 */
export function saveDraft<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Não foi possível salvar o rascunho (${key}):`, e);
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn(`Não foi possível carregar o rascunho (${key}):`, e);
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Não foi possível limpar o rascunho (${key}):`, e);
  }
}
