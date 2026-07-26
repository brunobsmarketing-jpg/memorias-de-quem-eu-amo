import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Mic,
  Video,
  Trash2,
  Play,
  Square,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  Plus,
  Volume2,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { getStoredMediaAssets, saveMediaAsset, deleteMediaAsset } from '../lib/credits';

interface MembersMediaManagerProps {
  onUsePhotosForVideo?: (photos: string[]) => void;
}

export const MembersMediaManager: React.FC<MembersMediaManagerProps> = () => {
  const [mediaList, setMediaList] = useState<MediaAsset[]>(() => getStoredMediaAssets());
  const [activeTab, setActiveTab] = useState<'photos' | 'recorder'>('photos');

  // Recorder states
  const [recordType, setRecordType] = useState<'audio' | 'video'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setMediaList(getStoredMediaAssets());
  }, []);

  // Cleanup media streams when component unmounts or switches
  useEffect(() => {
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle File Uploads (Photos/Videos/Audios)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const resultUrl = event.target?.result as string;
        let type: 'photo' | 'audio' | 'video' = 'photo';
        if (file.type.startsWith('audio')) type = 'audio';
        else if (file.type.startsWith('video')) type = 'video';

        const newAsset: MediaAsset = {
          id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type,
          url: resultUrl,
          name: file.name,
          createdAt: new Date().toISOString(),
        };

        const updated = saveMediaAsset(newAsset);
        setMediaList(updated);
      };
      reader.readAsDataURL(file);
    });
  };

  // Start Recording Audio or Video
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const constraints = recordType === 'video' ? { video: true, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;

      if (recordType === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recordType === 'video' ? 'video/webm' : 'audio/webm',
        });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);

        // Convert blob to DataURL for persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const newAsset: MediaAsset = {
            id: `rec_${Date.now()}`,
            type: recordType,
            url: base64data,
            name: `Gravação de ${recordType === 'video' ? 'Vídeo' : 'Voz'} - ${new Date().toLocaleTimeString('pt-BR')}`,
            createdAt: new Date().toISOString(),
            durationSeconds: recordingTime,
          };
          const updated = saveMediaAsset(newAsset);
          setMediaList(updated);
        };
        reader.readAsDataURL(blob);

        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Não foi possível acessar a câmera/microfone. Verifique as permissões do seu navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDeleteMedia = (id: string) => {
    const updated = deleteMediaAsset(id);
    setMediaList(updated);
  };

  const photos = mediaList.filter((m) => m.type === 'photo');
  const recordings = mediaList.filter((m) => m.type === 'audio' || m.type === 'video');

  return (
    <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Central de Mídias do Membro VIP
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Suba suas fotos e grave mensagens de voz/vídeo para incluir nas suas homenagens.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'photos'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Minhas Fotos ({photos.length})
          </button>

          <button
            onClick={() => setActiveTab('recorder')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'recorder'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-4 h-4" /> Gravar Áudio/Vídeo ({recordings.length})
          </button>
        </div>
      </div>

      {/* TAB 1: UPLOAD & GALLERY OF PHOTOS */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl p-6 text-center transition-colors bg-slate-950/40">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="member-photo-upload"
            />
            <label htmlFor="member-photo-upload" className="cursor-pointer space-y-3 block">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-slate-200 text-sm block">Clique para Enviar Fotos do seu Dispositivo</span>
                <span className="text-xs text-slate-400">Suporta JPG, PNG, WEBP (Selecione várias de uma vez)</span>
              </div>
            </label>
          </div>

          {photos.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhuma foto enviada ainda. Suba as fotos da sua família para usar no vídeo!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
                  <div className="aspect-square relative overflow-hidden">
                    <img src={photo.url} alt={photo.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <button
                    onClick={() => handleDeleteMedia(photo.id)}
                    className="absolute top-2 right-2 p-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg text-xs backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir Foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-2 text-[11px] font-medium text-slate-300 truncate">
                    {photo.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDIO RECORDER (AUDIO / VIDEO) */}
      {activeTab === 'recorder' && (
        <div className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 text-sm">Gravador do Estúdio VIP</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecordType('audio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    recordType === 'audio' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> Gravar Apenas Voz (Áudio)
                </button>
                <button
                  onClick={() => setRecordType('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    recordType === 'video' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" /> Gravar Recado em Vídeo
                </button>
              </div>
            </div>

            {/* Live Video Preview if recording video */}
            {recordType === 'video' && (
              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden max-w-md mx-auto border border-slate-800 relative">
                <video ref={videoPreviewRef} muted className="w-full h-full object-cover" />
                {isRecording && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-rose-500 text-white font-bold text-xs rounded-full flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" /> Gravando Vídeo ({recordingTime}s)
                  </div>
                )}
              </div>
            )}

            {/* Recorder Controls */}
            <div className="text-center space-y-4">
              {isRecording ? (
                <div className="space-y-3">
                  <p className="text-amber-400 font-extrabold text-lg animate-pulse">
                    🔴 Gravando {recordType === 'video' ? 'Vídeo' : 'Voz'}... ({recordingTime} segundos)
                  </p>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl shadow-lg inline-flex items-center gap-2"
                  >
                    <Square className="w-4 h-4 fill-white" /> Parar Gravação
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm rounded-xl shadow-lg inline-flex items-center gap-2"
                >
                  <Mic className="w-5 h-5" /> Iniciar Gravação de {recordType === 'video' ? 'Vídeo' : 'Voz'}
                </button>
              )}
            </div>
          </div>

          {/* List of Saved Recordings */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-200 text-sm">Suas Gravações Salvas ({recordings.length})</h4>

            {recordings.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhuma gravação de áudio ou vídeo realizada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recordings.map((item) => (
                  <div key={item.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.type === 'video' ? (
                          <Video className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="font-bold text-xs text-slate-200">{item.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.type === 'video' ? (
                      <video src={item.url} controls className="w-full rounded-xl max-h-48 object-cover bg-black" />
                    ) : (
                      <audio src={item.url} controls className="w-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
