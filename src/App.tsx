import React, { useState, useEffect } from 'react';
import {
  Heart,
  PlusCircle,
  UserCheck,
  ArrowRight,
  LogOut,
  Lock,
  Sparkles,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import { User, VideoJob, MemoryBookJob } from './types';
import {
  getStoredUser,
  getStoredVideos,
  saveVideoJob,
  getStoredBooks,
  saveMemoryBookJob,
  clearStoredUser,
  saveStoredUser,
} from './lib/credits';
import { Dashboard } from './components/Dashboard';
import { ChooseCreationType } from './components/ChooseCreationType';
import { CreateVideoWizard } from './components/CreateVideoWizard';
import { CreateMemoryBookWizard } from './components/CreateMemoryBookWizard';
import { DigitalCardPage } from './components/DigitalCardPage';
import { DigitalBookPage } from './components/DigitalBookPage';
import { AuthModal } from './components/AuthModal';
import { BuyCreditsModal } from './components/BuyCreditsModal';
import { Toaster, toast } from 'sonner';
import { VideoPlayer } from './components/VideoPlayer';
import { PaywallCheckoutPage } from './components/PaywallCheckoutPage';
import { fetchVideoJobRemote } from './lib/videoApi';
import { fetchMemoryBookRemote } from './lib/bookApi';
import { loginByEmail } from './lib/authApi';

export default function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [videos, setVideos] = useState<VideoJob[]>(() => getStoredVideos());
  const [books, setBooks] = useState<MemoryBookJob[]>(() => getStoredBooks());
  const [currentView, setCurrentView] = useState<
    'home' | 'choose-type' | 'create' | 'create-book' | 'card' | 'book-card' | 'detail'
  >('home');
  const [activeVideo, setActiveVideo] = useState<VideoJob | null>(null);
  const [activeBook, setActiveBook] = useState<MemoryBookJob | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState<boolean>(false);
  const [cardNotFound, setCardNotFound] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('memorias_theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  // Modo claro agora é o padrão — só remove o atributo quando "dark" está ativo, já que o
  // CSS (index.css) define overrides de cor para :root[data-theme='light'].
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('memorias_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const [paymentBanner, setPaymentBanner] = useState<{ type: 'success' | 'pending' | 'failure'; message: string } | null>(null);

  // Trata o retorno do checkout da Mercado Pago (back_urls em /api/checkout/create-preference).
  // Os créditos já foram (ou serão) liberados via webhook no servidor — aqui só refletimos o
  // resultado pro usuário e buscamos o saldo atualizado, já que o webhook pode levar alguns
  // segundos a mais que o redirecionamento de volta pro navegador.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get('payment');
    if (!paymentStatus) return;

    // Limpa o parâmetro da URL pra não reprocessar/repetir o banner se a pessoa atualizar a página.
    window.history.replaceState({}, '', window.location.pathname);

    if (paymentStatus === 'success') {
      setPaymentBanner({ type: 'success', message: 'Pagamento aprovado! Atualizando seus créditos…' });
      const storedUser = getStoredUser();
      if (storedUser?.email) {
        loginByEmail(storedUser.email, storedUser.name)
          .then((freshUser) => {
            saveStoredUser(freshUser);
            setUser(freshUser);
            setPaymentBanner({ type: 'success', message: `Pagamento aprovado! ${freshUser.credits} crédito(s) na sua conta.` });
          })
          .catch(() => {
            setPaymentBanner({ type: 'success', message: 'Pagamento aprovado! Se os créditos não aparecerem em instantes, atualize a página.' });
          });
      }
    } else if (paymentStatus === 'pending') {
      setPaymentBanner({ type: 'pending', message: 'Pagamento em análise (comum no PIX/boleto). Seus créditos são liberados assim que for confirmado.' });
    } else if (paymentStatus === 'failure') {
      setPaymentBanner({ type: 'failure', message: 'Pagamento não concluído. Você pode tentar novamente quando quiser.' });
    }
  }, []);

  // Check URL pathname or search params for public card link /c/{id}
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const cardIdParam = searchParams.get('card') || (path.startsWith('/c/') ? path.replace('/c/', '') : '');

    if (!cardIdParam) return;

    setCurrentView('card');

    const found = videos.find((v) => v.id === cardIdParam);
    if (found) {
      setActiveVideo(found);
      return;
    }

    // Não está salvo neste navegador — busca no servidor, para o link funcionar
    // em qualquer dispositivo (ex: quando o pai abre o cartão no celular dele).
    fetchVideoJobRemote(cardIdParam)
      .then((remoteVideo) => {
        if (remoteVideo) {
          saveVideoJob(remoteVideo);
          setActiveVideo(remoteVideo);
          setCurrentView('card');
        } else {
          setCardNotFound(true);
          setCurrentView('card');
        }
      })
      .catch((e) => {
        console.error('Erro ao buscar cartão digital:', e);
        setCardNotFound(true);
        setCurrentView('card');
      });
  }, []);

  // Mesma lógica acima, mas para o link público do Livro de Memórias: /b/{id}
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const bookIdParam = searchParams.get('book') || (path.startsWith('/b/') ? path.replace('/b/', '') : '');

    if (!bookIdParam) return;

    setCurrentView('book-card');

    const found = books.find((b) => b.id === bookIdParam);
    if (found) {
      setActiveBook(found);
      return;
    }

    fetchMemoryBookRemote(bookIdParam)
      .then((remoteBook) => {
        if (remoteBook) {
          saveMemoryBookJob(remoteBook);
          setActiveBook(remoteBook);
          setCurrentView('book-card');
        } else {
          setCardNotFound(true);
          setCurrentView('book-card');
        }
      })
      .catch((e) => {
        console.error('Erro ao buscar livro de memórias:', e);
        setCardNotFound(true);
        setCurrentView('book-card');
      });
  }, []);

  const handleStartCreation = () => {
    if (!user || !user.isPaidMember) {
      toast.error('É necessário ser um membro pagante para criar homenagens. Escolha seu plano.');
      return;
    }
    setCurrentView('choose-type');
  };

  const handleChooseCreationType = (type: 'video' | 'book') => {
    setCurrentView(type === 'video' ? 'create' : 'create-book');
  };

  const handleFinishBookCreation = (newBook: MemoryBookJob) => {
    const updatedList = getStoredBooks();
    setBooks(updatedList);
    setActiveBook(newBook);
    setCurrentView('book-card');
  };

  const handleSelectBook = (book: MemoryBookJob) => {
    setActiveBook(book);
    setCurrentView('book-card');
  };

  const handleFinishCreation = (newVideo: VideoJob) => {
    const updatedList = getStoredVideos();
    setVideos(updatedList);
    setActiveVideo(newVideo);
    setCurrentView('card');
  };

  const handleSelectVideo = (video: VideoJob) => {
    setActiveVideo(video);
    setCurrentView('detail');
  };

  const handleLogout = () => {
    clearStoredUser();
    setUser(null);
  };

  // If viewing public card page, render card regardless of user auth
  if (currentView === 'card' && activeVideo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Toaster theme={theme} position="top-center" richColors closeButton />
        <DigitalCardPage video={activeVideo} onGoHome={() => setCurrentView('home')} />
      </div>
    );
  }

  if (currentView === 'card' && cardNotFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center text-center px-4 space-y-4 font-sans">
        <Heart className="w-10 h-10 text-amber-400" />
        <h1 className="text-xl font-bold">Cartão não encontrado</h1>
        <p className="text-slate-400 text-sm max-w-sm">
          Este link de homenagem não existe ou ainda está sendo processado. Verifique se o link foi copiado corretamente.
        </p>
        <button
          onClick={() => {
            setCardNotFound(false);
            setCurrentView('home');
          }}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl"
        >
          Ir para a página inicial
        </button>
      </div>
    );
  }

  if (currentView === 'card') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Carregando homenagem...</span>
      </div>
    );
  }

  // Mesmo padrão acima, para o link público do Livro de Memórias
  if (currentView === 'book-card' && activeBook) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Toaster theme={theme} position="top-center" richColors closeButton />
        <DigitalBookPage book={activeBook} onGoHome={() => setCurrentView('home')} />
      </div>
    );
  }

  if (currentView === 'book-card' && cardNotFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center text-center px-4 space-y-4 font-sans">
        <Heart className="w-10 h-10 text-amber-400" />
        <h1 className="text-xl font-bold">Livro não encontrado</h1>
        <p className="text-slate-400 text-sm max-w-sm">
          Este link de livro não existe ou ainda está sendo processado. Verifique se o link foi copiado corretamente.
        </p>
        <button
          onClick={() => {
            setCardNotFound(false);
            setCurrentView('home');
          }}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl"
        >
          Ir para a página inicial
        </button>
      </div>
    );
  }

  if (currentView === 'book-card') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Carregando livro de memórias...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <Toaster theme={theme} position="top-center" richColors closeButton />

      {/* Global Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo Branding */}
          <div
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black shadow-md group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-100 block group-hover:text-amber-400 transition-colors">
                Memórias de Quem Eu Amo
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                {user?.isPaidMember ? 'Área de Membros VIP' : 'Acesso Exclusivo para Assinantes'}
              </span>
            </div>
          </div>

          {/* User Status / Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user && user.isPaidMember ? (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 pl-3.5 pr-1.5 py-1.5 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-amber-300">{user.credits} Crédito(s)</span>
                  <button
                    onClick={() => setShowBuyCreditsModal(true)}
                    className="p-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-full transition-colors"
                    title="Adicionar Créditos"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="sm:hidden p-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl border border-slate-800 transition-colors"
                  title="Adicionar Créditos"
                >
                  <Zap className="w-4 h-4" />
                </button>

                <button
                  onClick={handleStartCreation}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" /> Criar Homenagem
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition-colors flex items-center gap-1 text-xs"
                  title="Sair da Conta"
                >
                  <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" /> Já é Membro? Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
        {paymentBanner && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 ${
              paymentBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : paymentBanner.type === 'pending'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{paymentBanner.message}</span>
            <button onClick={() => setPaymentBanner(null)} className="opacity-70 hover:opacity-100 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* VIEW 1: PAYWALL CHECKOUT PAGE (if user is not paid member) */}
        {(!user || !user.isPaidMember) && (
          <PaywallCheckoutPage
            onPaymentComplete={(paidUser) => {
              setUser(paidUser);
              setCurrentView('home');
            }}
            onOpenLogin={() => setShowAuthModal(true)}
          />
        )}

        {/* VIEW 2: PAID MEMBERS AREA (when user is paid) */}
        {user && user.isPaidMember && (
          <>
            {/* ESCOLHA DO TIPO DE HOMENAGEM (vídeo vs livro) */}
            {currentView === 'choose-type' && (
              <ChooseCreationType
                onChoose={handleChooseCreationType}
                onCancel={() => setCurrentView('home')}
              />
            )}

            {/* WIZARD CREATION FLOW */}
            {currentView === 'create' && (
              <CreateVideoWizard
                user={user}
                setUser={setUser as React.Dispatch<React.SetStateAction<User>>}
                onFinish={handleFinishCreation}
                onCancel={() => setCurrentView('home')}
              />
            )}

            {currentView === 'create-book' && (
              <CreateMemoryBookWizard
                user={user}
                setUser={setUser as React.Dispatch<React.SetStateAction<User>>}
                onFinish={handleFinishBookCreation}
                onCancel={() => setCurrentView('home')}
              />
            )}

            {/* SINGLE VIDEO DETAIL VIEW */}
            {currentView === 'detail' && activeVideo && (
              <div className="max-w-3xl mx-auto space-y-6">
                <button
                  onClick={() => setCurrentView('home')}
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                >
                  ← Voltar à Área de Membros
                </button>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-semibold text-slate-100">Homenagem para {activeVideo.fatherName}</h2>
                      <p className="text-xs text-slate-400">Criado em {new Date(activeVideo.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <a
                      href={activeVideo.cardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center gap-1.5"
                    >
                      Abrir Cartão Digital Público <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>

                  <VideoPlayer video={activeVideo} />
                </div>
              </div>
            )}

            {/* MEMBERS HOME DASHBOARD */}
            {currentView === 'home' && (
              <Dashboard
                user={user}
                videos={videos}
                books={books}
                onStartCreation={handleStartCreation}
                onSelectVideo={handleSelectVideo}
                onSelectBook={handleSelectBook}
                onOpenBuyCredits={() => setShowBuyCreditsModal(true)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* Auth Modal for Existing Paid Members */}
      {showAuthModal && (
        <AuthModal
          onSuccess={(paidUser) => {
            setUser(paidUser);
            setShowAuthModal(false);
          }}
          onCancel={() => setShowAuthModal(false)}
        />
      )}

      {/* Buy Credits Modal — acessível pelo cabeçalho, rodapé e de dentro da área de membros */}
      {showBuyCreditsModal && user && user.isPaidMember && (
        <BuyCreditsModal user={user} onClose={() => setShowBuyCreditsModal(false)} />
      )}

      {/* Global Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500 space-y-2 mt-12">
        <p className="font-medium text-slate-400">
          Memórias de Quem Eu Amo © 2026 — Plataforma Exclusiva de Homenagens
        </p>
        <p>Acesso exclusivo para membros pagantes com gerador poético por IA, gravação de voz e cartões interativos.</p>
        {user && user.isPaidMember && (
          <p>
            <button
              onClick={() => setShowBuyCreditsModal(true)}
              className="text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" /> Adicionar Créditos à Conta
            </button>
          </p>
        )}
        <p className="text-slate-600">
          Trilhas sonoras: "Kevin MacLeod" (incompetech.com) — Licença Creative Commons: By Attribution 4.0 (CC BY 4.0)
        </p>
      </footer>
    </div>
  );
}
