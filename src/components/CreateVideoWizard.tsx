import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Sparkles, ArrowLeft, CheckCircle2, Loader2, X } from 'lucide-react';
import { PhotoItem, VideoJob, User, CaptionStyle, AspectRatioOption } from '../types';
import {
  Step1UploadPhotos,
  Step2TextTribute,
  Step3NarrationVoice,
  Step4MusicTrack,
  Step5AIImagesOption,
} from './WizardSteps';
import { VideoPlayer } from './VideoPlayer';
import { saveVideoJob } from '../lib/credits';
import { uploadVideoJobMedia, saveVideoJobRemote } from '../lib/videoApi';
import { deductCreditRemote } from '../lib/authApi';
import { PRESET_VOICES, PRESET_TRACKS } from '../data/presets';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftPersistence';

interface CreateVideoWizardProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  onFinish: (video: VideoJob) => void;
  onCancel: () => void;
}

const DRAFT_KEY = 'memorias_video_wizard_draft';

interface VideoWizardDraft {
  currentStep: number;
  photos: PhotoItem[];
  aiOnlyMode: boolean;
  fatherName: string;
  authorName: string;
  tributeText: string;
  selectedVoiceId: string;
  isCustomVoice: boolean;
  customVoiceAudioUrl: string;
  skipNarration: boolean;
  selectedTrackId: string;
  useAIImages: boolean;
  aiImages: { prompt: string; url: string }[];
  selectedImageStyle: string;
  memoryAge: string;
  narratorGender: string;
  aspectRatio: AspectRatioOption;
}

