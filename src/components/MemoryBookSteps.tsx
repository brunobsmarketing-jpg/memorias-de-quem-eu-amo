import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, Loader2, BookImage, CheckCircle2, MousePointerClick } from 'lucide-react';
import { PhotoItem, MemoryBookPage, PageTemplateDef } from '../types';
import { BOOK_PAGE_TEMPLATES } from '../data/bookTemplates';
import { drawBookPage, resolveBookTextValue } from '../lib/bookRenderer';
import { resizeImageToDataUrl, MAX_UPLOAD_FILE_SIZE_BYTES, formatFileSizeMB } from '../lib/imageUtils';

const StepInstruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-xl mx-auto flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
    <MousePointerClick className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
    <p className="text-xs text-slate-300 leading-relaxed">{children}</p>
  </div>
);

const MIN_BOOK_PHOTOS = 5;

// --- Upload de fotos (versão simplificada do Step1 do vídeo — o livro sempre usa fotos reais
// atribuídas manualmente pelo usuário nos espaços de cada página, não tem modo "só IA"). ---
interface BookStepUploadPhotosProps {
  photos: PhotoItem[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  onNext: () => void;
}

export const BookStepUploadPhotos: React.FC<BookStepUploadPhotosProps> = ({ photos, setPhotos, onNext }) => {
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files: File[] = Array.from(e.target.files);
    e.target.value = '';

    const oversized = files.filter((f) => f.size > MAX_UPLOAD_FILE_SIZE_BYTES);
    const validFiles = files.filter((f) => f.size <= MAX_UPLOAD_FILE_SIZE_BYTES);

    if (oversized.length > 0) {
      toast.warning(`${oversized.length} foto(s) acima de ${formatFileSizeMB(MAX_UPLOAD_FILE_SIZE_BYTES)}MB foram ignoradas`, {
        description: oversized.map((f) => `${f.name} (${formatFileSizeMB(f.size)}MB)`).join(', '),
      });
    }

    setIsProcessingPhotos(true);
    try {
      for (let index = 0; index < validFiles.length; index++) {
        const file = validFiles[index];
        try {
          const url = await resizeImageToDataUrl(file);
          setPhotos((prev) => [
            ...prev,
            { id: `photo_${Date.now()}_${index}`, url, name: file.name, order: prev.length },
          ]);
        } catch (err) {
          console.error(`Falha ao processar a foto ${file.name}:`, err);
          toast.error(`Não foi possível processar a foto "${file.name}". Tente outra imagem.`);
        }
      }
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const removePhoto = (id: string) => setPhotos(photos.filter((p) => p.id !== id));

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <Upload className="w-6 h-6 text-amber-400" /> Passo 1: Fotos do Livro
        </h3>
        <p className="text-slate-400 text-sm">
          Envie as fotos que você quer usar nas páginas do livro. Depois você escolhe manualmente qual foto vai em cada espaço.
        </p>
      </div>

      <StepInstruction>
        <strong>O que fazer agora:</strong> envie pelo menos {MIN_BOOK_PHOTOS} fotos — o livro tem páginas com vários
        espaços de foto, então quanto mais fotos boas você enviar, mais rico fica o resultado.
      </StepInstruction>

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
              Formatos suportados: JPG, PNG, WEBP (até {formatFileSizeMB(MAX_UPLOAD_FILE_SIZE_BYTES)}MB cada)
            </p>
          </div>
        </div>
      </div>

      {isProcessingPhotos && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Processando fotos...
        </div>
      )}

      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            {photos.length} foto(s) selecionada(s)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group shadow-md">
                <img src={photo.url} alt={`Foto ${index + 1}`} className="w-full h-32 object-cover" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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

      {photos.length < MIN_BOOK_PHOTOS && (
        <p className="text-xs text-amber-400/90 text-center">
          Envie pelo menos {MIN_BOOK_PHOTOS} fotos para continuar (faltam {MIN_BOOK_PHOTOS - photos.length}).
        </p>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={photos.length < MIN_BOOK_PHOTOS}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          Próximo Passo: Texto da Homenagem ({photos.length}/{MIN_BOOK_PHOTOS} fotos)
        </button>
      </div>
    </div>
  );
};

// --- Montagem das páginas: o coração do Livro de Memórias. Para cada template, o usuário
// escolhe manualmente qual foto enviada vai em cada espaço e edita os textos da página. ---
function usePageCanvasPreview(template: PageTemplateDef, page: MemoryBookPage, fatherName: string) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;
    drawBookPage(ctx, template, page, fatherName).catch((err) => {
      if (!cancelled) console.error('Falha ao desenhar prévia da página:', err);
    });
    return () => {
      cancelled = true;
    };
  }, [template, page, fatherName]);

  return canvasRef;
}

