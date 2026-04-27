import { useSavedMatchesStore } from '@/stores/savedMatchesStore';

/**
 * 로그인 직후 호출되는 서버 동기화 진입점.
 *
 * 호출 위치:
 *  - NativeBridge (Capacitor iOS OAuth 콜백)
 *  - (auth)/callback (웹 카카오 콜백 — token / code 두 분기)
 *  - (main)/home (URL ?token= fallback)
 *
 * 호출 규약:
 *  - setAuth 직후 try/catch 로 호출. 에러는 swallow — 로그인 자체는 성공했으므로 사용자 차단 X.
 *  - 향후 친구 / 알림 등 추가 도메인 동기화도 여기에 추가.
 */
export async function postLoginSync(token: string): Promise<void> {
  await syncSavedMatches(token);
  // 미래: await syncFriends(token), await syncNotifications(token) 등
}

async function syncSavedMatches(token: string): Promise<void> {
  const store = useSavedMatchesStore.getState();
  // 순서 중요: 마이그레이션이 먼저 — LS → 백엔드 업로드 후 권위 데이터로 hydrate.
  await store.migrateLocalToBackend(token);
  await store.hydrate(token);
}
