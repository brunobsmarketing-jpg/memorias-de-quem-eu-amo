/**
 * Falha rápido e com uma mensagem clara quando falta uma env var essencial, em vez de deixar
 * o erro estourar fundo dentro de uma lib (ex: "supabaseKey is required" do @supabase/supabase-js)
 * sem dizer qual variável está errada. Foi exatamente assim que um typo (tab sobrando no nome da
 * variável na Railway) já causou um crash-loop em produção sem mensagem nenhuma de onde vinha.
 *
 * Considera vazio/só-espaço como ausente também, não só `undefined` — cobre o caso de a variável
 * existir na plataforma mas com o valor em branco.
 */
export function assertRequiredEnv(vars: Array<{ name: string; value: string | undefined }>): void {
  const missing = vars.filter((v) => !v.value || !v.value.trim()).map((v) => v.name);
  if (missing.length === 0) return;

  console.error(
    `FATAL: variável(is) de ambiente obrigatória(s) ausente(s) ou vazia(s): ${missing.join(', ')}. ` +
      'Configure em Railway → Settings → Variables antes de reiniciar o serviço.'
  );
  process.exit(1);
}

/** Mesma checagem, mas só avisa no log em vez de derrubar o servidor — usada para integrações
 * opcionais (ex: Mercado Pago antes de as credenciais reais existirem) que não devem impedir
 * o resto do app de funcionar enquanto ainda não foram configuradas. */
export function warnMissingEnv(vars: Array<{ name: string; value: string | undefined }>): void {
  const missing = vars.filter((v) => !v.value || !v.value.trim()).map((v) => v.name);
  if (missing.length === 0) return;

  console.warn(
    `⚠️  Variável(is) de ambiente opcional(is) ausente(s): ${missing.join(', ')}. ` +
      'As funcionalidades que dependem delas ficarão desabilitadas até serem configuradas.'
  );
}
