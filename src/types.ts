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

export interface AIImageStyle {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface CaptionFontOption {
  id: string;
  label: string;
  previewFontFamily: string; // usada na prévia em canvas (fonte já carregada via Google Fonts)
  ttfFileName: string; // arquivo dentro de assets/fonts/ usado pelo FFmpeg (drawtext) no vídeo final
}

export interface CaptionColorOption {
  id: string;
  label: string;
  hex: string;
}

export interface CaptionBackgroundOption {
  id: string;
  label: string;
  description: string;
}

export interface CaptionStyle {
  fontId: string;
  colorId: string;
  backgroundId: string;
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
  captionStyle?: CaptionStyle;
  status: 'draft' | 'processing' | 'watermarked' | 'unlocked';
  progress: number;
  watermarkVideoUrl?: string;
  unlockedVideoUrl?: string;
  cardUrl: string;
  createdAt: string;
  durationSeconds: number;
}

export type BookSlotShape = 'rect' | 'polaroid' | 'circle' | 'filmstrip';

export interface PageTemplateSlot {
  id: string;
  x: number; // fração 0-1 da largura do canvas
  y: number; // fração 0-1 da altura do canvas
  width: number; // fração 0-1
  height: number; // fração 0-1
  rotationDeg?: number;
  shape?: BookSlotShape;
}

export interface PageTemplateTextBlock {
  id: string;
  x: number; // fração 0-1
  y: number; // fração 0-1
  width: number; // fração 0-1
  label: string; // rótulo mostrado ao usuário no editor (ex: "Título")
  defaultText: string;
  maxChars: number;
  fontSizePx: number;
  fontWeight?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  colorHex?: string;
}

export interface PageTemplateDef {
  id: string;
  name: string;
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  decoration?: 'filmstrip';
  slots: PageTemplateSlot[];
  textBlocks: PageTemplateTextBlock[];
}

export interface MemoryBookPageSlotValue {
  slotId: string;
  photoUrl: string;
}

export interface MemoryBookPageTextValue {
  blockId: string;
  text: string;
}

export interface MemoryBookPage {
  id: string;
  templateId: string;
  order: number;
  slotValues: MemoryBookPageSlotValue[];
  textValues: MemoryBookPageTextValue[];
  renderedImageUrl?: string; // PNG exportado da página, gerado no navegador antes do envio ao servidor
}

export interface MemoryBookJob {
  id: string;
  userId: string;
  fatherName: string;
  photos: PhotoItem[];
  pages: MemoryBookPage[];
  selectedTrackId: string;
  selectedVoiceId: string;
  isCustomVoice: boolean;
  customVoiceAudioUrl?: string;
  narrationText: string;
  status: 'draft' | 'processing' | 'unlocked';
  progress: number;
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
