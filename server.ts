import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import OpenAI from 'openai';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { supabaseAdmin, MEDIA_BUCKET } from './src/lib/supabaseAdmin';
import { assertRequiredEnv, warnMissingEnv } from './src/lib/envCheck';
import {
  isMercadoPagoConfigured,
  isMercadoPagoWebhookConfigured,
  getMercadoPagoWebhookSecret,
  mpPreferenceClient,
  mpPaymentClient,
} from './src/lib/mercadoPago';
import { getCreditPackageById } from './src/lib/creditCatalog';
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import { isPaytWebhookConfigured, getPaytWebhookSecret } from './src/lib/payt';
import { getPaytProductById } from './src/lib/paytCatalog';

// Falha rápido com uma mensagem clara se faltar uma env var essencial ao funcionamento básico
// do app — evita crash-loops confusos como o que já aconteceu (ver src/lib/envCheck.ts).
assertRequiredEnv([
  { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
  { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
  { name: 'ELEVENLABS_API_KEY', value: process.env.ELEVENLABS_API_KEY },
]);
// Mercado Pago é opcional no boot (o app inteiro não deve cair só porque o pagamento ainda não
// foi configurado) — as próprias rotas de pagamento recusam a operação com erro claro.
warnMissingEnv([
  { name: 'MERCADOPAGO_ACCESS_TOKEN', value: process.env.MERCADOPAGO_ACCESS_TOKEN },
  { name: 'MERCADOPAGO_WEBHOOK_SECRET', value: process.env.MERCADOPAGO_WEBHOOK_SECRET },
  { name: 'PAYT_WEBHOOK_SECRET', value: process.env.PAYT_WEBHOOK_SECRET },
]);

const app = express();
// Railway roda atrás de um proxy — sem isso, express-rate-limit (e qualquer coisa que use
// req.ip) enxerga o IP do proxy em toda requisição, não o do cliente real.
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Limitadores de taxa: as rotas de IA custam dinheiro real por chamada (OpenAI/ElevenLabs) e as
// de pagamento/sessão são alvo natural de força-bruta — nenhuma tinha proteção nenhuma antes.
const aiGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições em pouco tempo. Aguarde alguns minutos e tente novamente.' },
});
const expensiveAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições em pouco tempo. Aguarde alguns minutos e tente novamente.' },
});
const renderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de renderizações por hora atingido. Tente novamente mais tarde.' },
});
const accountLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.' },
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve a pasta de vídeos renderizados em MP4
const rendersPath = path.join(process.cwd(), 'public', 'renders');
if (!fs.existsSync(rendersPath)) {
  fs.mkdirSync(rendersPath, { recursive: true });
}
app.use('/renders', express.static(rendersPath));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * Fila de renderização de vídeo — o FFmpeg é pesado em CPU/memória, e o servidor roda em
 * um plano com pouca RAM (ver render.yaml). Sem isso, duas pessoas gerando vídeo ao mesmo
 * tempo derrubariam o processo inteiro (OOM) para todo mundo, não só para quem gerou.
 * Limita quantas renderizações rodam de verdade ao mesmo tempo; o resto espera na fila em
 * vez de competir por memória. Ajustável via RENDER_CONCURRENCY sem precisar mudar código
 * (ex: depois de migrar para um plano com mais RAM).
 */
class RenderQueue {
  private readonly maxConcurrent: number;
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  get position(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}

const RENDER_CONCURRENCY = process.env.RENDER_CONCURRENCY ? parseInt(process.env.RENDER_CONCURRENCY, 10) : 1;
const renderQueue = new RenderQueue(RENDER_CONCURRENCY);

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// OpenAI client (DALL-E 3)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Memórias de Quem Eu Amo' });
});

// Envia um arquivo (foto, áudio, imagem gerada por IA) em base64 para o Supabase Storage
// e devolve a URL pública permanente — usado para tirar as mídias do localStorage do navegador.
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'video/webm',
  'video/mp4',
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB — generoso o bastante pra fotos/áudio, sem deixar um único upload monopolizar o body limit de 50MB do servidor.

app.post('/api/upload-media', accountLimiter, async (req, res) => {
  try {
    const { dataUrl, folder } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl inválido' });
    }

    const [meta, base64Data] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: `Tipo de arquivo não suportado: ${mimeType}` });
    }
    const extension = mimeType.split('/')[1]?.split('+')[0] || 'bin';
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: `Arquivo muito grande (máximo ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB).` });
    }

    const safeFolder = (folder || 'misc').replace(/[^a-zA-Z0-9_/-]/g, '').replace(/\.\./g, '');
    const filePath = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
    res.json({ url: data.publicUrl });
  } catch (error: any) {
    console.error('Erro no upload de mídia:', error);
    res.status(500).json({ error: 'Falha ao enviar arquivo para o armazenamento', details: error.message });
  }
});

function mapUserRow(data: any) {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    credits: data.credits,
    isPaidMember: data.is_paid_member,
    planName: data.plan_name,
    createdAt: data.created_at,
    sessionToken: data.session_token,
  };
}

/** Garante que o usuário tem um session_token — gera e persiste na primeira vez que faltar
 * (contas criadas antes desta coluna existir, ou linhas criadas via FK em /api/videos antes do
 * primeiro login). Esse token é o que prova, nas próximas requisições, que quem está chamando
 * a API realmente é dono daquele userId — sem ele, qualquer cliente podia mandar um userId
 * alheio (visível no localStorage/rede) e mexer na conta de outra pessoa. */
