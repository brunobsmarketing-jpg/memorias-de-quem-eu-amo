export interface PaytProductDef {
  credits: number;
  packageId: string;
  // 'membership' (padrão, quando ausente) = compra inicial normal, vira sócio com créditos via
  // grantInitialAccessByEmail. 'single-video-unlock' = funil "crie primeiro, pague depois": em
  // vez de conceder créditos, libera o vídeo com marca d'água mais recente daquele e-mail (ver
  // unlockMostRecentWatermarkedVideoByEmail em server.ts).
  unlockType?: 'membership' | 'single-video-unlock';
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
  // TODO: substituir 'TROCAR_PELO_CODIGO_REAL' pelo product.code real do produto de vídeo avulso
  // assim que ele for criado no painel da Payt (mesmo processo usado pra confirmar o LGA6NY: o
  // payload bruto do primeiro evento de teste aparece no log da Railway). Enquanto isso, o
  // webhook falha fechado pra esse produto — nenhum vídeo é liberado indevidamente.
  TROCAR_PELO_CODIGO_REAL: { credits: 0, packageId: 'payt-video-avulso', unlockType: 'single-video-unlock' },
};

/**
 * Link de checkout da Payt pro produto de vídeo avulso (funil "crie primeiro, pague depois") —
 * diferente do produto de assinatura (SALES_PAGE_URL em src/data/presets.ts), a Payt gera um
 * link de checkout por produto, então esse é um link à parte. Não é informação sensível (é pra
 * ser clicado por qualquer visitante), então fica hardcoded aqui como o SALES_PAGE_URL, sem
 * precisar de variável de ambiente.
 */
export const PAYT_TRIAL_UNLOCK_CHECKOUT_URL = 'https://checkout.payt.com.br/61f7dbb5551741c6974a6fe7fc32b454';

export function getPaytProductById(productId: string): PaytProductDef | undefined {
  return PAYT_PRODUCT_CATALOG[productId];
}
