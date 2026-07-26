import { PresetVoice, PresetTrack, CreditPackage, AIImageStyle, CaptionFontOption, CaptionColorOption, CaptionBackgroundOption } from '../types';

// Tipografias disponíveis para a legenda queimada no vídeo final. "ttfFileName" aponta pra um
// arquivo em assets/fonts/ (usado pelo FFmpeg via drawtext); "previewFontFamily" é a mesma fonte
// carregada via Google Fonts (ver index.html) pra prévia em canvas bater com o vídeo final.
export const CAPTION_FONTS: CaptionFontOption[] = [
  { id: 'poppins', label: 'Moderna', previewFontFamily: 'Poppins', ttfFileName: 'Poppins-Bold.ttf' },
  { id: 'fraunces', label: 'Elegante', previewFontFamily: 'Fraunces', ttfFileName: 'Fraunces-Variable.ttf' },
  { id: 'playfair', label: 'Clássica', previewFontFamily: 'Playfair Display', ttfFileName: 'PlayfairDisplay-Variable.ttf' },
  { id: 'caveat', label: 'Manuscrita', previewFontFamily: 'Caveat', ttfFileName: 'Caveat-Variable.ttf' },
  { id: 'bebas', label: 'Impacto', previewFontFamily: 'Bebas Neue', ttfFileName: 'BebasNeue-Regular.ttf' },
];

export const CAPTION_COLORS: CaptionColorOption[] = [
  { id: 'white', label: 'Branco', hex: '#FFFFFF' },
  { id: 'cream', label: 'Marfim', hex: '#FDF6E3' },
  { id: 'amber', label: 'Dourado', hex: '#FBBF24' },
  { id: 'ember', label: 'Terracota', hex: '#C1666B' },
  { id: 'black', label: 'Preto', hex: '#0F172A' },
];

export const CAPTION_BACKGROUNDS: CaptionBackgroundOption[] = [
  { id: 'none', label: 'Sem Fundo', description: 'Só o texto, com contorno para legibilidade' },
  { id: 'dark', label: 'Fundo Escuro', description: 'Caixa escura semitransparente (padrão)' },
  { id: 'light', label: 'Fundo Claro', description: 'Caixa clara semitransparente' },
];

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
// não mais hotlinkados direto do Pixabay/terceiros. Faixas com licença CC-BY 4.0, compostas por
// Kevin MacLeod (incompetech.com) — créditos exibidos no rodapé do app (ver Footer em App.tsx).
export const PRESET_TRACKS: PresetTrack[] = [
  {
    id: 'track-emotiva',
    title: 'Promessas do Coração',
    category: 'Emotiva',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-emotiva.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-inspiracional',
    title: 'Esperança Eterna',
    category: 'Inspiracional',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-inspiracional.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-alegre',
    title: 'Momentos que Aquecem o Coração',
    category: 'Alegre',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-alegre.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-motivacional',
    title: 'Força de Vontade',
    category: 'Motivacional',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-motivacional.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-romantica',
    title: 'Existe Romance',
    category: 'Romântica e Terna',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-romantica.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-calma',
    title: 'Novo Despertar',
    category: 'Calma e Serena',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-calma.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-epica',
    title: 'Tributo Grandioso',
    category: 'Épica e Cinematográfica',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-epica.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-classica',
    title: 'Cânone Clássico',
    category: 'Clássica Atemporal',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-classica.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-nostalgica',
    title: 'Lembranças Reflexivas',
    category: 'Nostálgica',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-nostalgica.mp3',
    durationSeconds: 65,
  },
  {
    id: 'track-sonhadora',
    title: 'Sonhos de Família',
    category: 'Sonhadora e Acolhedora',
    audioUrl: 'https://jshdugdrqneuikrlwrum.supabase.co/storage/v1/object/public/media/tracks/track-sonhadora.mp3',
    durationSeconds: 65,
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
