import React, { useState } from 'react';
import {
  Heart,
  Lock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../types';
import { SALES_PAGE_URL } from '../data/presets';
import { saveStoredUser } from '../lib/credits';
import { loginByEmail } from '../lib/authApi';

interface PaywallCheckoutPageProps {
  onPaymentComplete: (user: User) => void;
  onOpenLogin: () => void;
}

/**
 * A compra inicial (virar membro pago) acontece fora deste app, numa página de vendas própria
 * que usa a Payt como gateway — o webhook /api/webhook/payt libera o acesso automaticamente
 * quando o pagamento é confirmado. Esta tela não cobra nada: só verifica, pelo e-mail, se o
 * acesso já foi liberado (login cria a conta se não existir, mas sem créditos/is_paid_member —
 * só o webhook concede isso).
 */
export const PaywallCheckoutPage: React.FC<PaywallCheckoutPageProps> = ({
  onPaymentComplete,
  onOpenLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noAccessFound, setNoAccessFound] = useState(false);

  const handleCheckAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Por favor, preencha seu nome e e-mail para continuar.');
      return;
    }

    setErrorMessage('');
    setNoAccessFound(false);
    setIsChecking(true);

    try {
      const user = await loginByEmail(email.trim(), name.trim());
      saveStoredUser(user);

      if (user.isPaidMember) {
        onPaymentComplete(user);
        return;
      }

      setNoAccessFound(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível continuar. Tente novamente.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <Lock className="w-3.5 h-3.5" /> Acesso à Área de Membros
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-slate-100 tracking-tight">
          Entrar na Sua Conta de Homenagens
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Informe o e-mail usado na sua compra para liberar acesso ao painel de criação de vídeos, gravação de áudio/vídeo e cartões digitais.
        </p>
      </div>

      {/* Main Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <form onSubmit={handleCheckAccess} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-semibold">
              {errorMessage}
            </div>
          )}

          {noAccessFound && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-xl space-y-3">
              <p className="font-semibold">
                Ainda não encontramos uma compra confirmada para este e-mail. Se você já comprou, a liberação pode levar alguns instantes — tente novamente em breve.
              </p>
              <a
                href={SALES_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-300 hover:underline font-bold text-xs"
              >
                Ainda não comprou? Garanta seu acesso aqui <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Seu Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Usado na Compra</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isChecking}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-base rounded-2xl shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Verificando acesso...
              </span>
            ) : (
              <>
                ACESSAR ÁREA DE MEMBROS VIP <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Acesso liberado automaticamente após a confirmação do pagamento</span>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-slate-800 space-y-2">
          <a
            href={SALES_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-amber-400 hover:underline font-bold text-xs"
          >
            Ainda não é membro? Conheça os planos <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onOpenLogin}
            className="block mx-auto text-xs text-slate-400 hover:underline font-bold"
          >
            Já é membro? Entrar com seu e-mail cadastrado
          </button>
        </div>
      </div>
    </div>
  );
};