export const CreateVideoWizard: React.FC<CreateVideoWizardProps> = ({
  user,
  setUser,
  onFinish,
  onCancel,
}) => {
  // Lido uma única vez, na montagem — protege contra perder o progresso se a aba fechar/travar
  // no meio do preenchimento. Nunca restaura direto no Passo 6 (prévia): a esse ponto o crédito
  // já foi gasto e o job criado, então não faz sentido "continuar" um rascunho ali.
  const [initialDraft] = useState<VideoWizardDraft | null>(() => loadDraft<VideoWizardDraft>(DRAFT_KEY));
  const [showDraftBanner, setShowDraftBanner] = useState<boolean>(!!initialDraft);

  const [currentStep, setCurrentStep] = useState<number>(Math.min(initialDraft?.currentStep || 1, 5));

  // Ao trocar de etapa (principalmente no celular), garante que a pessoa veja
  // o topo da nova etapa em vez de continuar na posição de rolagem da etapa anterior.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Form States
  const [photos, setPhotos] = useState<PhotoItem[]>(initialDraft?.photos || []);
  const [aiOnlyMode, setAiOnlyMode] = useState<boolean>(initialDraft?.aiOnlyMode || false);
  const [fatherName, setFatherName] = useState<string>(initialDraft?.fatherName || '');
  const [authorName, setAuthorName] = useState<string>(initialDraft?.authorName || user.name || '');
  const [tributeText, setTributeText] = useState<string>(initialDraft?.tributeText || '');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(initialDraft?.selectedVoiceId || PRESET_VOICES[0].id);
  const [isCustomVoice, setIsCustomVoice] = useState<boolean>(initialDraft?.isCustomVoice || false);
  const [customVoiceAudioUrl, setCustomVoiceAudioUrl] = useState<string>(initialDraft?.customVoiceAudioUrl || '');
  const [skipNarration, setSkipNarration] = useState<boolean>(initialDraft?.skipNarration || false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(initialDraft?.selectedTrackId || PRESET_TRACKS[0].id);
  const [useAIImages, setUseAIImages] = useState<boolean>(initialDraft?.useAIImages || false);
  const [aiImages, setAiImages] = useState<{ prompt: string; url: string }[]>(initialDraft?.aiImages || []);
  const [selectedImageStyle, setSelectedImageStyle] = useState<string>(initialDraft?.selectedImageStyle || 'watercolor');
  const [memoryAge, setMemoryAge] = useState<string>(initialDraft?.memoryAge || 'auto');
  const [narratorGender, setNarratorGender] = useState<string>(initialDraft?.narratorGender || 'auto');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(initialDraft?.aspectRatio || 'classic');

  // Salva o rascunho (com debounce) a cada mudança relevante, enquanto ainda não chegou na
  // prévia final — depois do Passo 6 o job já existe de verdade, não faz mais sentido "rascunhar".
  useEffect(() => {
    if (currentStep >= 6) return;
    const timer = setTimeout(() => {
      saveDraft<VideoWizardDraft>(DRAFT_KEY, {
        currentStep,
        photos,
        aiOnlyMode,
        fatherName,
        authorName,
        tributeText,
        selectedVoiceId,
        isCustomVoice,
        customVoiceAudioUrl,
        skipNarration,
        selectedTrackId,
        useAIImages,
        aiImages,
        selectedImageStyle,
        memoryAge,
        narratorGender,
        aspectRatio,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    currentStep, photos, aiOnlyMode, fatherName, authorName, tributeText, selectedVoiceId,
    isCustomVoice, customVoiceAudioUrl, skipNarration, selectedTrackId, useAIImages, aiImages,
    selectedImageStyle, memoryAge, narratorGender, aspectRatio,
  ]);

  const handleDiscardDraft = () => {
    clearDraft(DRAFT_KEY);
    setShowDraftBanner(false);
    setCurrentStep(1);
    setPhotos([]);
    setAiOnlyMode(false);
    setFatherName('');
    setAuthorName(user.name || '');
    setTributeText('');
    setSelectedVoiceId(PRESET_VOICES[0].id);
    setIsCustomVoice(false);
    setCustomVoiceAudioUrl('');
    setSkipNarration(false);
    setSelectedTrackId(PRESET_TRACKS[0].id);
    setUseAIImages(false);
    setAiImages([]);
    setSelectedImageStyle('watercolor');
    setMemoryAge('auto');
    setNarratorGender('auto');
    setAspectRatio('classic');
  };

  // Created Draft Job
  const [createdJob, setCreatedJob] = useState<VideoJob | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');

  const [isGeneratingJob, setIsGeneratingJob] = useState<boolean>(false);

  const handleGeneratePreviewJob = async () => {
    if (user.credits < 1) {
      toast.error('Você não tem créditos suficientes para criar um novo vídeo. Adicione créditos no seu painel.');
      return;
    }

    setIsGeneratingJob(true);

    // O crédito representa "quantos vídeos essa pessoa pode criar" — é gasto aqui, na criação,
    // já que não existe mais etapa de desbloqueio (a pessoa já está numa área paga).
    let updatedUser: User;
    try {
      updatedUser = await deductCreditRemote(user.id, user.sessionToken || '');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível criar o vídeo agora. Tente novamente.');
      setIsGeneratingJob(false);
      return;
    }
    setUser(updatedUser);

    const videoId = `vid_${Date.now()}`;
    const cardUrl = `${window.location.origin}/c/${videoId}`;

    // No modo "só IA" o vídeo é feito inteiramente das ilustrações geradas, sem fotos reais.
    // Nos demais casos, garante que há pelo menos fotos válidas para exibição no player.
    const validPhotos = aiOnlyMode || photos.length >= 3 ? photos : [
      { id: '1', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop', name: 'Foto 1', order: 1 },
      { id: '2', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop', name: 'Foto 2', order: 2 },
      { id: '3', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop', name: 'Foto 3', order: 3 },
    ];

    const newJob: VideoJob = {
      id: videoId,
      userId: user.id,
      title: `Homenagem para ${fatherName || 'Pai'}`,
      fatherName: fatherName || 'Pai Especial',
      photos: validPhotos,
      tributeText: tributeText || 'Pai, obrigado por cada conselho, cada abraço e cada momento de carinho.',
      selectedVoiceId,
      isCustomVoice,
      customVoiceAudioUrl: skipNarration ? '' : customVoiceAudioUrl,
      selectedTrackId,
      useAIImages,
      aiGeneratedImages: aiImages,
      aspectRatio,
      status: 'unlocked',
      progress: 100,
      cardUrl,
      createdAt: new Date().toISOString(),
      durationSeconds: Math.max(25, (validPhotos.length + (useAIImages ? aiImages.length : 0)) * 6),
    };

    // Mostra a prévia imediatamente a partir do estado em memória (sem tocar no localStorage
    // ainda) — fotos e imagens de IA em base64 podem facilmente estourar a cota do navegador
    // (5-10MB), o que travaria esta função antes mesmo de trocar de tela.
    setCreatedJob(newJob);
    setCurrentStep(6);
    setIsGeneratingJob(false);
    clearDraft(DRAFT_KEY);

    // Envia as mídias para o Supabase e salva o registro central, para o cartão
    // digital funcionar em qualquer dispositivo (não só no navegador de quem criou).
    setIsSyncing(true);
    setSyncError('');
    try {
      const jobWithRemoteMedia = await uploadVideoJobMedia(newJob);
      saveVideoJob(jobWithRemoteMedia);
      await saveVideoJobRemote(jobWithRemoteMedia, user.sessionToken || '');
      setCreatedJob(jobWithRemoteMedia);
    } catch (e: any) {
      console.error('Erro ao sincronizar vídeo com o servidor:', e);
      setSyncError('Não foi possível salvar este vídeo no servidor. O link do cartão pode não abrir em outros dispositivos até tentar novamente.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header & Wizard Stepper */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Cancelar
        </button>

        <div className="text-right min-w-0">
          <h2 className="text-base sm:text-xl font-extrabold text-slate-100 flex items-center justify-end gap-1.5 sm:gap-2 truncate">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />
            <span className="hidden sm:inline">Criar Vídeo Homenagem</span><span className="sm:hidden">Criar Vídeo</span>
          </h2>
          <p className="text-xs text-slate-400">Passo {currentStep} de 6</p>
        </div>
      </div>

      {/* Draft Recovery Banner */}
      {showDraftBanner && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
          <p className="text-xs text-amber-200">
            Continuando de onde você parou — recuperamos o progresso salvo automaticamente.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDiscardDraft}
              className="text-xs font-bold text-amber-300 hover:underline"
            >
              Começar do zero
            </button>
            <button
              onClick={() => setShowDraftBanner(false)}
              className="text-amber-400 hover:text-amber-200 p-1"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="space-y-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                s <= currentStep ? 'bg-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-800'
              }`}
            />
            <span className="text-[10px] font-semibold text-slate-500 block text-center hidden sm:block">
              {s === 1 && 'Fotos'}
              {s === 2 && 'Texto'}
              {s === 3 && 'Voz'}
              {s === 4 && 'Trilha'}
              {s === 5 && 'Imagens IA'}
              {s === 6 && 'Prévia'}
            </span>
          </div>
        ))}
      </div>

      {/* Wizard Active Step Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        {currentStep === 1 && (
          <Step1UploadPhotos
            photos={photos}
            setPhotos={setPhotos}
            aiOnlyMode={aiOnlyMode}
            setAiOnlyMode={setAiOnlyMode}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <Step2TextTribute
            tributeText={tributeText}
            setTributeText={setTributeText}
            fatherName={fatherName}
            setFatherName={setFatherName}
            authorName={authorName}
            setAuthorName={setAuthorName}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3NarrationVoice
            selectedVoiceId={selectedVoiceId}
            setSelectedVoiceId={setSelectedVoiceId}
            isCustomVoice={isCustomVoice}
            setIsCustomVoice={setIsCustomVoice}
            customVoiceAudioUrl={customVoiceAudioUrl}
            setCustomVoiceAudioUrl={setCustomVoiceAudioUrl}
            skipNarration={skipNarration}
            setSkipNarration={setSkipNarration}
            tributeText={tributeText}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4MusicTrack
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            classicFormatLabel="Quadrado (1:1)"
            classicFormatDescription="Formato padrão — ideal para feed e WhatsApp"
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && (
          <Step5AIImagesOption
            useAIImages={useAIImages}
            setUseAIImages={setUseAIImages}
            aiImages={aiImages}
            setAiImages={setAiImages}
            tributeText={tributeText}
            fatherName={fatherName}
            aiOnlyMode={aiOnlyMode}
            selectedImageStyle={selectedImageStyle}
            setSelectedImageStyle={setSelectedImageStyle}
            memoryAge={memoryAge}
            setMemoryAge={setMemoryAge}
            narratorGender={narratorGender}
            setNarratorGender={setNarratorGender}
            onNext={handleGeneratePreviewJob}
            onBack={() => setCurrentStep(4)}
            isSubmitting={isGeneratingJob}
          />
        )}

        {/* STEP 6: PREVIEW & UNLOCK */}
        {currentStep === 6 && createdJob && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vídeo Pronto em HD!
              </span>
              <h3 className="text-2xl font-bold text-slate-100">
                Sua Homenagem para {createdJob.fatherName} está pronta
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Baixe o vídeo em HD ou avance para pegar o link do Cartão Digital e enviar para o seu pai.
              </p>
            </div>

            <VideoPlayer
              video={createdJob}
              editableCaptionStyle
              onCaptionStyleChange={(style: CaptionStyle) => {
                setCreatedJob((prev) => (prev ? { ...prev, captionStyle: style } : prev));
                saveVideoJobRemote({ ...createdJob, captionStyle: style }, user.sessionToken || '').catch((err) =>
                  console.warn('Falha ao salvar estilo de legenda no servidor:', err)
                );
              }}
            />

            {isSyncing && (
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Salvando no servidor para o cartão funcionar em qualquer celular...
              </div>
            )}

            {syncError && (
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {syncError}
              </div>
            )}

            <button
              onClick={() => onFinish(createdJob)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-sm rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              <Sparkles className="w-4 h-4" /> Ver Cartão Digital e Compartilhar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
