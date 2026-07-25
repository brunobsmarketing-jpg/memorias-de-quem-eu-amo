import React, { useState } from 'react';
import { Heart, Mail, User as UserIcon, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { User } from '../types';
import { saveStoredUser } from '../lib/credits';
import { loginByEmail } from '../lib/authApi';

interface AuthModalProps {
  onSuccess: (user: User) => void;
  onCancel: () => void;
  onGoToCheckout?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel, onGoToCheckout }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const user = await loginByEmail(email, name);
      saveStoredUser(user);
      if (!user.isPaidMember && onGoToCheckout) {
        onCancel();
        onGoToCheckout();
        return;
      }
      onSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 text-slate-400 hover:text-white font-bold text-sm"
        >
          ✕
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <Heart className="w-6 h-6 fill-amber-400/20 text-amber-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-100">
            Acesso à Área de Membros
          </h3>
          <p className="text-xs text-slate-400">
            Entre com seu e-mail cadastrado na compra para acessar seus vídeos e saldo de créditos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Seu Nome (opcional)</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail do Membro</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-semibold">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Entrar na Área de Membros VIP <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-slate-800 text-xs space-y-2">
          <p className="text-slate-400">
            Ainda não comprou seu acesso?
          </p>
          {onGoToCheckout && (
            <button
              onClick={() => {
                onCancel();
                onGoToCheckout();
              }}
              className="text-amber-400 hover:underline font-bold block mx-auto"
            >
              Ir para a Página de Checkout e Escolher Plano
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
