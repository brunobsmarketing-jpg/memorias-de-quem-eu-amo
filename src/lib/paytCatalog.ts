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
 * '4N6QVO' = mesma oferta de 5 créditos (R$ 29,90), vendida pelo funil alternativo "crie
 * primeiro, pague depois" (rota /experimente) — produto separado na Payt só porque o checkout
 * precisa de um link próprio, mas concede exatamente o mesmo (vira sócio com 5 créditos). Quando
 * o webhook processa esse produto, além de conceder os créditos, o vídeo com marca d'água que a
 * pessoa já criou e viu é finalizado automaticamente (consome 1 dos 5 créditos) — ver o webhook
 * em server.ts, que verifica isso pra QUALQUER produto, não só este.
 *
 * Enquanto um product.code não estiver mapeado aqui, o webhook falha fechado: não libera crédito
 * nenhum pra um produto desconhecido, só registra um erro claro no log em vez de chutar uma
 * quantidade — importante se um novo produto/oferta for criado na Payt no futuro.
 */
export const PAYT_PRODUCT_CATALOG: Record<string, PaytProductDef> = {
  LGA6NY: { credits: 5, packageId: 'payt-5-creditos' },
  '4N6QVO': { credits: 5, packageId: 'payt-5-creditos' },
};

/**
 * Link de checkout da Payt pro produto de 5 créditos vendido pelo funil "crie primeiro, pague
 * depois" (mesma oferta e preço do link de vendas principal, produto Payt separado — ver
 * PAYT_PRODUCT_CATALOG acima). Não é informação sensível (é pra ser clicado por qualquer
 * visitante), então fica hardcoded aqui como o SALES_PAGE_URL, sem precisar de variável de
 * ambiente.
 */
export const PAYT_TRIAL_UNLOCK_CHECKOUT_URL = 'https://checkout.payt.com.br/61f7dbb5551741c6974a6fe7fc32b454';

export function getPaytProductById(productId: string): PaytProductDef | undefined {
  return PAYT_PRODUCT_CATALOG[productId];
}
