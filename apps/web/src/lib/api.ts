import { useAuthStore } from '@/stores/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** 요청 타임아웃 (ms). 기본 60000. 0 이하면 타임아웃 없음. */
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** AbortController timeout 으로 발생한 에러는 status=0 의 ApiError 로 정규화. */
export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 60000 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new ApiError(res.status, err.message || `HTTP ${res.status}`);
    }

    // 204 등 빈 응답 처리
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new ApiError(
        0,
        `응답이 ${Math.round(timeoutMs / 1000)}초 내에 오지 않았어요. 잠시 후 다시 시도해주세요.`,
      );
    }
    throw e;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
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
