import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { User, CreditPackage } from '../types';
import { CREDIT_PACKAGES } from '../data/presets';
import { createCheckoutPreference } from '../lib/paymentApi';

interface BuyCreditsModalProps {
  user: User;
  onClose: () => void;
}

/** Modal de recarga de créditos (Mercado Pago) — extraído do Dashboard pra poder ser aberto de
 * qualquer lugar do app (cabeçalho, rodapé, dentro da área de membros), não só de dentro dela. */
export const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({ user, onClose }) => {
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage>(CREDIT_PACKAGES[1] || CREDIT_PACKAGES[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [buyError, setBuyError] = useState('');

  // Manda pro checkout hospedado pela Mercado Pago — os créditos só entram na conta quando o
  // pagamento é confirmado via webhook (ver server.ts), nunca diretamente por esta tela.
  const handleBuyCredits = async () => {
    setIsProcessingPayment(true);
    setBuyError('');
    try {
      const { initPoint } = await createCheckoutPreference({
        packageId: selectedPkg.id,
        sessionToken: user.sessionToken || '',
      });
      window.location.href = initPoint;
    } catch (e: any) {
      console.error('Erro ao iniciar pagamento:', e);
      setBuyError(e.message || 'Não foi possível iniciar o pagamento. Tente novamente.');
      setIsProcessingPayment(false);
    }
  };

  return (
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
            onClick={onClose}
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

        {buyError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-semibold">
            {buyError}
          </div>
        )}

        <button
          onClick={handleBuyCredits}
          disabled={isProcessingPayment}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isProcessingPayment ? 'Redirecionando...' : `Pagar ${selectedPkg.priceFormatted} com Mercado Pago`}
        </button>

        <p className="text-[11px] text-slate-500 text-center">
          Você será redirecionado para o checkout seguro da Mercado Pago (PIX, boleto ou cartão).
        </p>
      </div>
    </div>
  );
};