async function ensureSessionToken(userRow: any): Promise<any> {
  if (userRow.session_token) return userRow;
  const token = crypto.randomUUID();
  const { data: updated, error } = await supabaseAdmin
    .from('app_users')
    .update({ session_token: token })
    .eq('id', userRow.id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

interface AuthedRequest extends express.Request {
  authenticatedUserId?: string;
  authenticatedUserEmail?: string;
}

/** Resolve o dono real da requisição a partir do header x-session-token, em vez de confiar no
 * userId que o corpo da requisição alega ser. Aplicado só nas rotas que agem "em nome de" um
 * usuário (deduzir crédito, salvar vídeo/livro, criar preferência de pagamento). */
async function requireOwnership(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-session-token');
  if (!token) {
    return res.status(401).json({ error: 'Sessão ausente. Faça login novamente.' });
  }
  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('id, email')
    .eq('session_token', token)
    .maybeSingle();
  if (error) {
    console.error('Erro ao validar sessão:', error);
    return res.status(500).json({ error: 'Falha ao validar sessão' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
  req.authenticatedUserId = user.id;
  req.authenticatedUserEmail = user.email;
  next();
}

// Login simples por e-mail: não usa senha (não temos essa infraestrutura ainda),
// só busca a conta real pelo e-mail. Se não existir, cria uma conta SEM créditos —
// diferente do comportamento antigo que dava 3 créditos grátis para qualquer e-mail digitado.
app.post('/api/users/login', accountLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: existing, error: findError } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const withToken = await ensureSessionToken(existing);
      return res.json({ user: mapUserRow(withToken) });
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      credits: 0,
      is_paid_member: false,
      plan_name: null,
      session_token: crypto.randomUUID(),
    };
    const { data: created, error: insertError } = await supabaseAdmin
      .from('app_users')
      .insert(newUser)
      .select()
      .single();
    if (insertError) throw insertError;

    res.json({ user: mapUserRow(created), isNewAccount: true });
  } catch (error: any) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Falha ao entrar na conta', details: error.message });
  }
});

// Cria a preferência de pagamento (Checkout Pro) para um pacote de créditos e devolve a URL de
// redirecionamento — o cliente é enviado para o checkout hospedado pela Mercado Pago (que já
// resolve PIX/boleto/cartão), nunca digita dados de pagamento dentro deste app. Créditos só são
// liberados de fato quando o webhook (abaixo) confirma o pagamento aprovado — esta rota nunca
// concede crédito nenhum, só inicia a cobrança.
app.post('/api/checkout/create-preference', accountLimiter, requireOwnership, async (req: AuthedRequest, res) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({ error: 'Pagamentos ainda não configurados neste servidor.' });
    }

    const { packageId } = req.body;
    const pkg = getCreditPackageById(String(packageId || ''));
    if (!pkg) {
      return res.status(400).json({ error: 'Pacote de créditos inválido.' });
    }

    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const preference = await mpPreferenceClient.create({
      body: {
        items: [
          {
            id: pkg.id,
            title: pkg.description || `${pkg.credits} crédito(s) — Memórias de Quem Eu Amo`,
            quantity: 1,
            unit_price: pkg.priceBRL,
            currency_id: 'BRL',
          },
        ],
        payer: { email: req.authenticatedUserEmail },
        // userId::packageId — o webhook usa isso pra saber quem creditar e quanto, sem depender
        // de metadata (a API da Mercado Pago costuma normalizar as chaves de metadata) nem de
        // confiar em valor algum vindo do corpo da notificação.
        external_reference: `${req.authenticatedUserId}::${pkg.id}`,
        notification_url: `${appUrl}/api/webhook/mercadopago`,
        back_urls: {
          success: `${appUrl}/?payment=success`,
          pending: `${appUrl}/?payment=pending`,
          failure: `${appUrl}/?payment=failure`,
        },
        auto_return: 'approved',
      },
    });

    const initPoint = preference.init_point || preference.sandbox_init_point;
    if (!initPoint) throw new Error('Mercado Pago não retornou um link de checkout.');

    res.json({ initPoint });
  } catch (error: any) {
    console.error('Erro ao criar preferência de pagamento:', error);
    res.status(500).json({ error: 'Falha ao iniciar o pagamento', details: error.message });
  }
});