const PageAssemblyCard: React.FC<{
  template: PageTemplateDef;
  page: MemoryBookPage;
  photos: PhotoItem[];
  fatherName: string;
  onChangeSlot: (slotId: string, photoUrl: string | null) => void;
  onChangeText: (blockId: string, text: string) => void;
}> = ({ template, page, photos, fatherName, onChangeSlot, onChangeText }) => {
  const canvasRef = usePageCanvasPreview(template, page, fatherName);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <BookImage className="w-5 h-5 text-amber-400" />
        <div>
          <h4 className="font-bold text-slate-100 text-sm">{template.name}</h4>
          <p className="text-xs text-slate-500">{template.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-5">
        {/* Prévia da página */}
        <div
          className="relative w-full max-w-[260px] mx-auto lg:mx-0 rounded-xl overflow-hidden border border-slate-700 shadow-lg bg-black/20"
          style={{ aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }}
        >
          <canvas
            ref={canvasRef}
            width={template.canvasWidth}
            height={template.canvasHeight}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Atribuição de fotos por espaço + textos */}
        <div className="space-y-4">
          {template.slots.map((slot, slotIndex) => {
            const assignedUrl = page.slotValues.find((v) => v.slotId === slot.id)?.photoUrl;
            return (
              <div key={slot.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-400">Espaço {slotIndex + 1}</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => onChangeSlot(slot.id, assignedUrl === photo.url ? null : photo.url)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        assignedUrl === photo.url
                          ? 'border-amber-500 ring-2 ring-amber-500/40'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                      title={photo.name}
                    >
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                      {assignedUrl === photo.url && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-amber-400 drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {template.textBlocks.map((block) => (
            <div key={block.id} className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">{block.label}</label>
              {block.maxChars > 120 ? (
                <textarea
                  rows={3}
                  maxLength={block.maxChars}
                  value={resolveBookTextValue(template, page, block.id, fatherName)}
                  onChange={(e) => onChangeText(block.id, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              ) : (
                <input
                  type="text"
                  maxLength={block.maxChars}
                  value={resolveBookTextValue(template, page, block.id, fatherName)}
                  onChange={(e) => onChangeText(block.id, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface BookStepAssemblePagesProps {
  photos: PhotoItem[];
  pages: MemoryBookPage[];
  setPages: React.Dispatch<React.SetStateAction<MemoryBookPage[]>>;
  fatherName: string;
  onNext: () => void;
  onBack: () => void;
}

export const BookStepAssemblePages: React.FC<BookStepAssemblePagesProps> = ({
  photos,
  pages,
  setPages,
  fatherName,
  onNext,
  onBack,
}) => {
  const updateSlot = (pageId: string, slotId: string, photoUrl: string | null) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const withoutSlot = p.slotValues.filter((v) => v.slotId !== slotId);
        return {
          ...p,
          slotValues: photoUrl ? [...withoutSlot, { slotId, photoUrl }] : withoutSlot,
        };
      })
    );
  };

  const updateText = (pageId: string, blockId: string, text: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const withoutBlock = p.textValues.filter((v) => v.blockId !== blockId);
        return { ...p, textValues: [...withoutBlock, { blockId, text }] };
      })
    );
  };

  const totalSlotsFilled = pages.reduce((sum, p) => sum + p.slotValues.length, 0);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="font-serif text-2xl font-semibold text-slate-100 flex items-center justify-center gap-2">
          <BookImage className="w-6 h-6 text-amber-400" /> Passo 5: Montagem das Páginas
        </h3>
        <p className="text-slate-400 text-sm">
          Escolha qual foto vai em cada espaço de cada página e ajuste os textos como preferir.
        </p>
      </div>

      <StepInstruction>
        <strong>O que fazer agora:</strong> em cada página abaixo, clique nas miniaturas para atribuir uma foto a cada
        espaço (clique de novo para remover) e edite os textos se quiser. Preencha pelo menos um espaço em cada página.
      </StepInstruction>

      <div className="space-y-6">
        {BOOK_PAGE_TEMPLATES.map((template) => {
          const page = pages.find((p) => p.templateId === template.id);
          if (!page) return null;
          return (
            <PageAssemblyCard
              key={template.id}
              template={template}
              page={page}
              photos={photos}
              fatherName={fatherName}
              onChangeSlot={(slotId, photoUrl) => updateSlot(page.id, slotId, photoUrl)}
              onChangeText={(blockId, text) => updateText(page.id, blockId, text)}
            />
          );
        })}
      </div>

      {totalSlotsFilled === 0 && (
        <p className="text-xs text-amber-400/90 text-center">
          Atribua pelo menos uma foto a algum espaço para continuar.
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
          disabled={totalSlotsFilled === 0}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          Gerar Livro em Vídeo
        </button>
      </div>
    </div>
  );
};
