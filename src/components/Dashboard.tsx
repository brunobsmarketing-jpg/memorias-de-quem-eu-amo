import React, { useState } from 'react';
import {
  Sparkles,
  PlusCircle,
  Video,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Upload,
  Mic,
  Film,
  Zap,
  ArrowRight,
  FileText,
  QrCode,
  FolderOpen,
} from 'lucide-react';
import { User, VideoJob, CreditPackage } from '../types';
import { CREDIT_PACKAGES } from '../data/presets';
import { saveStoredUser } from '../lib/credits';
import { checkoutCredits } from '../lib/authApi';
import { MembersMediaManager } from './MembersMediaManager';

interface DashboardProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  videos: VideoJob[];
  onStartNewVideo: () => void;
  onSelectVideo: (video: VideoJob) => void;
  onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  setUser,
  videos,
  onStartNewVideo,
  onSelectVideo,
}) => {
  const [activeSection, setActiveSection] = useState<'videos' | 'media' | 'steps'>('videos');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage>(CREDIT_PACKAGES[1] || CREDIT_PACKAGES[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSimulateAddCredits = async () => {
    setIsProcessingPayment(true);
    try {
      const updatedUser = await checkoutCredits({
        email: user.email,
        name: user.name,
        packageId: selectedPkg.id,
        credits: selectedPkg.credits,
        amountBRL: selectedPkg.priceBRL,
      });
      saveStoredUser(updatedUser);
      setUser(updatedUser);
      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setShowBuyModal(false);
      }, 1200);
    } catch (e) {
      console.error('Erro ao adicionar créditos:', e);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Members Area Header & Quick Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Área de Membros
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Painel de Criação de Homenagens
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Sua conta está ativa. Use as ferramentas abaixo para enviar fotos, gravar mensagens de voz ou vídeo e gerar seus cartões interativos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Credit Balance Card */}
            <div className="bg-slate-950 border border-slate-800 px-5 py-3.5 rounded-2xl flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
                {user.credits}
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Créditos de Vídeo HD</span>
                <span className="text-sm font-bold text-slate-100">{user.credits} disponível(is)</span>
              </div>
            </div>

            <button
              onClick={onStartNewVideo}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <PlusCircle className="w-5 h-5" /> Criar Homenagem
            </button>
          </div>
        </div>
      </div>

      {/* Practical Guide: What you need to do */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" /> Passo a Passo de Uso da sua Conta
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Enviar Fotos</h4>
            <p className="text-xs text-slate-400">
              Suba as fotos do homenageado e da família na aba "Arquivos e Gravador".
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Gravar Voz ou Vídeo</h4>
            <p className="text-xs text-slate-400">
              Grave uma mensagem direta de carinho pelo celular ou microfone.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Gerar Poema IA</h4>
            <p className="text-xs text-slate-400">
              Use a inteligência artificial para criar um poema emocionante e personalizado.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Cartão & QR Code</h4>
            <p className="text-xs text-slate-400">
              Gere o vídeo final e compartilhe o link do cartão digital com sua família.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Workspace */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSection('videos')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeSection === 'videos'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4" /> Minhas Homenagens Criadas ({videos.length})
        </button>

        <button
          onClick={() => setActiveSection('media')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeSection === 'media'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" /> Enviar Arquivos & Gravador de Voz
        </button>

        <button
          onClick={() => setShowBuyModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 text-amber-400 hover:bg-slate-800 border border-amber-500/30 transition-all flex items-center gap-1.5 ml-auto"
        >
          <Zap className="w-4 h-4" /> Adicionar Créditos
        </button>
      </div>

      {/* SECTION 1: VIDEOS GALLERY */}
      {activeSection === 'videos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-amber-400" /> Galeria da Sua Conta
            </h3>
            <span className="text-xs font-semibold text-slate-400">Total: {videos.length} vídeo(s)</span>
          </div>

          {videos.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 mx-auto">
                <Video className="w-8 h-8 text-amber-400" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-slate-200 font-bold text-lg">Nenhum vídeo criado ainda</h4>
                <p className="text-slate-400 text-sm">
                  Clique no botão abaixo para iniciar a criação da sua primeira homenagem.
                </p>
              </div>
              <button
                onClick={onStartNewVideo}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-95 inline-flex items-center gap-2"
              >
                <PlusCircle className="w-5 h-5" /> Iniciar Criação
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((vid) => {
                const coverPhoto = vid.photos?.[0]?.url || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=600&q=80';

                return (
                  <div
                    key={vid.id}
                    className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-all group flex flex-col justify-between shadow-lg"
                  >
                    <div className="relative aspect-video bg-slate-950 overflow-hidden">
                      <img
                        src={coverPhoto}
                        alt={vid.fatherName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Liberado HD
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                          Homenagem para {vid.fatherName}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          "{vid.tributeText}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {new Date(vid.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span>{vid.photos.length} foto(s)</span>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => onSelectVideo(vid)}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          Assistir Vídeo
                        </button>

                        <a
                          href={vid.cardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30"
                          title="Abrir Cartão Digital Interativo"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: MEDIA MANAGER */}
      {activeSection === 'media' && (
        <MembersMediaManager />
      )}

      {/* Add Credits Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Adicionar Créditos à Conta
                </h3>
                <p className="text-xs text-slate-400">Escolha a quantidade de créditos adicionais</p>
              </div>
              <button
                onClick={() => setShowBuyModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    selectedPkg.id === pkg.id
                      ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <h5 className="font-bold text-slate-100 text-sm">{pkg.credits} Crédito(s)</h5>
                    <p className="text-xs text-slate-400">{pkg.description}</p>
                  </div>
                  <span className="text-base font-extrabold text-amber-400">{pkg.priceFormatted}</span>
                </div>
              ))}
            </div>

            {paymentSuccess ? (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 text-center font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Créditos Adicionados!
              </div>
            ) : (
              <button
                onClick={handleSimulateAddCredits}
                disabled={isProcessingPayment}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isProcessingPayment ? 'Adicionando...' : `Adicionar ${selectedPkg.credits} Crédito(s)`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