// Webhook da Mercado Pago — única rota que efetivamente concede créditos. Verifica a assinatura
// HMAC (x-signature) usando o secret configurado em "Suas integrações" > Webhooks no painel da
// Mercado Pago antes de confiar em qualquer dado do payload, e é idempotente (não credita duas
// vezes o mesmo pagamento em caso de reenvio).
app.post('/api/webhook/mercadopago', webhookLimiter, async (req, res) => {
  try {
    if (!isMercadoPagoWebhookConfigured()) {
      console.error('Webhook Mercado Pago recebido, mas MERCADOPAGO_WEBHOOK_SECRET não está configurado — recusando.');
      return res.status(503).json({ error: 'Webhook não configurado' });
    }

    try {
      WebhookSignatureValidator.validate({
        xSignature: req.header('x-signature'),
        xRequestId: req.header('x-request-id'),
        dataId: req.query['data.id'] as string | undefined,
        secret: getMercadoPagoWebhookSecret(),
        toleranceSeconds: 300,
      });
    } catch (sigError: any) {
      const reason = sigError instanceof InvalidWebhookSignatureError ? sigError.reason : 'unknown';
      console.error(`Webhook Mercado Pago rejeitado — assinatura inválida (motivo: ${reason}).`);
      return res.status(401).json({ error: 'Assinatura inválida' });
    }

    // Responde 200 logo após validar a assinatura, para a Mercado Pago não ficar retentando —
    // o processamento em si (buscar o pagamento, creditar) continua depois em segundo plano.
    res.json({ received: true });

    const paymentId = req.body?.data?.id || (req.query['data.id'] as string | undefined);
    if (!paymentId) {
      console.error('Webhook Mercado Pago: notificação sem data.id, ignorando.');
      return;
    }

    const payment = await mpPaymentClient.get({ id: paymentId });
    const externalReference = payment.external_reference || '';
    const [userId, packageId] = externalReference.split('::');
    if (!userId || !packageId) {
      console.error(`Webhook Mercado Pago: external_reference inesperado ("${externalReference}") no pagamento ${paymentId}.`);
      return;
    }

    // Idempotência: se este pagamento já foi processado (reenvio de notificação), não credita de novo.
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('external_id', String(paymentId))
      .maybeSingle();

    if (payment.status === 'approved') {
      if (existingPayment) {
        console.log(`Webhook Mercado Pago: pagamento ${paymentId} já processado, ignorando reenvio.`);
        return;
      }
      const pkg = getCreditPackageById(packageId);
      if (!pkg) {
        console.error(`Webhook Mercado Pago: packageId desconhecido ("${packageId}") no pagamento ${paymentId}.`);
        return;
      }

      const { data: user, error: findError } = await supabaseAdmin
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (findError) throw findError;
      if (!user) {
        console.error(`Webhook Mercado Pago: usuário ${userId} não encontrado para o pagamento ${paymentId}.`);
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from('app_users')
        .update({
          credits: user.credits + pkg.credits,
          is_paid_member: true,
          plan_name: pkg.id,
        })
        .eq('id', userId);
      if (updateError) throw updateError;

      await supabaseAdmin.from('payments').insert({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId,
        package_id: pkg.id,
        amount_brl: payment.transaction_amount || pkg.priceBRL,
        credits_added: pkg.credits,
        status: 'completed',
        external_id: String(paymentId),
        gateway: 'mercadopago',
      });
      console.log(`✅ ${pkg.credits} crédito(s) liberado(s) via Mercado Pago para o usuário ${userId} (pagamento ${paymentId}).`);
      return;
    }

    if (['refunded', 'charged_back', 'cancelled'].includes(String(payment.status))) {
      // Só desfaz se este pagamento específico já tinha sido creditado antes — nunca zera a
      // conta inteira (o usuário pode ter créditos de outras compras).
      if (existingPayment && existingPayment.status === 'completed') {
        const pkg = getCreditPackageById(packageId);
        if (pkg) {
          const { data: user } = await supabaseAdmin.from('app_users').select('credits').eq('id', userId).maybeSingle();
          if (user) {
            await supabaseAdmin
              .from('app_users')
              .update({ credits: Math.max(0, user.credits - pkg.credits) })
              .eq('id', userId);
          }
        }
        await supabaseAdmin.from('payments').update({ status: String(payment.status) }).eq('id', existingPayment.id);
        console.log(`🚫 Créditos do pagamento ${paymentId} revertidos (status: ${payment.status}).`);
      }
    }
  } catch (error: any) {
    console.error('Erro ao processar webhook Mercado Pago:', error);
  }
});

/** Concede o acesso inicial (vira membro pago) a partir de uma compra confirmada pela Payt —
 * usado só pela primeira compra (feita fora do app, numa página de vendas própria). Compras
 * adicionais de créditos acontecem pela Mercado Pago (ver /api/webhook/mercadopago acima). */
async function grantInitialAccessByEmail(params: { email: string; name?: string; credits: number; packageId: string; amountBRL?: number; externalId?: string }) {
  const normalizedEmail = String(params.email).trim().toLowerCase();

  const { data: existing, error: findError } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (findError) throw findError;

  let userRow: any;
  if (existing) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        credits: existing.credits + params.credits,
        is_paid_member: true,
        plan_name: params.packageId,
        name: params.name || existing.name,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (updateError) throw updateError;
    userRow = updated;
  } else {
    const { data: created, error: insertError } = await supabaseAdmin
      .from('app_users')
      .insert({
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: params.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        credits: params.credits,
        is_paid_member: true,
        plan_name: params.packageId,
        session_token: crypto.randomUUID(),
      })
      .select()
      .single();
    if (insertError) throw insertError;
    userRow = created;
  }

  await supabaseAdmin.from('payments').insert({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userRow.id,
    package_id: params.packageId,
    amount_brl: params.amountBRL || null,
    credits_added: params.credits,
    status: 'completed',
    external_id: params.externalId || null,
    gateway: 'payt',
  });

  return userRow;
}

/** Bloqueia o acesso quando a Payt notifica cancelamento/chargeback/reembolso da compra
 * inicial — zera os créditos e derruba o status de membro pago. Diferente da Mercado Pago, aqui
 * não dá pra reverter só o valor de um pagamento específico com segurança (não confiamos ainda
 * em nenhum id de transação da Payt pra correlacionar), então zera a conta inteira — aceitável
 * porque hoje a Payt é usada só pra compra inicial (não há créditos de outras origens somados
 * quando isso acontece, exceto se a pessoa já comprou créditos extra pela Mercado Pago depois —
 * risco documentado, ajustar se isso passar a acontecer na prática). */
async function revokeInitialAccessByEmail(email: string, reason: string) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: existing, error: findError } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) {
    console.warn(`Webhook Payt: tentativa de bloquear e-mail não encontrado (${normalizedEmail}).`);
    return null;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('app_users')
    .update({ credits: 0, is_paid_member: false })
    .eq('id', existing.id)
    .select()
    .single();
  if (updateError) throw updateError;

  await supabaseAdmin.from('payments').insert({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: existing.id,
    package_id: existing.plan_name || null,
    amount_brl: null,
    credits_added: 0,
    status: reason,
    gateway: 'payt',
  });

  return updated;
}

