import React, { useState } from 'react';
import {
  Heart,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { User, CreditPackage } from '../types';
import { CREDIT_PACKAGES } from '../data/presets';
import { saveStoredUser } from '../lib/credits';
import { checkoutCredits } from '../lib/authApi';

interface PaywallCheckoutPageProps {
  onPaymentComplete: (user: User) => void;
  onOpenLogin: () => void;
}

export const PaywallCheckoutPage: React.FC<PaywallCheckoutPageProps> = ({
  onPaymentComplete,
  onOpenLogin,
}) => {
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage>(CREDIT_PACKAGES[1] || CREDIT_PACKAGES[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Por favor, preencha seu nome e e-mail para acessar sua conta.');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const paidUser = await checkoutCredits({
        email: email.trim(),
        name: name.trim(),
        packageId: selectedPkg.id,
        credits: selectedPkg.credits,
        amountBRL: selectedPkg.priceBRL,
      });
      saveStoredUser(paidUser);
      onPaymentComplete(paidUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível concluir a compra. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <Lock className="w-3.5 h-3.5" /> Acesso à Área de Membros
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Entrar na Sua Conta de Homenagens
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Informe seus dados de compra para liberar acesso imediato ao painel de criação de vídeos, gravação de áudio/vídeo e cartões digitais.
        </p>
      </div>

      {/* Main Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-3 border-b border-slate-800 pb-5">
          <h3 className="font-bold text-slate-200 text-sm">Selecione seu Plano de Créditos da Conta:</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CREDIT_PACKAGES.map((pkg) => {
              const isSelected = selectedPkg.id === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all text-left ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-extrabold text-slate-100 text-sm">
                    {pkg.credits} Crédito(s)
                  </span>
                  <span className="block text-xs text-amber-400 font-bold mt-1">
                    {pkg.priceFormatted}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleCheckoutSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-semibold">
              {errorMessage}
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Cadastrado na Compra</label>
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
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2 mt-4"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Acessando Área de Membros...
              </span>
            ) : (
              <>
                ACESSAR ÁREA DE MEMBROS VIP <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Acesso instantâneo e liberado</span>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onOpenLogin}
            className="text-xs text-amber-400 hover:underline font-bold"
          >
            Já é membro? Entrar com seu e-mail cadastrado
          </button>
        </div>
      </div>
    </div>
  );
};
