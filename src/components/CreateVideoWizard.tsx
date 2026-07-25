import React, { useState } from 'react';
import { Sparkles, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { PhotoItem, VideoJob, User } from '../types';
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

interface CreateVideoWizardProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  onFinish: (video: VideoJob) => void;
  onCancel: () => void;
}

export const CreateVideoWizard: React.FC<CreateVideoWizardProps> = ({
  user,
  setUser,
  onFinish,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form States
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [fatherName, setFatherName] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>(user.name || '');
  const [tributeText, setTributeText] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(PRESET_VOICES[0].id);
  const [isCustomVoice, setIsCustomVoice] = useState<boolean>(false);
  const [customVoiceAudioUrl, setCustomVoiceAudioUrl] = useState<string>('');
  const [selectedTrackId, setSelectedTrackId] = useState<string>(PRESET_TRACKS[0].id);
  const [useAIImages, setUseAIImages] = useState<boolean>(false);
  const [aiImages, setAiImages] = useState<{ prompt: string; url: string }[]>([]);

  // Created Draft Job
  const [createdJob, setCreatedJob] = useState<VideoJob | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');

  const handleGeneratePreviewJob = async () => {
    const videoId = `vid_${Date.now()}`;
    const cardUrl = `${window.location.origin}/c/${videoId}`;

    // Garante que há pelo menos fotos válidas para exibição no player
    const validPhotos = photos.length >= 3 ? photos : [
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
      customVoiceAudioUrl,
      selectedTrackId,
      useAIImages,
      aiGeneratedImages: aiImages,
      status: 'watermarked',
      progress: 100,
      cardUrl,
      createdAt: new Date().toISOString(),
      durationSeconds: Math.max(25, (validPhotos.length + (useAIImages ? aiImages.length : 0)) * 6),
    };

    // Mostra a prévia imediatamente a partir do estado em memória (sem tocar no localStorage
    // ainda) — fotos e imagens de IA em base64 podem facilmente estourar a cota do navegador
    // (5-10MB), o que travaria esta função antes mesmo de trocar de tela.
    setCreatedJob(newJob);
    setCurrentStep(6); // Força avanço para Step 6: Preview & Unlock

    // Envia as mídias para o Supabase e salva o registro central, para o cartão
    // digital funcionar em qualquer dispositivo (não só no navegador de quem criou).
    setIsSyncing(true);
    setSyncError('');
    try {
      const jobWithRemoteMedia = await uploadVideoJobMedia(newJob);
      saveVideoJob(jobWithRemoteMedia);
      await saveVideoJobRemote(jobWithRemoteMedia);
      setCreatedJob(jobWithRemoteMedia);
    } catch (e: any) {
      console.error('Erro ao sincronizar vídeo com o servidor:', e);
      setSyncError('Não foi possível salvar este vídeo no servidor. O link do cartão pode não abrir em outros dispositivos até tentar novamente.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnlockHDVersion = async () => {
    if (!createdJob) return;

    if (user.credits < 1) {
      alert('Você precisa de 1 crédito para liberar o vídeo sem marca d\'água. Recarregue seus créditos no painel.');
      return;
    }

    try {
      const updatedUser = await deductCreditRemote(user.id);
      setUser(updatedUser);
      const unlockedJob: VideoJob = {
        ...createdJob,
        status: 'unlocked',
      };
      saveVideoJob(unlockedJob);
      setCreatedJob(unlockedJob);
      onFinish(unlockedJob);

      try {
        await saveVideoJobRemote(unlockedJob);
      } catch (e) {
        console.error('Erro ao sincronizar liberação do vídeo com o servidor:', e);
      }
    } catch (e: any) {
      alert(e.message || 'Não foi possível liberar o vídeo. Tente novamente.');
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

        <div className="text-right">
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center justify-end gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Criar Vídeo Homenagem
          </h2>
          <p className="text-xs text-slate-400">Passo {currentStep} de 6</p>
        </div>
      </div>

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
            tributeText={tributeText}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4MusicTrack
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
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
            onNext={handleGeneratePreviewJob}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {/* STEP 6: PREVIEW & UNLOCK */}
        {currentStep === 6 && createdJob && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Sparkles className="w-3.5 h-3.5" /> Prévia do Vídeo Gerada!
              </span>
              <h3 className="text-2xl font-bold text-slate-100">
                Veja a Prévia da Homenagem para {createdJob.fatherName}
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Assista abaixo com a marca d'água de teste. Se aprovado, use 1 crédito para liberar o arquivo em HD + Cartão Digital público.
              </p>
            </div>

            <VideoPlayer
              video={createdJob}
              isUnlocked={createdJob.status === 'unlocked'}
              onUnlockRequest={handleUnlockHDVersion}
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

            {createdJob.status === 'unlocked' && (
              <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Vídeo HD Liberado! Acessando Cartão Digital...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
