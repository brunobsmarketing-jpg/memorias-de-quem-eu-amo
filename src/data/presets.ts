import { PresetVoice, PresetTrack, CreditPackage, AIImageStyle } from '../types';

export const AI_IMAGE_STYLES: AIImageStyle[] = [
  {
    id: 'watercolor',
    label: 'Aquarela Suave',
    emoji: '🎨',
    description: 'Pintura em aquarela delicada, tons pastéis quentes',
  },
  {
    id: 'realistic',
    label: 'Realista Cinematográfico',
    emoji: '🎬',
    description: 'Estilo fotográfico, iluminação suave e cinematográfica',
  },
  {
    id: 'oil-painting',
    label: 'Pintura a Óleo Clássica',
    emoji: '🖼️',
    description: 'Pinceladas ricas, paleta clássica e atemporal',
  },
  {
    id: 'flat-minimal',
    label: 'Minimalista Moderno',
    emoji: '✨',
    description: 'Formas planas e limpas, visual moderno e simples',
  },
  {
    id: 'sketch-bw',
    label: 'Esboço Nostálgico P&B',
    emoji: '✏️',
    description: 'Desenho a lápis, tons de preto e branco/sépia',
  },
];

// Vozes com sotaque brasileiro (melhor pra narrar português do que as vozes em inglês
// americano usadas antes) — IDs reais da nossa conta ElevenLabs, confirmados via API.
export const PRESET_VOICES: PresetVoice[] = [
  {
    id: 'voice-1',
    name: 'Arthur — Voz Calorosa e Confiante',
    gender: 'male',
    tone: 'Acolhedora e profissional',
    elevenLabsVoiceId: '5lrBPYY4YvMbKHTo8kvZ', // Arthur Freeman
  },
  {
    id: 'voice-2',
    name: 'Katiuscia — Voz Doce e Gentil',
    gender: 'female',
    tone: 'Suave e carinhosa',
    elevenLabsVoiceId: 'wXwzHFLHnXex5h3JPBXA', // Katiuscia
  },
  {
    id: 'voice-3',
    name: 'Keren — Voz Vibrante e Encantadora',
    gender: 'female',
    tone: 'Doce e envolvente',
    elevenLabsVoiceId: '33B4UnXyTNbgLmdEDh5P', // Keren
  },
  {
    id: 'voice-4',
    name: 'Fernanda — Voz Natural e Acolhedora',
    gender: 'female',
    tone: 'Conversacional e sincera',
    elevenLabsVoiceId: 'KHmfNHtEjHhLK9eER20w', // Fernanda (Natural Conversations)
  },
  {
    id: 'voice-5',
    name: 'Malu — Voz Descontraída e Espontânea',
    gender: 'female',
    tone: 'Leve e natural',
    elevenLabsVoiceId: 'fhtZMBwha5du5OxuvexO', // Malu
  },
  {
    id: 'voice-6',
    name: 'Regi — Voz Serena e Envolvente',
    gender: 'female',
    tone: 'Calma e próxima',
    elevenLabsVoiceId: 'QHXbC1UI61ujIZ9SUNGc', // Regi Piroli
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
