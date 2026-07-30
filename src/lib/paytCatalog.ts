export interface PaytProductDef {
  credits: number;
  packageId: string;
}

/**
 * Mapa productId/offerId da Payt -> quantidade de créditos liberados no primeiro acesso.
 * A Payt é usada só para a COMPRA INICIAL (virar membro pago) — compras adicionais de créditos
 * acontecem pela Mercado Pago (ver src/lib/creditCatalog.ts).
 *
 * Os IDs abaixo são placeholders: ninguém sabe ainda o productId/offerId real que a Payt manda
 * no payload do webhook, porque nenhum evento de teste foi recebido até agora. Substitua a
 * chave 'PLACEHOLDER_ACESSO_INICIAL' pelo ID real assim que o primeiro evento chegar (o payload
 * bruto é logado no console do servidor em /api/webhook/payt/:token justamente pra isso).
 *
 * Enquanto o ID real não é conhecido, o webhook falha fechado: não libera crédito nenhum pra um
 * productId não mapeado, só registra um erro claro no log em vez de chutar uma quantidade.
 */
export const PAYT_PRODUCT_CATALOG: Record<string, PaytProductDef> = {
  PLACEHOLDER_ACESSO_INICIAL: { credits: 1, packageId: 'payt-acesso-inicial' },
};

export function getPaytProductById(productId: string): PaytProductDef | undefined {
  return PAYT_PRODUCT_CATALOG[productId];
}
