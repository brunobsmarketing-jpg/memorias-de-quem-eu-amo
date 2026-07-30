/**
 * Inicia a cobrança real de um pacote de créditos: o servidor cria a preferência de pagamento
 * na Mercado Pago e devolve a URL do checkout hospedado por eles (PIX, boleto ou cartão) —
 * o navegador é redirecionado pra lá, nunca coleta dado de pagamento dentro deste app.
 * Os créditos só entram na conta quando a Mercado Pago confirma via webhook, não aqui.
 */
export async function createCheckoutPreference(params: {
  packageId: string;
  sessionToken: string;
}): Promise<{ initPoint: string }> {
  const response = await fetch('/api/checkout/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': params.sessionToken },
    body: JSON.stringify({ packageId: params.packageId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Não foi possível iniciar o pagamento.');
  }
  const data = await response.json();
  return { initPoint: data.initPoint };
}
