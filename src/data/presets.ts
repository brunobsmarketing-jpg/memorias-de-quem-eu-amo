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


// IMPORTANTE: os áudios ficam hospedados no nosso próprio Supabase Storage (pasta "tracks/"),
// não mais hotlinkados direto do Pixabay — 3 dos 5 links originais do Pixabay expiraram (HTTP 403)
// e quebravam o áudio do vídeo final silenciosamente. Ver PRESET_TRACKS_TODO.md para repor as
// faixas que faltam.
export const PRESET_TRACKS: PresetTrack[] = [
  {
    id: 'track-piano',
    title: 'Piano Suave de Família',
    category: 'Piano Emocionante',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-piano.mp3',
    durationSeconds: 60,
  },
  {
    id: 'track-orchestral',
    title: 'Amor Incondicional (Orquestral)',
    category: 'Orquestral Leve',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-orchestral.mp3',
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
