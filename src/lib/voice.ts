export interface VoiceRecording {
  audioBlob: Blob;
  audioDataUrl: string;
  durationSeconds: number;
}

/**
 * Sintetiza narração usando ElevenLabs TTS (modelo multilingual v2).
 * Retorna data URL do áudio gerado (audio/mpeg).
 */
export async function synthesizeTTSNarration(text: string, elevenLabsVoiceId: string): Promise<string> {
  try {
    const response = await fetch('/api/generate-narration-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: elevenLabsVoiceId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Falha no serviço de síntese de voz.');
    }

    const data = await response.json();
    return data.audioDataUrl;
  } catch (err) {
    console.warn('Erro no ElevenLabs TTS:', err);
    return '';
  }
}

/**
 * Envia gravação de voz para clonagem no ElevenLabs e sintetiza o texto
 * com a voz clonada. Retorna data URL do áudio final.
 */
export async function cloneVoiceAndSynthesize(
  audioDataUrl: string,
  tributeText: string
): Promise<string> {
  const response = await fetch('/api/clone-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioDataUrl,
      tributeText,
      voiceName: 'Homenagem Dia dos Pais',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha na clonagem de voz.');
  }

  const data = await response.json();
  return data.audioDataUrl;
}

/**
 * Classe para gravação de áudio via microfone do navegador.
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.startTime = Date.now();
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100);
  }

  async stop(): Promise<VoiceRecording> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Gravador não foi iniciado'));
      }

      const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioDataUrl = reader.result as string;
          this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
          resolve({ audioBlob, audioDataUrl, durationSeconds });
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }
}
