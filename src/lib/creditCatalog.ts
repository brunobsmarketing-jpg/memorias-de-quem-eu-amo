import { CREDIT_PACKAGES } from '../data/presets';
import { CreditPackage } from '../types';

/**
 * Fonte única da verdade de preço/créditos por pacote, usada no servidor para criar a
 * preferência de pagamento na Mercado Pago. Reaproveita o mesmo catálogo exibido ao usuário
 * em CREDIT_PACKAGES (presets.ts) — nunca confiamos em credits/preço vindos do cliente.
 */
export function getCreditPackageById(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId);
}
