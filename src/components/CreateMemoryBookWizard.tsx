import React, { useState } from 'react';
import { Sparkles, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { PhotoItem, MemoryBookJob, MemoryBookPage, User } from '../types';
import { BOOK_PAGE_TEMPLATES } from '../data/bookTemplates';
import { BookStepUploadPhotos, BookStepAssemblePages } from './MemoryBookSteps';
import { Step2TextTribute, Step3NarrationVoice, Step4MusicTrack } from './WizardSteps';
import { BookVideoPlayer } from './BookVideoPlayer';
import { exportBookPageToPng } from '../lib/bookRenderer';
import { saveMemoryBookRemote, uploadMemoryBookMedia } from '../lib/bookApi';
import { saveMemoryBookJob } from '../lib/credits';
import { deductCreditRemote } from '../lib/authApi';
import { PRESET_VOICES, PRESET_TRACKS } from '../data/presets';

interface CreateMemoryBookWizardProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  onFinish: (book: MemoryBookJob) => void;
  onCancel: () => void;
}

function createEmptyPages(): MemoryBookPage[] {
  return BOOK_PAGE_TEMPLATES.map((template, index) => ({
    id: `page_${template.id}`,
    templateId: template.id,
    order: index,
    slotValues: [],
    textValues: [],
  }));
}

const STEP_LABELS = ['Fotos', 'Texto', 'Voz', 'Trilha', 'Montagem', 'Prévia'];

export const CreateMemoryBookWizard: React.FC<CreateMemoryBookWizardProps> = ({
  user,
  setUser,
  onFinish,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [fatherName, setFatherName] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>(user.name || '');
  const [tributeText, setTributeText] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(PRESET_VOICES[0].id);
  const [isCustomVoice, setIsCustomVoice] = useState<boolean>(false);
  const [customVoiceAudioUrl, setCustomVoiceAudioUrl] = useState<string>('');
  const [skipNarration, setSkipNarration] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(PRESET_TRACKS[0].id);
  const [pages, setPages] = useState<MemoryBookPage[]>(() => createEmptyPages());

  const [createdBook, setCreatedBook] = useState<MemoryBookJob | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');
  const [isGeneratingJob, setIsGeneratingJob] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>('');

  const handleGenerateBook = async () => {
    if (user.credits < 1) {
      alert('Você não tem créditos suficientes para criar um novo livro. Adicione créditos no seu painel.');
      return;
    }

    setIsGeneratingJob(true);

    let updatedUser: User;
    try {
      updatedUser = await deductCreditRemote(user.id);
    } catch (e: any) {
      alert(e.message || 'Não foi possível criar o livro agora. Tente novamente.');
      setIsGeneratingJob(false);
      return;
    }
    setUser(updatedUser);

    const bookId = `book_${Date.now()}`;
    const cardUrl = `${window.location.origin}/b/${bookId}`;

    try {
      // Exporta cada página composta (fotos + textos) como PNG no navegador — é esse PNG que
      // vira o "slide" enviado ao servidor para o render final em vídeo.
      setExportProgress('Montando as páginas do livro...');
      const pagesWithImages: MemoryBookPage[] = [];
      for (const page of pages) {
        const template = BOOK_PAGE_TEMPLATES.find((t) => t.id === page.templateId);
        if (!template || page.slotValues.length === 0) continue;
        const renderedImageUrl = await exportBookPageToPng(template, page, fatherName);
        pagesWithImages.push({ ...page, renderedImageUrl });
      }

      if (pagesWithImages.length === 0) {
        throw new Error('Nenhuma página com foto atribuída para gerar o livro.');
      }

      const newBook: MemoryBookJob = {
        id: bookId,
        userId: user.id,
        fatherName: fatherName || 'Pai Especial',
        photos,
        pages: pagesWithImages,
        selectedTrackId,
        selectedVoiceId,
        isCustomVoice,
        customVoiceAudioUrl: skipNarration ? '' : customVoiceAudioUrl,
        narrationText: tributeText || 'Uma homenagem especial de quem te ama.',
        status: 'unlocked',
        progress: 100,
        cardUrl,
        createdAt: new Date().toISOString(),
        durationSeconds: Math.max(20, pagesWithImages.length * 5),
      };

      setCreatedBook(newBook);
      setCurrentStep(6);
      setIsGeneratingJob(false);
      setExportProgress('');

      setIsSyncing(true);
      setSyncError('');
      try {
        const bookWithRemoteMedia = await uploadMemoryBookMedia(newBook);
        saveMemoryBookJob(bookWithRemoteMedia);
        await saveMemoryBookRemote(bookWithRemoteMedia);
        setCreatedBook(bookWithRemoteMedia);
      } catch (e: any) {
        console.error('Erro ao sincronizar livro com o servidor:', e);
        setSyncError('Não foi possível salvar este livro no servidor. O link do cartão pode não abrir em outros dispositivos até tentar novamente.');
      } finally {
        setIsSyncing(false);
      }
    } catch (e: any) {
      console.error('Erro ao montar o livro:', e);
      alert(e.message || 'Não foi possível gerar o livro agora. Tente novamente.');
      setIsGeneratingJob(false);
      setExportProgress('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Cancelar
        </button>

        <div className="text-right">
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center justify-end gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Criar Livro de Memórias
          </h2>
          <p className="text-xs text-slate-400">Passo {currentStep} de 6</p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="space-y-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  s <= currentStep ? 'bg-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-800'
                }`}
              />
              <span className="text-[10px] font-semibold text-slate-500 block text-center hidden sm:block">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        {currentStep === 1 && (
          <BookStepUploadPhotos photos={photos} setPhotos={setPhotos} onNext={() => setCurrentStep(2)} />
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
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && (
          <BookStepAssemblePages
            photos={photos}
            pages={pages}
            setPages={setPages}
            fatherName={fatherName}
            onNext={handleGenerateBook}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 5 && isGeneratingJob && (
          <div className="mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> {exportProgress || 'Gerando o livro...'}
          </div>
        )}

        {currentStep === 6 && createdBook && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Livro Pronto!
              </span>
              <h3 className="text-2xl font-bold text-slate-100">
                Seu Livro de Memórias para {createdBook.fatherName} está pronto
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Veja a prévia das páginas e gere o vídeo em HD para compartilhar com o seu pai.
              </p>
            </div>

            <BookVideoPlayer book={createdBook} />

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
              onClick={() => onFinish(createdBook)}
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
