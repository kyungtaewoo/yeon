import { useAuthStore } from '@/stores/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, err.message || `HTTP ${res.status}`);
  }

  // 204 등 빈 응답 처리
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * 인증이 필요한 API 호출에 쓰는 훅 — authStore의 JWT를 자동 첨부한다.
 * 토큰이 없으면 호출 시 401로 실패.
 */
export function useApi() {
  const token = useAuthStore((s) => s.token);

  return function authedCall<T = unknown>(
    path: string,
    options: Omit<RequestOptions, 'token'> = {},
  ): Promise<T> {
    return apiClient<T>(path, { ...options, token });
  };
}
