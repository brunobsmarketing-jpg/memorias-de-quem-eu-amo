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

/** Deduz 1 crédito do usuário de forma atômica no servidor (fonte da verdade, não confia só no localStorage). */
export async function deductCreditRemote(userId: string): Promise<User> {
  const response = await fetch('/api/users/deduct-credit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao deduzir crédito.');
  }
  const data = await response.json();
  return data.user as User;
}

/** Registra a compra de créditos e libera a conta (soma créditos se já existir). */
export async function checkoutCredits(params: {
  email: string;
  name?: string;
  packageId: string;
  credits: number;
  amountBRL: number;
}): Promise<User> {
  const response = await fetch('/api/users/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao processar a compra.');
  }
  const data = await response.json();
  return data.user as User;
}
