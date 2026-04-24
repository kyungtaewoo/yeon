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

/**
 * API 호출. 타임아웃 에러는 status=0 의 ApiError 로 정규화.
 *
 * 타임아웃 전략: AbortController 로 fetch 를 cancel 시도하는 동시에 Promise.race
 * 로 전체 체인을 감싼다. 이는 iOS WKWebView 에서 AbortController 가 `res.json()`
 * 단계의 body stream 읽기까지는 cancel 하지 못해 로딩이 영구 pending 되는 현상을
 * 관찰했기 때문. race 가 먼저 timeout 으로 resolve 되면 호출자에겐 명시적 에러가
 * 전달되므로 UI 가 반드시 풀린다.
 */
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

  const doFetch = async (): Promise<T> => {
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
  };

  if (timeoutMs <= 0) {
    try {
      return await doFetch();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new ApiError(0, '요청이 취소되었어요.');
      }
      throw e;
    }
  }

  const timeoutError = new ApiError(
    0,
    `응답이 ${Math.round(timeoutMs / 1000)}초 내에 오지 않았어요. 잠시 후 다시 시도해주세요.`,
  );

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([doFetch(), timeoutPromise]);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      // fetch 단계에서 abort 된 경우 — 타임아웃 때문일 가능성이 크므로 동일 메시지로 정규화
      throw timeoutError;
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
