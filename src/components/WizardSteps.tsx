import React, { useState } from 'react';
import {
  Upload,
  Trash2,
  MoveUp,
  MoveDown,
  Wand2,
  Mic,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  Play,
  Pause,
  Loader2,
  Sparkles,
  Heart,
  Volume2,
} from 'lucide-react';
import { PhotoItem, AITextPromptData, PresetVoice, PresetTrack } from '../types';
import { PRESET_VOICES, PRESET_TRACKS, AI_IMAGE_STYLES } from '../data/presets';
import { generateAITributeText } from '../lib/textgen';
import { extractVisualThemesFromText, generateAIIllustrationImage, VisualTheme } from '../lib/imagegen';
import { VoiceRecorder, synthesizeTTSNarration, cloneVoiceAndSynthesize } from '../lib/voice';
import { resizeImageToDataUrl, MAX_UPLOAD_FILE_SIZE_BYTES, formatFileSizeMB } from '../lib/imageUtils';

// --- STEP 1: Upload de Fotos ---
interface Step1UploadProps {
  photos: PhotoItem[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  aiOnlyMode: boolean;
  setAiOnlyMode: (v: boolean) => void;
  onNext: () => void;
}

export const Step1UploadPhotos: React.FC<Step1UploadProps> = ({ photos, setPhotos, aiOnlyMode, setAiOnlyMode, onNext }) => {
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files: File[] = Array.from(e.target.files);
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois, se precisar

    const oversized = files.filter((f) => f.size > MAX_UPLOAD_FILE_SIZE_BYTES);
    const validFiles = files.filter((f) => f.size <= MAX_UPLOAD_FILE_SIZE_BYTES);

    if (oversized.length > 0) {
      alert(
        `${oversized.length} foto(s) acima de ${formatFileSizeMB(MAX_UPLOAD_FILE_SIZE_BYTES)}MB foram ignoradas: ` +
        oversized.map((f) => `${f.name} (${formatFileSizeMB(f.size)}MB)`).join(', ')
      );
    }

    setIsProcessingPhotos(true);
    try {
      for (let index = 0; index < validFiles.length; index++) {
        const file = validFiles[index];
        try {
          const url = await resizeImageToDataUrl(file);
          setPhotos((prev) => [
            ...prev,
            {
              id: `photo_${Date.now()}_${index}`,
              url,
              name: file.name,
              order: prev.length,
            },
          ]);
        } catch (err) {
          console.error(`Falha ao processar a foto ${file.name}:`, err);
          alert(`Não foi possível processar a foto "${file.name}". Tente outra imagem.`);
        }
      }
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter((p) => p.id !== id));
  };

  const movePhoto = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const updated = [...photos];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // reindex
    updated.forEach((p, i) => (p.order = i));
    setPhotos(updated);
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <Upload className="w-6 h-6 text-amber-400" /> Passo 1: Fotos Marcantes
        </h3>
        <p className="text-slate-400 text-sm">
          Envie de 3 a 8 fotos com seu pai. O slideshow vai exibir cada momento em alta definição com transições suaves.
        </p>
      </div>

