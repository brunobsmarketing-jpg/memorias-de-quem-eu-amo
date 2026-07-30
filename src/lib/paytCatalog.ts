export interface PaytProductDef {
  credits: number;
  packageId: string;
}

/**
 * Mapa product.code da Payt -> quantidade de créditos liberados no primeiro acesso.
 * A Payt é usada só para a COMPRA INICIAL (virar membro pago) — compras adicionais de créditos
 * acontecem pela Mercado Pago (ver src/lib/creditCatalog.ts).
 *
 * 'LGA6NY' = "Memora - Aplicativo Celebração Dia dos Pais", confirmado numa venda PIX real de
 * teste em 2026-07-30 (R$ 5,00 na ocasião — o preço na Payt ainda será ajustado para R$ 29,90
 * pela oferta real de 5 créditos, mas o código do produto continua o mesmo).
 *
 * Enquanto um product.code não estiver mapeado aqui, o webhook falha fechado: não libera crédito
 * nenhum pra um produto desconhecido, só registra um erro claro no log em vez de chutar uma
 * quantidade — importante se um novo produto/oferta for criado na Payt no futuro.
 */
export const PAYT_PRODUCT_CATALOG: Record<string, PaytProductDef> = {
  LGA6NY: { credits: 5, packageId: 'payt-5-creditos' },
};

export function getPaytProductById(productId: string): PaytProductDef | undefined {
  return PAYT_PRODUCT_CATALOG[productId];
}
