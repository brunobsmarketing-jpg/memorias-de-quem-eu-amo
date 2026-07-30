import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MERCADOPAGO_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';

/** Enquanto as credenciais reais da Mercado Pago não são configuradas na Railway, o servidor
 * inteiro continua no ar (não é uma env var obrigatória) — só as rotas de pagamento recusam
 * a operação com uma mensagem clara em vez de tentar chamar a API com um token vazio. */
export function isMercadoPagoConfigured(): boolean {
  return !!MERCADOPAGO_ACCESS_TOKEN;
}

export function isMercadoPagoWebhookConfigured(): boolean {
  return !!MERCADOPAGO_WEBHOOK_SECRET;
}

export function getMercadoPagoWebhookSecret(): string {
  return MERCADOPAGO_WEBHOOK_SECRET;
}

const mpConfig = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });

export const mpPreferenceClient = new Preference(mpConfig);
export const mpPaymentClient = new Payment(mpConfig);
