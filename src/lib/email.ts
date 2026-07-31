import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Memora <acesso@mail.memoriasdequemeuamo.com.br>';
const APP_LOGIN_URL = (process.env.APP_URL || 'https://app.memoriasdequemeuamo.com.br').replace(/\/$/, '');

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Dispara o e-mail de "acesso liberado" logo após o webhook da Payt confirmar a compra inicial —
 * sem isso, quem compra não tem nenhuma instrução de como entrar (o login é só por e-mail, sem
 * senha, então a pessoa precisa saber que deve digitar o mesmo e-mail da compra em
 * app.memoriasdequemeuamo.com.br). Nunca lança erro pra fora: falha de envio de e-mail não pode
 * derrubar a concessão de crédito, que já aconteceu antes desta chamada.
 */
export async function sendAccessGrantedEmail(params: { to: string; name?: string; credits: number }): Promise<void> {
  if (!resend) {
    console.warn(`E-mail de acesso não enviado para ${params.to} — RESEND_API_KEY não configurada.`);
    return;
  }

  const firstName = (params.name || '').trim().split(' ')[0] || '';
  const greeting = firstName ? `Oi, ${firstName}!` : 'Oi!';

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">${greeting} 💛</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Seu pagamento foi confirmado e seu acesso à <strong>Memora</strong> já está liberado,
        com <strong>${params.credits} crédito(s)</strong> na sua conta — cada crédito gera um vídeo ou Livro de
        Memórias completo, em HD, sem marca d'água.
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Para entrar, é só acessar o link abaixo e informar o mesmo e-mail que você usou na compra
        (<strong>${params.to}</strong>) — não é preciso senha.
      </p>
      <a href="${APP_LOGIN_URL}" style="display: inline-block; background: linear-gradient(to right, #f59e0b, #f97316); color: #000; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none;">
        Acessar Minha Conta
      </a>
      <p style="font-size: 12px; color: #64748b; margin: 24px 0 0;">
        ${APP_LOGIN_URL}
      </p>
    </div>
  `.trim();

  const text = `${greeting}\n\nSeu pagamento foi confirmado e seu acesso à Memora já está liberado, com ${params.credits} crédito(s) na sua conta.\n\nPara entrar, acesse ${APP_LOGIN_URL} e informe o mesmo e-mail da compra (${params.to}) — não é preciso senha.`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: 'Seu acesso foi liberado! 🎉',
      html,
      text,
    });
    if (error) throw error;
    console.log(`📧 E-mail de acesso enviado para ${params.to}`);
  } catch (error: any) {
    console.error(`Falha ao enviar e-mail de acesso para ${params.to}:`, error?.message || error);
  }
}

/**
 * Dispara o e-mail com o link do vídeo liberado no funil "crie primeiro, pague depois" — a
 * pessoa já criou e viu o vídeo com marca d'água ANTES de pagar, então o link direto do cartão
 * digital (/c/{id}, público, sem login) é o destino mais relevante logo de cara. Quem compra por
 * esse funil também vira sócia com créditos (mesma oferta da página de vendas principal, ver
 * grantInitialAccessByEmail em server.ts) — quando remainingCredits é informado, o e-mail avisa
 * sobre os créditos restantes e como entrar na área de membros pra criar mais homenagens.
 */
export async function sendTrialVideoUnlockedEmail(params: { to: string; name?: string; cardUrl: string; remainingCredits?: number }): Promise<void> {
  if (!resend) {
    console.warn(`E-mail de vídeo liberado não enviado para ${params.to} — RESEND_API_KEY não configurada.`);
    return;
  }

  const firstName = (params.name || '').trim().split(' ')[0] || '';
  const greeting = firstName ? `Oi, ${firstName}!` : 'Oi!';

  const hasRemainingCredits = typeof params.remainingCredits === 'number';
  const creditsParagraphHtml = hasRemainingCredits
    ? `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Seu pagamento também liberou o acesso à sua conta Memora, com
        <strong>${params.remainingCredits} crédito(s)</strong> restante(s) pra criar novas homenagens (vídeo ou
        Livro de Memórias). Para entrar, acesse <strong>${APP_LOGIN_URL}</strong> e informe o mesmo e-mail
        desta compra (${params.to}) — não é preciso senha.
      </p>`
    : '';
  const creditsParagraphText = hasRemainingCredits
    ? `\n\nSeu pagamento também liberou o acesso à sua conta Memora, com ${params.remainingCredits} crédito(s) restante(s) pra criar novas homenagens. Para entrar, acesse ${APP_LOGIN_URL} e informe o mesmo e-mail desta compra (${params.to}) — não é preciso senha.`
    : '';

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">${greeting} 💛</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Seu pagamento foi confirmado e seu vídeo em HD, <strong>sem marca d'água</strong>, já está pronto —
        é só acessar o link abaixo pra assistir e baixar.
      </p>
      <a href="${params.cardUrl}" style="display: inline-block; background: linear-gradient(to right, #f59e0b, #f97316); color: #000; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none;">
        Ver Meu Vídeo
      </a>
      <p style="font-size: 12px; color: #64748b; margin: 24px 0 0 0;">
        ${params.cardUrl}
      </p>
      ${creditsParagraphHtml}
    </div>
  `.trim();

  const text = `${greeting}\n\nSeu pagamento foi confirmado e seu vídeo em HD, sem marca d'água, já está pronto: ${params.cardUrl}${creditsParagraphText}`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: 'Seu vídeo está pronto! 🎉',
      html,
      text,
    });
    if (error) throw error;
    console.log(`📧 E-mail de vídeo liberado enviado para ${params.to}`);
  } catch (error: any) {
    console.error(`Falha ao enviar e-mail de vídeo liberado para ${params.to}:`, error?.message || error);
  }
}
