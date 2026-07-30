const PAYT_WEBHOOK_SECRET = process.env.PAYT_WEBHOOK_SECRET || '';

/** A Payt não documenta um esquema de assinatura HMAC (ao contrário da Mercado Pago) — o formato
 * real do webhook ainda é desconhecido até o primeiro evento de teste chegar. Por isso a
 * autenticação aqui é um token secreto embutido na própria URL do webhook (configurado no painel
 * da Payt), não um header assinado. Ainda assim, fail-closed: sem o secret configurado, o
 * servidor recusa qualquer notificação em vez de processar sem verificação nenhuma. */
export function isPaytWebhookConfigured(): boolean {
  return !!PAYT_WEBHOOK_SECRET;
}

export function getPaytWebhookSecret(): string {
  return PAYT_WEBHOOK_SECRET;
}