      {/* Escolha: tenho fotos vs. quero criar só com ilustrações de IA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        <div
          onClick={() => setAiOnlyMode(false)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
            !aiOnlyMode
              ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <h4 className="font-bold text-slate-100 text-sm">Tenho fotos do meu pai</h4>
          <p className="text-xs text-slate-400 mt-1">Enviar de 3 a 8 fotos reais</p>
        </div>
        <div
          onClick={() => setAiOnlyMode(true)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
            aiOnlyMode
              ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <h4 className="font-bold text-slate-100 text-sm flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Não tenho fotos boas
          </h4>
          <p className="text-xs text-slate-400 mt-1">Criar o vídeo só com ilustrações de IA</p>
        </div>
      </div>

      {aiOnlyMode ? (
        <div className="max-w-xl mx-auto p-5 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-1">
          <p className="text-slate-200 text-sm font-medium">Sem problema! Você vai escolher o estilo e gerar as ilustrações no Passo 5.</p>
          <p className="text-slate-500 text-xs">Não precisa enviar nenhuma foto agora — pode avançar direto.</p>
        </div>
      ) : (
        <>
          {/* Upload Zone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-900/60 transition-colors rounded-2xl p-8 text-center cursor-pointer relative group">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-slate-200 font-medium text-base">Clique ou arraste suas fotos aqui</p>
                <p className="text-slate-500 text-xs mt-1">
                  Formatos suportados: JPG, PNG, WEBP (mínimo 3 fotos, até {formatFileSizeMB(MAX_UPLOAD_FILE_SIZE_BYTES)}MB cada)
                </p>
              </div>
            </div>
          </div>

          {isProcessingPhotos && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Processando fotos...
            </div>
          )}
        </>
      )}

      {/* Photo List */}
      {!aiOnlyMode && photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>{photos.length} foto(s) selecionada(s)</span>
            <span>Reordene conforme desejar</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group shadow-md"
              >
                <img src={photo.url} alt={`Foto ${index + 1}`} className="w-full h-32 object-cover" />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-950/80 text-white text-xs font-bold rounded-md">
                  #{index + 1}
                </div>

                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => movePhoto(index, 'up')}
                    disabled={index === 0}
                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg"
                    title="Mover para esquerda"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => movePhoto(index, 'down')}
                    disabled={index === photos.length - 1}
                    className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg"
                    title="Mover para direita"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-lg"
                    title="Remover foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Step */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!aiOnlyMode && photos.length < 3}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          {aiOnlyMode
            ? 'Próximo Passo: Texto da Homenagem'
            : `Próximo Passo: Texto da Homenagem (${photos.length}/3 fotos)`}
        </button>
      </div>
    </div>
  );
};

