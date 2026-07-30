import { createClient } from '@supabase/supabase-js';

// Import statements sempre rodam antes do resto do código do módulo que importa — mesmo que
// server.ts chame assertRequiredEnv() logo depois do `import { supabaseAdmin } from ...`, esse
// import já executa este arquivo inteiro primeiro. Se createClient() recebesse a URL/key vazias
// diretamente, ele lançava um erro aqui (fundo dentro da lib do Supabase, com stack trace
// confuso) ANTES da checagem clara de env var em server.ts ter a chance de rodar. Por isso os
// valores vazios caem num placeholder sintaticamente válido só pra não quebrar a construção do
// cliente — assertRequiredEnv() ainda derruba o processo com uma mensagem clara logo em seguida,
// antes de qualquer requisição real ser atendida (este cliente "placeholder" nunca chega a ser usado).
const supabaseUrl = process.env.SUPABASE_URL?.trim() || 'https://missing-env-var.invalid';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'missing-env-var';

/**
 * Cliente Supabase com a service_role key — só deve ser usado no servidor (server.ts e libs de servidor).
 * Nunca importar este arquivo em código que roda no navegador.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export const MEDIA_BUCKET = 'media';
