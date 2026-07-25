import 'dotenv/config';
import express from 'express';
import path from 'path';
import OpenAI from 'openai';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { supabaseAdmin, MEDIA_BUCKET } from './src/lib/supabaseAdmin';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve a pasta de vídeos renderizados em MP4
const rendersPath = path.join(process.cwd(), 'public', 'renders');
if (!fs.existsSync(rendersPath)) {
  fs.mkdirSync(rendersPath, { recursive: true });
}
app.use('/renders', express.static(rendersPath));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// OpenAI client (DALL-E 3)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Memórias de Quem Eu Amo' });
});

// TEMPORÁRIO: diagnóstico do binário FFmpeg no ambiente de produção (remover depois de resolver o deploy)
app.get('/api/debug-ffmpeg', async (req, res) => {
  try {
    const { spawn } = await import('child_process');
    const ffmpegPath = (await import('ffmpeg-static')).default;
    const run = (args: string[]) =>
      new Promise<string>((resolve) => {
        const proc = spawn(ffmpegPath as string, args);
        let out = '';
        proc.stdout.on('data', (d) => (out += d.toString()));
        proc.stderr.on('data', (d) => (out += d.toString()));
        proc.on('close', () => resolve(out));
        proc.on('error', (e) => resolve('SPAWN_ERROR: ' + e.message));
      });
    const version = await run(['-version']);
    const filters = await run(['-filters']);
    res.json({ ffmpegPath, version, filters });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Envia um arquivo (foto, áudio, imagem gerada por IA) em base64 para o Supabase Storage
// e devolve a URL pública permanente — usado para tirar as mídias do localStorage do navegador.
app.post('/api/upload-media', async (req, res) => {
  try {
    const { dataUrl, folder } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl inválido' });
    }

    const [meta, base64Data] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const extension = mimeType.split('/')[1]?.split('+')[0] || 'bin';
    const buffer = Buffer.from(base64Data, 'base64');

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
  };
}

// Login simples por e-mail: não usa senha (não temos essa infraestrutura ainda),
// só busca a conta real pelo e-mail. Se não existir, cria uma conta SEM créditos —
// diferente do comportamento antigo que dava 3 créditos grátis para qualquer e-mail digitado.
app.post('/api/users/login', async (req, res) => {
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
      return res.json({ user: mapUserRow(existing) });
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      credits: 0,
      is_paid_member: false,
      plan_name: null,
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

/** Cria a conta (se não existir) e soma créditos comprados. Usado pelo checkout simulado e pelo webhook da Payt. */
async function grantCreditsToUserByEmail(params: {
  email: string;
  name?: string;
  packageId?: string;
  credits: number;
  amountBRL?: number;
}) {
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
        plan_name: params.packageId || existing.plan_name,
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
        plan_name: params.packageId || null,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    userRow = created;
  }

  await supabaseAdmin.from('payments').insert({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userRow.id,
    package_id: params.packageId || null,
    amount_brl: params.amountBRL || null,
    credits_added: params.credits,
    status: 'completed',
  });

  return userRow;
}

// Registra uma compra de créditos (checkout simulado por enquanto — será substituído
// pelo webhook real da Payt). Cria a conta se não existir e soma os créditos comprados.
app.post('/api/users/checkout', async (req, res) => {
  try {
    const { email, name, packageId, credits, amountBRL } = req.body;
    if (!email || !credits) {
      return res.status(400).json({ error: 'email e credits são obrigatórios' });
    }
    const userRow = await grantCreditsToUserByEmail({ email, name, packageId, credits, amountBRL });
    res.json({ user: mapUserRow(userRow) });
  } catch (error: any) {
    console.error('Erro no checkout:', error);
    res.status(500).json({ error: 'Falha ao processar a compra', details: error.message });
  }
});

// Webhook (postback) da Payt — recebe a notificação de pagamento aprovado e libera os créditos.
// FORMATO AINDA NÃO CONFIRMADO: por enquanto registra o payload bruto no log do servidor para
// descobrirmos o formato real assim que a Payt enviar o primeiro evento de teste.
app.post('/api/webhook/payt', async (req, res) => {
  console.log('📩 Webhook Payt recebido:', JSON.stringify(req.body));
  try {
    // Responde 200 sempre que possível para a Payt não ficar retentando, mesmo que
    // ainda não saibamos processar todos os formatos de evento.
    res.json({ received: true });

    const payload = req.body || {};
    const eventStatus = String(payload.status || payload.event || payload.eventName || '').toLowerCase();
    const isApproved = /aprovad|finalizad|approved|completed/.test(eventStatus);
    if (!isApproved) {
      console.log(`Webhook Payt ignorado (evento "${eventStatus}" não é de pagamento aprovado).`);
      return;
    }

    const email = payload.email || payload.customer?.email || payload.buyer?.email;
    const name = payload.name || payload.customer?.name || payload.buyer?.name;
    const packageId = payload.productId || payload.offerId || payload.product?.id;
    const amountBRL = payload.amount || payload.total || payload.price;

    if (!email) {
      console.error('Webhook Payt: não foi possível identificar o e-mail do comprador no payload.');
      return;
    }

    // TODO: mapear productId/offerId da Payt para a quantidade de créditos do pacote
    // correspondente (hoje fixo em 1, ajustar assim que soubermos os IDs reais dos produtos).
    const credits = 1;

    await grantCreditsToUserByEmail({ email, name, packageId, credits, amountBRL });
    console.log(`✅ Créditos liberados via webhook Payt para ${email}`);
  } catch (error: any) {
    console.error('Erro ao processar webhook Payt:', error);
  }
});

// Deduz 1 crédito do usuário de forma atômica no servidor — a liberação de HD não pode
// confiar só no localStorage, senão o mesmo crédito poderia ser "reusado" em outro dispositivo.
app.post('/api/users/deduct-credit', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });

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

// Salva (cria ou atualiza) um vídeo de homenagem no banco central — é isso que faz o
// cartão digital /c/{id} funcionar em qualquer dispositivo, não só no navegador de quem criou.
app.post('/api/videos', async (req, res) => {
  try {
    const job = req.body;
    if (!job || !job.id || !job.userId) {
      return res.status(400).json({ error: 'Vídeo inválido: id e userId são obrigatórios' });
    }

    // Garante que o usuário existe (FK) sem sobrescrever créditos/dados já existentes
    const { data: existingUser } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('id', job.userId)
      .maybeSingle();
    if (!existingUser) {
      await supabaseAdmin.from('app_users').insert({ id: job.userId, name: job.authorName || null });
    }

    const row = {
      id: job.id,
      user_id: job.userId,
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
    };

    const { error } = await supabaseAdmin.from('video_jobs').upsert(row, { onConflict: 'id' });
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
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar vídeo no Supabase:', error);
    res.status(500).json({ error: 'Falha ao buscar vídeo', details: error.message });
  }
});

// 1. Generate Emotional Tribute Text using Gemini AI
app.post('/api/generate-text', async (req, res) => {
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
app.post('/api/extract-visual-themes', async (req, res) => {
  try {
    const { text, fatherName } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    const prompt = `Analise o texto de homenagem de Dia dos Pais a seguir e extraia exatamente 2 cenas visuais e poéticas para ilustrações em estilo aquarela suave (soft watercolor painting).

Texto: "${text}"

Retorne um JSON com a lista de 2 descrições visuais em inglês para geração de arte. As ilustrações NUNCA devem tentar simular fotos de pessoas reais específicas, mas sim conceitos simbólicos calorosos (ex: silhueta de pai e criança de mãos dadas ao pôr do sol, casa acolhedora com luz suave, árvore de carvalho forte simbolizando proteção).`;

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

// 3. Generate AI Illustration Image using OpenAI (gpt-image-1)
app.post('/api/generate-ai-image', async (req, res) => {
  try {
    const { prompt, titlePt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt de imagem é obrigatório' });
    }

    const fullPrompt = `Beautiful soft watercolor painting illustration for a Brazilian Father's Day (Dia dos Pais) tribute video.
Style: gentle handcrafted watercolor art, warm pastel tones, artistic and poetic, dreamlike quality.
Rules: NO realistic human faces, NO text or letters anywhere in the image, symbolic and metaphorical imagery only.
Mood: warm, nostalgic, heartfelt, loving, emotional.
Colors: rich sunset oranges, warm golds, soft purples and deep blues for sky, earthy warm tones for ground.
Scene theme: ${prompt}`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
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


// 4. Generate TTS Narration using ElevenLabs (multilingual v2)
app.post('/api/generate-narration-tts', async (req, res) => {
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
app.post('/api/clone-voice', async (req, res) => {
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
app.post('/api/render-video', async (req, res) => {
  try {
    const { renderVideoWithFFmpeg } = await import('./src/lib/ffmpeg_render.js');
    const { videoId, fatherName, photos, aiImages, useAIImages, tributeText, narrationAudioDataUrl, selectedTrackId } = req.body;

    if (!photos || photos.length === 0) {
      return res.status(400).json({ error: 'Fotos são obrigatórias para renderizar o vídeo.' });
    }

    const finalVideoId = videoId || `vid_${Date.now()}`;
    console.log(`🎬 Iniciando renderização FFmpeg para vídeo ${finalVideoId}...`);
    const localMp4Path = await renderVideoWithFFmpeg({
      videoId: finalVideoId,
      fatherName: fatherName || 'Pai',
      photos,
      aiImages,
      useAIImages,
      tributeText: tributeText || '',
      narrationAudioDataUrl,
      selectedTrackId,
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

    res.json({
      success: true,
      mp4Url: durableMp4Url,
      relativePath: localMp4Path,
    });
  } catch (error: any) {
    console.error('Erro na rota de renderização FFmpeg:', error);
    res.status(500).json({ error: 'Falha ao renderizar vídeo com FFmpeg', details: error.message });
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
