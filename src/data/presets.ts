import { PresetVoice, PresetTrack, CreditPackage } from '../types';

export const PRESET_VOICES: PresetVoice[] = [
  {
    id: 'voice-1',
    name: 'Carlos — Voz Calma e Afetuosa',
    gender: 'male',
    tone: 'Emocionante e acolhedora',
    elevenLabsVoiceId: 'TxGEqnHWrfWFTfGW9XjX', // Josh
  },
  {
    id: 'voice-2',
    name: 'Helena — Voz Suave e Expressiva',
    gender: 'female',
    tone: 'Doce e carinhosa',
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
  },
  {
    id: 'voice-3',
    name: 'Gabriel — Voz Grave e Profunda',
    gender: 'male',
    tone: 'Nostálgica e marcante',
    elevenLabsVoiceId: 'VR6AewLTigWG4xSOukaG', // Arnold
  },
  {
    id: 'voice-4',
    name: 'Mariana — Voz Serena e Calorosa',
    gender: 'female',
    tone: 'Sincera e emocionante',
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
  },
];


export const PRESET_TRACKS: PresetTrack[] = [
  {
    id: 'track-piano',
    title: 'Piano Suave de Família',
    category: 'Piano Emocionante',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=emotional-piano-112691.mp3',
    durationSeconds: 60,
  },
  {
    id: 'track-acoustic',
    title: 'Violão Acolhedor de Tarde',
    category: 'Acústico Nostálgico',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c823058f.mp3?filename=acoustic-guitars-ambient-10700.mp3',
    durationSeconds: 60,
  },
  {
    id: 'track-orchestral',
    title: 'Amor Incondicional (Orquestral)',
    category: 'Orquestral Leve',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=inspiring-emotional-piano-10103.mp3',
    durationSeconds: 60,
  },
  {
    id: 'track-serene',
    title: 'Lembranças Especiais',
    category: 'Inspiração Serena',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2023/04/10/audio_515902bfbf.mp3?filename=emotional-inspiring-piano-145455.mp3',
    durationSeconds: 60,
  },
  {
    id: 'track-father',
    title: 'Exemplo de Vida (Sinfonia Suave)',
    category: 'Cinematográfico Emocional',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939fd9e06.mp3?filename=hopeful-emotional-piano-124923.mp3',
    durationSeconds: 60,
  },
];

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'pkg-1',
    credits: 1,
    priceBRL: 19.90,
    priceFormatted: 'R$ 19,90',
    description: '1 Vídeo HD Sem Marca d\'Água + Cartão Digital + QR Code',
  },
  {
    id: 'pkg-3',
    credits: 3,
    priceBRL: 39.90,
    priceFormatted: 'R$ 39,90',
    popular: true,
    description: '3 Vídeos HD (Apenas R$ 13,30 por vídeo) + Cartões Digitais',
  },
  {
    id: 'pkg-5',
    credits: 5,
    priceBRL: 54.90,
    priceFormatted: 'R$ 54,90',
    bestValue: true,
    description: '5 Vídeos HD (Apenas R$ 10,98 por vídeo) — Ideal para dar aos pais, avôs e tios',
  },
];
