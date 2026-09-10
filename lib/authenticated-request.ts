'use client';
import { apiUrl } from './api';
import { clearSession, getSession } from './auth';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const fallback: Record<number, string> = {
  400: 'Confira os dados informados.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não possui permissão para esta ação.',
  404: 'Recurso não encontrado.',
  409: 'Os dados informados entram em conflito com um cadastro existente.',
  422: 'Não foi possível validar os dados.',
  429: 'Muitas tentativas. Aguarde e tente novamente.',
  500: 'O servidor encontrou um problema.',
  502: 'O serviço está temporariamente indisponível.',
  503: 'O serviço está temporariamente indisponível.',
};

export async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  if (!session) throw new ApiError(fallback[401], 401);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      // Dados administrativos não devem reaproveitar respostas antigas depois de
      // criar/editar categorias, produtos, horários ou configurações.
      cache: init?.cache ?? 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }

  const result = await response.json().catch(() => null) as (T & { message?: string | string[] }) | null;
  if (!response.ok) {
    if (response.status === 401) clearSession();
    const detail = Array.isArray(result?.message) ? result?.message[0] : result?.message;
    throw new ApiError(detail || fallback[response.status] || 'Não foi possível concluir a operação.', response.status);
  }

  return result as T;
}
