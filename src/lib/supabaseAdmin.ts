import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Cliente Supabase com a service_role key — só deve ser usado no servidor (server.ts e libs de servidor).
 * Nunca importar este arquivo em código que roda no navegador.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export const MEDIA_BUCKET = 'media';
