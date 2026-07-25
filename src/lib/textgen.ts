import { AITextPromptData } from '../types';

export async function generateAITributeText(data: AITextPromptData): Promise<string> {
  const response = await fetch('/api/generate-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao comunicar com o servidor de IA');
  }

  const result = await response.json();
  return result.text;
}
