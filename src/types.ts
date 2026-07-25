export interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  isPaidMember: boolean;
  planName?: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  type: 'photo' | 'audio' | 'video';
  url: string;
  name: string;
  createdAt: string;
  durationSeconds?: number;
}

export interface PhotoItem {
  id: string;
  url: string; // Base64 or ObjectURL
  name: string;
  order: number;
}

export interface PresetVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  tone: string;
  sampleAudioUrl?: string;
  elevenLabsVoiceId: string;
}

export interface PresetTrack {
  id: string;
  title: string;
  category: string;
  audioUrl: string;
  durationSeconds: number;
}

export interface AITextPromptData {
  fatherName: string;
  specialMemory: string;
  adjective: string;
  authorName: string;
  tone: 'emocionante' | 'grato' | 'saudosista' | 'divertido';
}

export interface VideoJob {
  id: string;
  userId: string;
  title: string;
  fatherName: string;
  photos: PhotoItem[];
  tributeText: string;
  selectedVoiceId: string;
  isCustomVoice: boolean;
  customVoiceAudioUrl?: string;
  selectedTrackId: string;
  useAIImages: boolean;
  aiGeneratedImages: { prompt: string; url: string }[];
  status: 'draft' | 'processing' | 'watermarked' | 'unlocked';
  progress: number;
  watermarkVideoUrl?: string;
  unlockedVideoUrl?: string;
  cardUrl: string;
  createdAt: string;
  durationSeconds: number;
}

export interface CreditPackage {
  id: string;
  credits: number;
  priceBRL: number;
  priceFormatted: string;
  popular?: boolean;
  bestValue?: boolean;
  description: string;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  packageId: string;
  amountBRL: number;
  creditsAdded: number;
  status: 'completed' | 'pending';
  createdAt: string;
}