// Webhook (postback) da Payt — usado só pra compra inicial (virar membro pago), feita numa
// página de vendas fora deste app. Autenticado por um token secreto na própria URL (configurado
// no painel da Payt), já que a Payt não documenta um esquema de assinatura HMAC como a Mercado
// Pago. Formato confirmado com uma venda PIX real de teste em 2026-07-30 (ver comentários abaixo
// nos pontos onde os nomes de campo divergiam do que a documentação de outros gateways sugeria).
app.post('/api/webhook/payt/:token', webhookLimiter, async (req, res) => {
  if (!isPaytWebhookConfigured()) {
    console.error('Webhook Payt recebido, mas PAYT_WEBHOOK_SECRET não está configurado — recusando.');
    return res.status(503).json({ error: 'Webhook não configurado' });
  }
  if (req.params.token !== getPaytWebhookSecret()) {
    console.error('Webhook Payt rejeitado — token da URL não confere.');
    return res.status(401).json({ error: 'Token inválido' });
  }

  console.log('📩 Webhook Payt recebido:', JSON.stringify(req.body));
  try {
    // Responde 200 logo após validar o token, pra Payt não ficar retentando, mesmo que ainda
    // não saibamos processar todos os formatos de evento.
    res.json({ received: true });

    const payload = req.body || {};
    const eventStatus = String(payload.status || payload.event || payload.eventName || '').toLowerCase();
    const email = payload.email || payload.customer?.email || payload.buyer?.email;

    if (!email) {
      console.error('Webhook Payt: não foi possível identificar o e-mail do comprador no payload.');
      return;
    }

    // "paid" é o status real confirmado numa venda PIX de teste (payload.status = "paid") — bem
    // diferente do que a documentação/UI em português da Payt sugeria ("Finalizada/Aprovada").
    const isApproved = eventStatus === 'paid' || /aprovad|finalizad|approved|completed/.test(eventStatus);
    // Cobre os eventos de "Cancelada - Chargeback", "Cancelada - Reembolsada" e
    // "Solicitação de Reembolso" — qualquer um deles bloqueia o acesso imediatamente.
    // OBS: o valor real do status "Cancelada" (evento também marcado no painel) ainda não foi
    // confirmado por nenhum evento de teste — enquanto não soubermos o valor exato, ele cai no
    // "ignorado" abaixo (não libera nem revoga nada), que é o comportamento seguro por padrão.
    const isRevoked = /reembols|chargeback|estorn|refund|dispute/.test(eventStatus);

    if (isRevoked) {
      await revokeInitialAccessByEmail(email, eventStatus || 'refunded');
      console.log(`🚫 Acesso bloqueado via webhook Payt (evento "${eventStatus}") para ${email}`);
      return;
    }

    if (!isApproved) {
      console.log(`Webhook Payt ignorado (evento "${eventStatus}" não é de aprovação nem de reembolso).`);
      return;
    }

    const name = payload.name || payload.customer?.name || payload.buyer?.name;
    // product.code (ex: "LGA6NY") é o identificador real confirmado — product.id não existe no
    // payload da Payt (fica como fallback só por precaução, caso o formato mude no futuro).
    const productId = String(payload.productId || payload.offerId || payload.product?.code || payload.product?.id || '');
    // Valor vem em centavos (ex: 500 = R$ 5,00) — mesma convenção de Stripe/Mercado Pago.
    const rawAmount = payload.transaction?.total_price ?? payload.product?.price ?? payload.amount ?? payload.total ?? payload.price;
    const amountBRL = typeof rawAmount === 'number' ? rawAmount / 100 : undefined;
    // transaction_id (snake_case) é o campo real confirmado — os demais ficam como fallback.
    const rawExternalId = payload.transaction_id || payload.id || payload.transactionId || payload.orderId || payload.saleId;
    const externalId = rawExternalId ? `payt:${rawExternalId}` : undefined;

    const product = getPaytProductById(productId);
    if (!product) {
      console.error(`Webhook Payt: productId desconhecido ("${productId}") — nenhum crédito liberado. Atualize src/lib/paytCatalog.ts com o ID real.`);
      return;
    }

    await grantInitialAccessByEmail({ email, name, credits: product.credits, packageId: product.packageId, amountBRL, externalId });
    console.log(`✅ ${product.credits} crédito(s) liberado(s) via webhook Payt para ${email}`);
  } catch (error: any) {
    console.error('Erro ao processar webhook Payt:', error);
  }
});