// --- STEP 2: Texto da Homenagem ---
interface Step2TextProps {
  tributeText: string;
  setTributeText: (t: string) => void;
  fatherName: string;
  setFatherName: (n: string) => void;
  authorName: string;
  setAuthorName: (n: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2TextTribute: React.FC<Step2TextProps> = ({
  tributeText,
  setTributeText,
  fatherName,
  setFatherName,
  authorName,
  setAuthorName,
  onNext,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'free' | 'ai'>('ai');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI Prompt Form fields
  const [specialMemory, setSpecialMemory] = useState('');
  const [adjective, setAdjective] = useState('');
  const [tone, setTone] = useState<'emocionante' | 'grato' | 'saudosista' | 'divertido'>('emocionante');

  const handleGenerateAI = async () => {
    if (!fatherName) {
      alert('Por favor, informe o nome do seu pai.');
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateAITributeText({
        fatherName,
        authorName,
        specialMemory,
        adjective,
        tone,
      });
      setTributeText(generated);
    } catch (err: any) {
      alert('Não foi possível gerar o texto via IA: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <Heart className="w-6 h-6 text-ember-400 fill-ember-500/20" /> Passo 2: Mensagem do Coração
        </h3>
        <p className="text-slate-400 text-sm">
          Escreva seu próprio texto de carinho ou use nosso assistente de IA para criar uma homenagem poética inesquecível.
        </p>
      </div>

      {/* Basic Info Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nome do Pai *</label>
          <input
            type="text"
            value={fatherName}
            onChange={(e) => setFatherName(e.target.value)}
            placeholder="Ex: Roberto, Pai Zé, Papai..."
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Seu Nome (Filho/Filha)</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Ex: Lucas, Camila..."
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Tabs Option */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ai' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-4 h-4" /> Gerar com IA
        </button>
        <button
          onClick={() => setActiveTab('free')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'free' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Escrever Texto Livre
        </button>
      </div>

      {/* Tab AI Assistant */}
      {activeTab === 'ai' && (
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Uma lembrança ou momento especial
              </label>
              <input
                type="text"
                value={specialMemory}
                onChange={(e) => setSpecialMemory(e.target.value)}
                placeholder="Ex: Me ensinar a andar de bicicleta, as pescarias de domingo..."
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Um adjetivo ou qualidade marcante
              </label>
              <input
                type="text"
                value={adjective}
                onChange={(e) => setAdjective(e.target.value)}
                placeholder="Ex: Guerreiro, bem-humorado, protetor, meu porto seguro..."
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tom de Voz da Homenagem</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'emocionante', label: '❤️ Emocionante' },
                { id: 'grato', label: '🙏 Gratidão' },
                { id: 'saudosista', label: '🌅 Nostálgico' },
                { id: 'divertido', label: '😊 Alegre' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    tone === t.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Escrevendo com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Criar Homenagem Emocionante com IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Tribute Textarea Output / Edit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">Texto da Narração Final (pode editar à vontade)</label>
          <span className="text-xs font-mono text-slate-500">{tributeText.length} / 400 caracteres</span>
        </div>
        <textarea
          rows={5}
          value={tributeText}
          onChange={(e) => setTributeText(e.target.value)}
          placeholder="Ex: Pai, em cada passo do meu caminho, vejo as marcas do seu amor e da sua dedicação. Obrigado por ser meu exemplo diário..."
          className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 leading-relaxed shadow-inner"
        />
      </div>

      {(!fatherName || !tributeText.trim()) && (
        <p className="text-xs text-amber-400/90 text-center -mt-2">
          {!fatherName && !tributeText.trim()
            ? 'Preencha o nome do pai e escreva (ou gere com IA) o texto da homenagem para continuar.'
            : !fatherName
            ? 'Preencha o nome do pai para continuar.'
            : 'Escreva seu texto ou clique em "Criar Homenagem Emocionante com IA" para continuar.'}
        </p>
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!fatherName || !tributeText.trim()}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          Próximo Passo: Escolher Narração
        </button>
      </div>
    </div>
  );
};

// --- STEP 3: Narração & Clonagem de Voz ---
interface Step3VoiceProps {
  selectedVoiceId: string;
  setSelectedVoiceId: (id: string) => void;
  isCustomVoice: boolean;
  setIsCustomVoice: (v: boolean) => void;
  customVoiceAudioUrl: string;
  setCustomVoiceAudioUrl: (url: string) => void;
  skipNarration: boolean;
  setSkipNarration: (v: boolean) => void;
  tributeText: string;
  onNext: () => void;
  onBack: () => void;
}

export const Step3NarrationVoice: React.FC<Step3VoiceProps> = ({
  selectedVoiceId,
  setSelectedVoiceId,
  isCustomVoice,
  setIsCustomVoice,
  customVoiceAudioUrl,
  setCustomVoiceAudioUrl,
  skipNarration,
  setSkipNarration,
  tributeText,
  onNext,
  onBack,
}) => {
  const [recorder] = useState(() => new VoiceRecorder());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string>('');

  const handleStartRecord = async () => {
    try {
      await recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      const timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      (window as any)._recTimer = timer;
    } catch (e) {
      alert('Erro ao acessar o microfone. Verifique as permissões do seu navegador.');
    }
  };

  const handleStopRecord = async () => {
    clearInterval((window as any)._recTimer);
    setIsRecording(false);
    try {
      const rec = await recorder.stop();
      setCustomVoiceAudioUrl(rec.audioDataUrl);
      setIsCustomVoice(true);
    } catch (e) {
      alert('Erro ao salvar gravação de áudio.');
    }
  };

  const handlePreviewTTS = async (elevenLabsVoiceId: string) => {
    setIsGeneratingTTS(true);
    try {
      const url = await synthesizeTTSNarration(tributeText, elevenLabsVoiceId);
      setPreviewAudioUrl(url);
      setCustomVoiceAudioUrl(url);
    } catch (e) {
      alert('Erro ao gerar prévia da narração.');
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handleCloneVoice = async () => {
    if (!customVoiceAudioUrl) return;
    setIsCloningVoice(true);
    try {
      const clonedAudio = await cloneVoiceAndSynthesize(customVoiceAudioUrl, tributeText);
      setCustomVoiceAudioUrl(clonedAudio);
      setPreviewAudioUrl(clonedAudio);
    } catch (e: any) {
      alert('Erro na clonagem de voz: ' + e.message);
    } finally {
      setIsCloningVoice(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <Mic className="w-6 h-6 text-amber-400" /> Passo 3: Voz e Narração
        </h3>
        <p className="text-slate-400 text-sm">
          Escolha uma voz profissional de nosso estúdio ou grave a sua própria voz para emocionar seu pai com suas palavras.
        </p>
      </div>

      {/* Voice Mode Choice */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => {
            setSkipNarration(false);
            setIsCustomVoice(false);
          }}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            !skipNarration && !isCustomVoice
              ? 'bg-amber-500/10 border-amber-500 shadow-lg ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Vozes Profissionais</h4>
              <p className="text-xs text-slate-400 mt-0.5">Narradores de estúdio em tom emotivo</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            setSkipNarration(false);
            setIsCustomVoice(true);
          }}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            !skipNarration && isCustomVoice
              ? 'bg-amber-500/10 border-amber-500 shadow-lg ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/20 text-rose-300 rounded-xl">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Grave com sua Própria Voz</h4>
              <p className="text-xs text-slate-400 mt-0.5">Sua voz autêntica narrando a mensagem</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => {
            setSkipNarration(true);
            setCustomVoiceAudioUrl('');
          }}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            skipNarration
              ? 'bg-amber-500/10 border-amber-500 shadow-lg ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-700/50 text-slate-300 rounded-xl">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Sem Narração Falada</h4>
              <p className="text-xs text-slate-400 mt-0.5">Só música de fundo e legendas</p>
            </div>
          </div>
        </div>
      </div>

      {skipNarration && (
        <div className="max-w-xl mx-auto p-5 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-1">
          <p className="text-slate-200 text-sm font-medium">Combinado! O vídeo vai ter só a música de fundo e as legendas com o seu texto.</p>
        </div>
      )}

      {/* Mode A: Preset Voices */}
      {!skipNarration && !isCustomVoice && (
        <div className="space-y-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Selecione uma voz do banco
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_VOICES.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  setSelectedVoiceId(v.id);
                  handlePreviewTTS(v.elevenLabsVoiceId);
                }}
                className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                  selectedVoiceId === v.id
                    ? 'bg-amber-500/20 border-amber-500 text-slate-100'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div>
                  <h5 className="font-bold text-sm text-slate-100">{v.name}</h5>
                  <p className="text-xs text-slate-400">{v.tone}</p>
                </div>
                {selectedVoiceId === v.id && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </div>
            ))}
          </div>

          {isGeneratingTTS && (
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Gerando narração em alta qualidade...
            </div>
          )}

          {!isGeneratingTTS && previewAudioUrl && (
            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Ouça a narração com o seu texto (a mesma que vai no vídeo):
              </p>
              <audio key={previewAudioUrl} src={previewAudioUrl} controls className="w-full h-10 rounded-lg" />
            </div>
          )}
        </div>
      )}

      {/* Mode B: Voice Recorder */}
      {!skipNarration && isCustomVoice && (
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 text-center space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <p className="text-slate-300 text-sm">
              Leia o texto da mensagem em voz alta com calma. Grave entre 15 e 40 segundos para melhor resultado.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            {!isRecording ? (
              <button
                onClick={handleStartRecord}
                className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-xl transition-transform active:scale-95"
              >
                <Mic className="w-9 h-9" />
              </button>
            ) : (
              <button
                onClick={handleStopRecord}
                className="w-20 h-20 rounded-full bg-amber-500 animate-pulse text-black flex flex-col items-center justify-center shadow-xl font-bold"
              >
                <SquareIcon className="w-7 h-7" />
              </button>
            )}

            <div className="text-sm font-mono font-bold text-slate-200">
              {isRecording ? `Gravando: ${recordingSeconds}s` : customVoiceAudioUrl ? 'Gravação concluída!' : 'Clique para iniciar'}
            </div>
          </div>

          {customVoiceAudioUrl && !isCloningVoice && (
            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 max-w-md mx-auto space-y-3">
              <p className="text-xs text-slate-400 font-medium">Sua gravação de áudio:</p>
              <audio src={customVoiceAudioUrl} controls className="w-full h-10 rounded-lg" />
              <button
                onClick={handleCloneVoice}
                className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Clonar minha voz com IA e narrar o texto
              </button>
              <p className="text-[10px] text-slate-500 text-center">
                A IA vai copiar sua voz e narrar a mensagem completa da homenagem
              </p>
            </div>
          )}

          {isCloningVoice && (
            <div className="p-5 bg-rose-500/10 rounded-xl border border-rose-500/30 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-rose-400 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-200">Clonando sua voz com IA...</p>
              <p className="text-xs text-slate-500">Isso pode levar 20 a 40 segundos</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          Próximo Passo: Trilha Sonora
        </button>
      </div>
    </div>
  );
};

const SquareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

// --- STEP 4: Melodia de Fundo ---
interface Step4MusicProps {
  selectedTrackId: string;
  setSelectedTrackId: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4MusicTrack: React.FC<Step4MusicProps> = ({
  selectedTrackId,
  setSelectedTrackId,
  onNext,
  onBack,
}) => {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const toggleTrackPlay = (track: PresetTrack) => {
    if (playingTrackId === track.id && audioObj) {
      audioObj.pause();
      setPlayingTrackId(null);
    } else {
      if (audioObj) audioObj.pause();
      const newAudio = new Audio(track.audioUrl);
      newAudio.volume = 0.5;
      newAudio.play().catch(() => {});
      setAudioObj(newAudio);
      setPlayingTrackId(track.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <Music className="w-6 h-6 text-amber-400" /> Passo 4: Melodia Instrumental
        </h3>
        <p className="text-slate-400 text-sm">
          Escolha a música de fundo perfeita que acompanhará a narração e as imagens.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PRESET_TRACKS.map((track) => (
          <div
            key={track.id}
            onClick={() => setSelectedTrackId(track.id)}
            className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
              selectedTrackId === track.id
                ? 'bg-amber-500/20 border-amber-500 shadow-lg'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTrackPlay(track);
                }}
                className="p-3 bg-amber-500 text-black font-bold rounded-full hover:scale-105 transition-transform"
              >
                {playingTrackId === track.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <h5 className="font-bold text-sm text-slate-100">{track.title}</h5>
                <p className="text-xs text-slate-400">{track.category}</p>
              </div>
            </div>

            {selectedTrackId === track.id && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          Próximo Passo: Imagens Ilustrativas IA
        </button>
      </div>
    </div>
  );
};

// --- STEP 5: Imagens Ilustrativas IA ---
interface Step5AIImagesProps {
  useAIImages: boolean;
  setUseAIImages: (u: boolean) => void;
  aiImages: { prompt: string; url: string }[];
  setAiImages: React.Dispatch<React.SetStateAction<{ prompt: string; url: string }[]>>;
  tributeText: string;
  fatherName: string;
  aiOnlyMode: boolean;
  selectedImageStyle: string;
  setSelectedImageStyle: (id: string) => void;
  memoryAge: string;
  setMemoryAge: (id: string) => void;
  narratorGender: string;
  setNarratorGender: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const MEMORY_AGE_OPTIONS = [
  { id: 'auto', label: 'IA decide', emoji: '✨' },
  { id: 'child', label: 'Criança', emoji: '🧒' },
  { id: 'teen', label: 'Adolescente', emoji: '🧑' },
  { id: 'adult', label: 'Adulto(a)', emoji: '🧑‍🦱' },
];

const NARRATOR_GENDER_OPTIONS = [
  { id: 'auto', label: 'IA decide', emoji: '✨' },
  { id: 'female', label: 'Filha', emoji: '👧' },
  { id: 'male', label: 'Filho', emoji: '👦' },
];

export const Step5AIImagesOption: React.FC<Step5AIImagesProps> = ({
  useAIImages,
  setUseAIImages,
  aiImages,
  setAiImages,
  tributeText,
  fatherName,
  aiOnlyMode,
  selectedImageStyle,
  setSelectedImageStyle,
  memoryAge,
  setMemoryAge,
  narratorGender,
  setNarratorGender,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const imageCount = aiOnlyMode ? 5 : 2;

  const handleGenerateAIImages = async () => {
    setIsGenerating(true);
    setUseAIImages(true);
    setGeneratingProgress(0);
    try {
      const themes = await extractVisualThemesFromText(tributeText, fatherName, imageCount, memoryAge, narratorGender);
      setGeneratingProgress(1); // temas extraídos

      const generatedList = await Promise.all(
        themes.map(async (t) => {
          const url = await generateAIIllustrationImage(t.titlePt, t.promptEn, selectedImageStyle);
          setGeneratingProgress((prev) => prev + 1);
          return { prompt: t.titlePt, url };
        })
      );
      setAiImages(generatedList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
      setGeneratingProgress(0);
    }
  };

  const canProceed = aiOnlyMode ? aiImages.length >= 3 && !isGenerating : !isGenerating;

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <ImageIcon className="w-6 h-6 text-amber-400" /> Passo 5: {aiOnlyMode ? 'Ilustrações com IA' : 'Complemento Artístico IA'}
        </h3>
        <p className="text-slate-400 text-sm">
          {aiOnlyMode
            ? 'Escolha o estilo artístico e a IA vai criar as ilustrações que formarão o seu vídeo.'
            : 'Deseja complementar o vídeo intercalando fotos reais com ilustrações conceituais geradas por IA?'}
        </p>
      </div>

      {/* Style Picker */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
          Estilo da Ilustração
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {AI_IMAGE_STYLES.map((style) => (
            <div
              key={style.id}
              onClick={() => setSelectedImageStyle(style.id)}
              className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                selectedImageStyle === style.id
                  ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-xl">{style.emoji}</div>
              <h5 className="font-bold text-slate-100 text-[11px] mt-1">{style.label}</h5>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight hidden sm:block">{style.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contexto da Cena — de quem é a lembrança, pra silhueta ao lado do pai combinar
          com a história real em vez de uma criança genérica */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
            Quem está homenageando
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {NARRATOR_GENDER_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setNarratorGender(opt.id)}
                className={`p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                  narratorGender === opt.id
                    ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-lg">{opt.emoji}</div>
                <p className="text-[11px] font-bold text-slate-100 mt-0.5">{opt.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
            Fase da lembrança
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {MEMORY_AGE_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setMemoryAge(opt.id)}
                className={`p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                  memoryAge === opt.id
                    ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-lg">{opt.emoji}</div>
                <p className="text-[10px] font-bold text-slate-100 mt-0.5 leading-tight">{opt.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${aiOnlyMode ? '' : 'sm:grid-cols-2'} gap-4`}>
        {/* NO Option — escondida no modo só-IA, já que fotos reais não existem */}
        {!aiOnlyMode && (
          <div
            onClick={() => {
              setUseAIImages(false);
              setAiImages([]);
            }}
            className={`p-6 rounded-2xl border cursor-pointer transition-all ${
              !useAIImages
                ? 'bg-amber-500/10 border-amber-500 shadow-lg ring-1 ring-amber-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <h4 className="font-bold text-slate-100 text-base mb-1">NÃO, usar apenas fotos reais</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              O slideshow exibirá exclusivamente as fotos reais que você enviou.
            </p>
          </div>
        )}

        {/* YES Option */}
        <div
          onClick={handleGenerateAIImages}
          className={`p-6 rounded-2xl border cursor-pointer transition-all ${
            useAIImages
              ? 'bg-amber-500/10 border-amber-500 shadow-lg ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-slate-100 text-base">
              {aiOnlyMode ? 'Gerar Ilustrações com IA' : 'SIM, gerar ilustrações com IA'}
            </h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            A IA analisará seu texto e criará {imageCount} artes no estilo escolhido{aiOnlyMode ? ' para formar o seu vídeo' : ' para enriquecer a experiência visual'}.
          </p>
        </div>
      </div>

      {isGenerating && (
        <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">
              {generatingProgress === 0
                ? '🔍 Analisando o texto da homenagem...'
                : generatingProgress === 1
                ? '🎨 Nossa IA está pintando as ilustrações em aquarela...'
                : `✅ Ilustração ${generatingProgress - 1} gerada! Finalizando...`}
            </p>
            <p className="text-xs text-slate-500">
              Geração de imagem real por IA — pode levar alguns segundos
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2].map((step) => (
              <div
                key={step}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  generatingProgress > step ? 'bg-amber-400 scale-110' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}


      {useAIImages && aiImages.length > 0 && !isGenerating && (
        <div className="space-y-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Ilustrações geradas para o vídeo
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aiImages.map((img, i) => (
              <div key={i} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 p-3 space-y-2">
                <img src={img.url} alt={img.prompt} className="w-full h-40 object-cover rounded-lg" />
                <p className="text-xs text-slate-300 font-medium text-center">"{img.prompt}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl border border-slate-700"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={isSubmitting || !canProceed}
          title={aiOnlyMode && aiImages.length < 3 ? 'Gere pelo menos 3 ilustrações para continuar' : undefined}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Gerar Vídeo e Prévia
            </>
          )}
        </button>
      </div>
    </div>
  );
};
