import { User } from '../types';

/** Entra na conta pelo e-mail (sem senha). Cria a conta sem créditos se ainda não existir. */
export async function loginByEmail(email: string, name?: string): Promise<User> {
  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao entrar na conta.');
  }
  const data = await response.json();
  return data.user as User;
}

/** Deduz 1 crédito do usuário de forma atômica no servidor (fonte da verdade, não confia só no
 * localStorage). O servidor identifica o dono pelo sessionToken, não pelo userId — por isso ele
 * é obrigatório aqui. */
export async function deductCreditRemote(userId: string, sessionToken: string): Promise<User> {
  const response = await fetch('/api/users/deduct-credit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao deduzir crédito.');
  }
  const data = await response.json();
  return data.user as User;
}