// Deduz 1 crédito do usuário de forma atômica no servidor — a liberação de HD não pode
// confiar só no localStorage, senão o mesmo crédito poderia ser "reusado" em outro dispositivo.
// Age sempre sobre o usuário autenticado pelo session_token, nunca sobre o userId do corpo —
// senão qualquer cliente podia deduzir crédito da conta de outra pessoa só sabendo o id dela.
app.post('/api/users/deduct-credit', requireOwnership, async (req: AuthedRequest, res) => {
  try {
    const userId = req.authenticatedUserId!;

    const { data: user, error: findError } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (findError) throw findError;
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.credits < 1) {
      return res.status(400).json({ error: 'Créditos insuficientes' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({ credits: user.credits - 1 })
      .eq('id', userId)
      .select()
      .single();
    if (updateError) throw updateError;

    res.json({ user: mapUserRow(updated) });
  } catch (error: any) {
    console.error('Erro ao deduzir crédito:', error);
    res.status(500).json({ error: 'Falha ao deduzir crédito', details: error.message });
  }
});

const MAX_PHOTOS_PER_JOB = 30;
const MAX_AI_IMAGES_PER_JOB = 30;
const MAX_BOOK_PAGES = 40;

// Salva (cria ou atualiza) um vídeo de homenagem no banco central — é isso que faz o
// cartão digital /c/{id} funcionar em qualquer dispositivo, não só no navegador de quem criou.
// O dono do vídeo é sempre o usuário autenticado pelo session_token (nunca job.userId do corpo),
// senão qualquer cliente podia sobrescrever o vídeo de outra pessoa só sabendo o id do job.
app.post('/api/videos', requireOwnership, async (req: AuthedRequest, res) => {
  try {
    const job = req.body;
    if (!job || !job.id) {
      return res.status(400).json({ error: 'Vídeo inválido: id é obrigatório' });
    }
    if ((job.photos?.length || 0) > MAX_PHOTOS_PER_JOB || (job.aiGeneratedImages?.length || 0) > MAX_AI_IMAGES_PER_JOB) {
      return res.status(400).json({ error: 'Número de fotos/imagens excede o limite permitido.' });
    }

    const row = {
      id: job.id,
      user_id: req.authenticatedUserId,
      title: job.title,
      father_name: job.fatherName,
      photos: job.photos || [],
      tribute_text: job.tributeText,
      selected_voice_id: job.selectedVoiceId,
      is_custom_voice: !!job.isCustomVoice,
      custom_voice_audio_url: job.customVoiceAudioUrl || null,
      selected_track_id: job.selectedTrackId,
      use_ai_images: !!job.useAIImages,
      ai_generated_images: job.aiGeneratedImages || [],
      status: job.status,
      progress: job.progress,
      watermark_video_url: job.watermarkVideoUrl || null,
      unlocked_video_url: job.unlockedVideoUrl || null,
      card_url: job.cardUrl,
      created_at: job.createdAt,
      duration_seconds: job.durationSeconds,
      caption_style: job.captionStyle || null,
    };

    let { error } = await supabaseAdmin.from('video_jobs').upsert(row, { onConflict: 'id' });
    if (error && /caption_style/.test(error.message || '')) {
      // Coluna ainda não existe no banco (rodar supabase_schema.sql atualizado) — salva sem
      // o estilo de legenda em vez de quebrar o salvamento do vídeo inteiro.
      console.warn('Coluna caption_style ausente no Supabase — salvando vídeo sem o estilo de legenda.');
      const { caption_style, ...rowWithoutCaptionStyle } = row;
      ({ error } = await supabaseAdmin.from('video_jobs').upsert(rowWithoutCaptionStyle, { onConflict: 'id' }));
    }
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao salvar vídeo no Supabase:', error);
    res.status(500).json({ error: 'Falha ao salvar vídeo', details: error.message });
  }
});

// Busca um vídeo de homenagem pelo id — usado pela página de cartão digital público (/c/{id})
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('video_jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({
      video: {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        fatherName: data.father_name,
        photos: data.photos,
        tributeText: data.tribute_text,
        selectedVoiceId: data.selected_voice_id,
        isCustomVoice: data.is_custom_voice,
        customVoiceAudioUrl: data.custom_voice_audio_url,
        selectedTrackId: data.selected_track_id,
        useAIImages: data.use_ai_images,
        aiGeneratedImages: data.ai_generated_images,
        status: data.status,
        progress: data.progress,
        watermarkVideoUrl: data.watermark_video_url,
        unlockedVideoUrl: data.unlocked_video_url,
        cardUrl: data.card_url,
        createdAt: data.created_at,
        durationSeconds: data.duration_seconds,
        captionStyle: data.caption_style || undefined,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar vídeo no Supabase:', error);
    res.status(500).json({ error: 'Falha ao buscar vídeo', details: error.message });
  }
});

// Salva (cria ou atualiza) um Livro de Memórias no projeto Supabase separado deste recurso.
// Mesma regra de ownership do /api/videos: o dono é sempre o usuário autenticado pelo
// session_token, nunca book.userId do corpo.
app.post('/api/memory-books', requireOwnership, async (req: AuthedRequest, res) => {
  try {
    const book = req.body;
    if (!book || !book.id) {
      return res.status(400).json({ error: 'Livro inválido: id é obrigatório' });
    }
    if ((book.photos?.length || 0) > MAX_PHOTOS_PER_JOB || (book.pages?.length || 0) > MAX_BOOK_PAGES) {
      return res.status(400).json({ error: 'Número de fotos/páginas excede o limite permitido.' });
    }

    const row = {
      id: book.id,
      user_id: req.authenticatedUserId,
      father_name: book.fatherName,
      photos: book.photos || [],
      pages: book.pages || [],
      selected_track_id: book.selectedTrackId,
      selected_voice_id: book.selectedVoiceId,
      is_custom_voice: !!book.isCustomVoice,
      custom_voice_audio_url: book.customVoiceAudioUrl || null,
      narration_text: book.narrationText,
      status: book.status,
      progress: book.progress,
      unlocked_video_url: book.unlockedVideoUrl || null,
      card_url: book.cardUrl,
      created_at: book.createdAt,
      duration_seconds: book.durationSeconds,
    };

    const { error } = await supabaseAdmin.from('memory_book_jobs').upsert(row, { onConflict: 'id' });
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao salvar livro no Supabase:', error);
    res.status(500).json({ error: 'Falha ao salvar livro', details: error.message });
  }
});

// Busca um Livro de Memórias pelo id — usado pela página de cartão digital público (/b/{id})
app.get('/api/memory-books/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('memory_book_jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }

    res.json({
      book: {
        id: data.id,
        userId: data.user_id,
        fatherName: data.father_name,
        photos: data.photos,
        pages: data.pages,
        selectedTrackId: data.selected_track_id,
        selectedVoiceId: data.selected_voice_id,
        isCustomVoice: data.is_custom_voice,
        customVoiceAudioUrl: data.custom_voice_audio_url,
        narrationText: data.narration_text,
        status: data.status,
        progress: data.progress,
        unlockedVideoUrl: data.unlocked_video_url,
        cardUrl: data.card_url,
        createdAt: data.created_at,
        durationSeconds: data.duration_seconds,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar livro no Supabase:', error);
    res.status(500).json({ error: 'Falha ao buscar livro', details: error.message });
  }
});

// 1. Generate Emotional Tribute Text using Gemini AI
app.post('/api/generate-text', aiGenerationLimiter, async (req, res) => {
  try {
    const { fatherName, specialMemory, adjective, authorName, tone } = req.body;

    if (!fatherName) {
      return res.status(400).json({ error: 'Nome do pai é obrigatório' });
    }

    const prompt = `Você é um roteirista de vídeos emocionais e poéticos de alto impacto.
Sua missão é escrever um texto de narração profundamente tocante, humano e natural para um vídeo de homenagem ao Dia dos Pais.

INFORMAÇÕES DE BASE:
- Nome do Pai: ${fatherName}
- Nome de quem está homenageando: ${authorName || 'seu filho(a)'}
- Lembrança/história marcante: ${specialMemory || 'os momentos simples juntos, as gargalhadas e os conselhos sábios ao longo da vida'}
- Qualidade/Adjetivo marcante: ${adjective || 'exemplo de integridade, carinho e proteção'}
- Tom desejado: ${tone || 'emocionante, caloroso e nostálgico'}

DIRETRIZES DE ESTILO E CRIATIVIDADE (MUITO IMPORTANTE):
1. **NÃO SEJA ENGESSADO OU ROBÓTICO**: Evite padrões mecânicos como "Pai, ${fatherName}..." ou frases clichês repetitivas.
2. **FLUIDEZ E NATURALIDADE**: Escreva um texto orgânico, como uma conversa sincera de coração para coração. O nome do pai ou a palavra "pai" deve ser integrada de forma suave e poética no decorrer do texto, ou no momento de maior emoção.
3. **RITMO DE NARRAÇÃO**: Use frases curtas e pausadas que soem bonitas quando lidas em voz alta por um narrador professional.
4. **TAMANHO**: De 70 a 110 palavras (cerca de 35 a 50 segundos de narração).
5. **SEM FORMATAÇÃO EXTRA**: Não use emojis, hashtags ou títulos. Retorne apenas o texto da narração lírica pronto para leitura.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    });

    const generatedText = response.choices[0]?.message?.content?.trim() || '';
    res.json({ text: generatedText });
  } catch (error: any) {
    console.error('Erro na geração de texto:', error);
    res.status(500).json({ error: 'Falha ao gerar texto emocional via IA', details: error.message });
  }
});

// 2. Extract visual prompts for illustrative scenes
app.post('/api/extract-visual-themes', aiGenerationLimiter, async (req, res) => {
  try {
    const { text, fatherName, count, memoryAge, narratorGender } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }
    const sceneCount = Math.max(1, Math.min(8, Number(count) || 2));

    // Contexto de quem está homenageando (filho/filha) e a fase da vida das lembranças
    // (infância/adolescência/vida adulta) — usado para que a silhueta ao lado do pai nas
    // ilustrações combine com a história real, em vez de uma criança genérica e ambígua.
    // "auto" (padrão) deixa a IA inferir isso a partir do próprio texto da homenagem.
    const ageLabels: Record<string, string> = {
      child: 'uma criança pequena (por volta de 5 a 10 anos)',
      teen: 'um(a) adolescente (por volta de 13 a 17 anos)',
      adult: 'um(a) filho(a) já adulto(a)',
    };
    const genderLabels: Record<string, string> = {
      male: 'do sexo masculino (um filho/menino)',
      female: 'do sexo feminino (uma filha/menina)',
    };

    const contextInstruction =
      memoryAge && memoryAge !== 'auto' && genderLabels[narratorGender]
        ? `A pessoa homenageando o pai é ${genderLabels[narratorGender] || 'de gênero não especificado'}, e a lembrança retratada é de quando essa pessoa era ${ageLabels[memoryAge] || 'de idade não especificada'}. Use essas características para desenhar a silhueta/figura que acompanha o pai nas cenas (altura, proporções e presença condizentes).`
        : memoryAge && memoryAge !== 'auto'
        ? `A lembrança retratada é de quando a pessoa homenageando o pai era ${ageLabels[memoryAge] || 'de idade não especificada'}. Use isso para definir a proporção/altura da silhueta que acompanha o pai nas cenas.`
        : narratorGender && narratorGender !== 'auto'
        ? `A pessoa homenageando o pai é ${genderLabels[narratorGender] || 'de gênero não especificado'}. Use isso para definir a silhueta que acompanha o pai nas cenas.`
        : `Infira pelo próprio texto da homenagem, se houver pistas (idade mencionada, "filho"/"filha", "menina"/"menino" etc.), a idade aproximada e o gênero da pessoa que está homenageando o pai nas lembranças, e use isso para desenhar a silhueta que acompanha o pai. Se não houver nenhuma pista no texto, use uma silhueta neutra/ambígua de criança.`;

    const prompt = `Analise o texto de homenagem de Dia dos Pais a seguir e extraia exatamente ${sceneCount} cenas visuais e poéticas para ilustrações.

Texto: "${text}"

${contextInstruction}

Retorne um JSON com a lista de ${sceneCount} descrições visuais em inglês para geração de arte, com cenas diferentes entre si. As ilustrações NUNCA devem tentar simular fotos de pessoas reais específicas, mas sim conceitos simbólicos calorosos (ex: silhueta de pai e criança de mãos dadas ao pôr do sol, casa acolhedora com luz suave, árvore de carvalho forte simbolizando proteção).`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'visual_themes',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              scenes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    titlePt: { type: 'string', description: 'Título da cena em português' },
                    promptEn: { type: 'string', description: 'Prompt detalhado em inglês para estilo aquarela suave' },
                  },
                  required: ['titlePt', 'promptEn'],
                  additionalProperties: false,
                },
              },
            },
            required: ['scenes'],
            additionalProperties: false,
          },
        },
      },
    });

    const json = JSON.parse(response.choices[0]?.message?.content || '{"scenes":[]}');
    res.json(json);
  } catch (error: any) {
    console.error('Erro na extração de temas visuais:', error);
    res.status(500).json({ error: 'Falha ao extrair temas visuais', details: error.message });
  }
});

// Estilos de ilustração disponíveis para o usuário escolher no Passo 5 do wizard.
const AI_IMAGE_STYLE_PROMPTS: Record<string, string> = {
  watercolor: `Style: gentle handcrafted watercolor art, warm pastel tones, artistic and poetic, dreamlike quality.
Colors: rich sunset oranges, warm golds, soft purples and deep blues for sky, earthy warm tones for ground.`,
  realistic: `Style: photorealistic cinematic photography, soft natural lighting, warm color grading, shallow depth of field.
Colors: warm golden-hour tones, soft natural light, gentle contrast.`,
  'oil-painting': `Style: classical oil painting, rich visible brush strokes, textured canvas look, timeless fine-art quality.
Colors: warm classical palette — deep ambers, burgundy, muted gold.`,
  'flat-minimal': `Style: modern flat design illustration, clean simple vector shapes, minimalist composition, generous negative space.
Colors: warm soft pastel palette with a few bold accent tones.`,
  'sketch-bw': `Style: nostalgic hand-drawn pencil sketch, fine linework, tender and warm feeling.
Colors: black and white with subtle warm sepia undertones.`,
};

// 3. Generate AI Illustration Image using OpenAI (gpt-image-1)
app.post('/api/generate-ai-image', expensiveAiLimiter, async (req, res) => {
  try {
    const { prompt, titlePt, style } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt de imagem é obrigatório' });
    }

    const styleBlock = AI_IMAGE_STYLE_PROMPTS[style as string] || AI_IMAGE_STYLE_PROMPTS.watercolor;

    const fullPrompt = `Beautiful illustration for a Brazilian Father's Day (Dia dos Pais) tribute video.
${styleBlock}
Rules: NO realistic recognizable faces, NO text or letters anywhere in the image, symbolic and metaphorical imagery only.
Mood: warm, nostalgic, heartfelt, loving, emotional.
Scene theme: ${prompt}`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      // Sem isso, o parâmetro fica em "auto" e a API pode escolher qualidade "high" (até ~4x
      // mais caro que "medium") sem avisar — trava o custo num teto previsível por imagem.
      quality: 'medium',
    });

    const b64Image = response.data?.[0]?.b64_json;
    const imageUrl = response.data?.[0]?.url;

    let finalDataUrl = '';
    if (b64Image) {
      finalDataUrl = `data:image/png;base64,${b64Image}`;
    } else if (imageUrl) {
      const imgFetch = await fetch(imageUrl);
      const arrayBuf = await imgFetch.arrayBuffer();
      const b64 = Buffer.from(arrayBuf).toString('base64');
      finalDataUrl = `data:image/png;base64,${b64}`;
    } else {
      throw new Error('Nenhuma imagem foi retornada pela OpenAI.');
    }

    res.json({
      imageDataUrl: finalDataUrl,
      titlePt: titlePt || prompt,
    });
  } catch (error: any) {
    console.error('Erro ao gerar imagem com OpenAI:', error);
    res.status(500).json({ error: 'Falha ao gerar imagem ilustrativa', details: error.message });
  }
});

// Gera o fundo ilustrado do cartão digital imprimível — paleta de azuis vivos (diferente do
// tom laranja/pôr do sol usado nas ilustrações do vídeo), sem texto (o texto é desenhado
// depois, por cima, no canvas do cliente).
// A ilustração de fundo do cartão é genérica (não personalizada por usuário/vídeo), então
// gerar ela via IA a cada visita à página do cartão é dinheiro jogado fora — cacheamos no
// Supabase Storage num caminho fixo e reusamos pra sempre depois da primeira geração.
const CARD_BACKGROUND_STORAGE_PATH = 'branding/card-background.png';

app.post('/api/generate-card-background', expensiveAiLimiter, async (req, res) => {
  try {
    const { data: publicUrlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(CARD_BACKGROUND_STORAGE_PATH);
    const existingCheck = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
    if (existingCheck.ok) {
      return res.json({ imageUrl: publicUrlData.publicUrl, cached: true });
    }

    const cardPrompt = `Elegant vertical greeting card background illustration for a Brazilian Father's Day (Dia dos Pais) tribute card.
Style: modern flat illustration with soft gradients, festive and warm, clean vector-like shapes with gentle texture.
Rules: NO text, NO letters, NO words, NO human faces anywhere in the image — purely decorative background and symbolic imagery.
Palette: vivid blues throughout — baby blue, sky blue, royal blue and deep navy in a smooth gradient, with soft white and light gold accents.
Composition: decorative border elements, small warm symbolic accents (hearts, stars, gentle sun rays or ribbon shapes) framing empty open space in the center and bottom for text and a QR code to be added later.
Mood: celebratory, warm, loving, elegant.`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: cardPrompt,
      n: 1,
      size: '1024x1536',
      quality: 'medium',
    });

    const b64Image = response.data?.[0]?.b64_json;
    const imageUrlFromOpenAI = response.data?.[0]?.url;

    let buffer: Buffer;
    if (b64Image) {
      buffer = Buffer.from(b64Image, 'base64');
    } else if (imageUrlFromOpenAI) {
      const imgFetch = await fetch(imageUrlFromOpenAI);
      buffer = Buffer.from(await imgFetch.arrayBuffer());
    } else {
      throw new Error('Nenhuma imagem foi retornada pela OpenAI.');
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(CARD_BACKGROUND_STORAGE_PATH, buffer, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;

    res.json({ imageUrl: publicUrlData.publicUrl, cached: false });
  } catch (error: any) {
    console.error('Erro ao gerar fundo do cartão:', error);
    res.status(500).json({ error: 'Falha ao gerar fundo do cartão', details: error.message });
  }
});


// 4. Generate TTS Narration using ElevenLabs (multilingual v2)
app.post('/api/generate-narration-tts', aiGenerationLimiter, async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Texto para narração é necessário' });
    }
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY não configurada no servidor' });
    }

    const targetVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL';

    const elevenRes = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${targetVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.80,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      throw new Error(`ElevenLabs TTS erro ${elevenRes.status}: ${errText}`);
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.json({
      audioDataUrl: `data:audio/mpeg;base64,${base64Audio}`,
      format: 'mp3',
    });
  } catch (error: any) {
    console.error('Erro ao gerar narração ElevenLabs:', error);
    res.status(500).json({ error: 'Falha ao sintetizar narração de voz', details: error.message });
  }
});

// 5. Clone voice via ElevenLabs Instant Voice Cloning + synthesize tribute text
app.post('/api/clone-voice', expensiveAiLimiter, async (req, res) => {
  try {
    const { audioDataUrl, tributeText, voiceName } = req.body;
    if (!audioDataUrl || !tributeText) {
      return res.status(400).json({ error: 'audioDataUrl e tributeText são obrigatórios' });
    }
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY não configurada no servidor' });
    }

    // Decode base64 audio from browser recording
    const base64Data = audioDataUrl.split(',')[1];
    if (!base64Data) throw new Error('audioDataUrl inválido');
    const audioBuffer = Buffer.from(base64Data, 'base64');

    // Detect mime type
    const mimeType = audioDataUrl.split(';')[0]?.split(':')[1] || 'audio/webm';
    const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';

    // Build multipart FormData for ElevenLabs voice cloning
    const formData = new FormData();
    formData.append('name', voiceName || 'Voz Personalizada — Dia dos Pais');
    formData.append('description', 'Voz clonada para vídeo homenagem do Dia dos Pais');
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('files', audioBlob, `gravacao.${extension}`);

    // Step 1: Clone the voice
    console.log('Clonando voz no ElevenLabs...');
    const cloneRes = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!cloneRes.ok) {
      const errText = await cloneRes.text();
      throw new Error(`ElevenLabs clone erro ${cloneRes.status}: ${errText}`);
    }

    const cloneData = await cloneRes.json() as { voice_id: string };
    const clonedVoiceId = cloneData.voice_id;
    console.log('Voz clonada! voice_id:', clonedVoiceId);

    // Step 2: Synthesize the tribute text with the cloned voice
    const ttsRes = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${clonedVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: tributeText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error(`ElevenLabs TTS (cloned) erro ${ttsRes.status}: ${errText}`);
    }

    const ttsBuffer = await ttsRes.arrayBuffer();
    const base64TTS = Buffer.from(ttsBuffer).toString('base64');

    res.json({
      audioDataUrl: `data:audio/mpeg;base64,${base64TTS}`,
      clonedVoiceId,
      format: 'mp3',
    });
  } catch (error: any) {
    console.error('Erro na clonagem de voz ElevenLabs:', error);
    res.status(500).json({ error: 'Falha na clonagem de voz', details: error.message });
  }
});

// 6. Server-Side FFmpeg Video Rendering Endpoint
// Responde imediatamente (202) com o vídeo entrando na fila de renderização, e processa o
// FFmpeg + upload em segundo plano — o cliente acompanha o progresso via GET /api/videos/:id
// (poll até "unlockedVideoUrl" aparecer). Isso evita manter uma conexão HTTP aberta por
// minutos quando há fila (ver RenderQueue acima), o que arriscaria timeout no proxy em
// picos de tráfego.
app.post('/api/render-video', renderLimiter, async (req, res) => {
  const { videoId, fatherName, photos, aiImages, useAIImages, tributeText, narrationAudioDataUrl, selectedTrackId, captionStyle } = req.body;

  // No modo "só IA" o vídeo não tem nenhuma foto real — o conteúdo visual inteiro vem de
  // aiImages. Validar só "photos" rejeitava esses vídeos com 400 antes mesmo de chegar no
  // FFmpeg (que já sabia combinar os dois corretamente).
  const hasAnyImage = (photos && photos.length > 0) || (useAIImages && aiImages && aiImages.length > 0);
  if (!hasAnyImage) {
    return res.status(400).json({ error: 'É necessário ao menos uma foto ou imagem de IA para renderizar o vídeo.' });
  }
  if ((photos?.length || 0) > MAX_PHOTOS_PER_JOB || (aiImages?.length || 0) > MAX_AI_IMAGES_PER_JOB) {
    return res.status(400).json({ error: 'Número de fotos/imagens excede o limite permitido.' });
  }

  const finalVideoId = videoId || `vid_${Date.now()}`;
  const queuePosition = renderQueue.position;
  res.status(202).json({ queued: true, videoId: finalVideoId, position: queuePosition });

  if (queuePosition > 0) {
    console.log(`⏳ Vídeo ${finalVideoId} entrou na fila de renderização (${queuePosition} na frente).`);
  }

  try {
    const localMp4Path = await renderQueue.run(async () => {
      const { renderVideoWithFFmpeg } = await import('./src/lib/ffmpeg_render.js');
      console.log(`🎬 Iniciando renderização FFmpeg para vídeo ${finalVideoId}...`);
      return renderVideoWithFFmpeg({
        videoId: finalVideoId,
        fatherName: fatherName || 'Pai',
        photos,
        aiImages,
        useAIImages,
        tributeText: tributeText || '',
        narrationAudioDataUrl,
        selectedTrackId,
        captionStyle,
      });
    });

    // Sobe o MP4 renderizado para o Supabase Storage — em produção (Render) o disco local
    // é efêmero e some a cada reinício/redeploy, então o arquivo local sozinho não é confiável.
    const absoluteLocalPath = path.join(process.cwd(), 'public', localMp4Path.replace(/^\//, ''));
    const fileBuffer = fs.readFileSync(absoluteLocalPath);
    const storagePath = `videos/${finalVideoId}/render.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    const durableMp4Url = publicUrlData.publicUrl;

    // Mantém o vídeo salvo no banco central atualizado com a URL definitiva do MP4 em HD
    await supabaseAdmin.from('video_jobs').update({ unlocked_video_url: durableMp4Url }).eq('id', finalVideoId);
    console.log(`✅ Renderização concluída e publicada para ${finalVideoId}`);
  } catch (error: any) {
    console.error(`❌ Erro na renderização FFmpeg de ${finalVideoId}:`, error);
  }
});

// Mesmo padrão assíncrono de fila + polling de /api/render-video, mas para o Livro de Memórias:
// cada página já chega pronta (PNG composto no navegador) e vira um slide com zoom/transição.
app.post('/api/render-book-video', renderLimiter, async (req, res) => {
  const { bookId, pageImageUrls, narrationAudioDataUrl, selectedTrackId } = req.body;

  if (!pageImageUrls || pageImageUrls.length === 0) {
    return res.status(400).json({ error: 'É necessário ao menos uma página para renderizar o vídeo do livro.' });
  }
  if (pageImageUrls.length > MAX_BOOK_PAGES) {
    return res.status(400).json({ error: 'Número de páginas excede o limite permitido.' });
  }

  const finalBookId = bookId || `book_${Date.now()}`;
  const queuePosition = renderQueue.position;
  res.status(202).json({ queued: true, bookId: finalBookId, position: queuePosition });

  if (queuePosition > 0) {
    console.log(`⏳ Livro ${finalBookId} entrou na fila de renderização (${queuePosition} na frente).`);
  }

  try {
    const localMp4Path = await renderQueue.run(async () => {
      const { renderMemoryBookWithFFmpeg } = await import('./src/lib/ffmpeg_book_render.js');
      console.log(`📖 Iniciando renderização FFmpeg para o livro ${finalBookId}...`);
      return renderMemoryBookWithFFmpeg({
        bookId: finalBookId,
        pageImageUrls,
        narrationAudioDataUrl,
        selectedTrackId,
      });
    });

    const absoluteLocalPath = path.join(process.cwd(), 'public', localMp4Path.replace(/^\//, ''));
    const fileBuffer = fs.readFileSync(absoluteLocalPath);
    const storagePath = `books/${finalBookId}/render.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    const durableMp4Url = publicUrlData.publicUrl;

    await supabaseAdmin.from('memory_book_jobs').update({ unlocked_video_url: durableMp4Url }).eq('id', finalBookId);
    console.log(`✅ Renderização do livro concluída e publicada para ${finalBookId}`);
  } catch (error: any) {
    console.error(`❌ Erro na renderização FFmpeg do livro ${finalBookId}:`, error);
  }
});

async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server "Memórias de Quem Eu Amo" ativo em http://0.0.0.0:${PORT}`);
  });
}

setupServer();
