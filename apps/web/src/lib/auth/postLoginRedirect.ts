/**
 * 로그인 직후 라우팅 결정.
 *
 * 친구 초대 Universal Link 진입 → 비로그인 → 로그인 → 본 페이지 복귀를 위해
 * /invite/[code] 페이지가 로그인 전에 PENDING_INVITE_KEY 에 코드를 저장한다.
 * 로그인 콜백(NativeBridge / callback 페이지)이 이 헬퍼로 복귀 대상을 결정.
 */

const PENDING_INVITE_KEY = 'yeon-pending-invite';
const AUTO_ACCEPT_KEY = 'yeon-invite-auto-accept';

/**
 * /invite/[code] 페이지가 로그인 유도 직전에 호출.
 * - PENDING: 로그인 콜백이 본 페이지로 라우팅하도록 (resolvePostLoginTarget).
 * - AUTO_ACCEPT: 본 페이지로 돌아왔을 때 사용자가 다시 클릭하지 않아도 acceptInvite 자동 호출.
 *
 * 저장소: localStorage (sessionStorage 가 native iOS WKWebView teardown 으로
 * 날아가는 케이스 회피 — OAuth 가 외부 브라우저로 빠졌다 돌아올 때 안전).
 * 7 일 backend TTL 내 자연 만료라 영구 저장도 부담 없음.
 */
export function setPendingInviteCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, code);
    window.localStorage.setItem(AUTO_ACCEPT_KEY, code);
  } catch {
    // private mode 등 storage 실패 — 본 페이지 못 돌아오지만 로그인 자체는 진행.
  }
}

/**
 * 같은 code 에 대해 auto-accept 플래그가 세팅돼 있는지 확인 + 일치하면 소비.
 * 사용자가 명시적으로 "로그인하고 친구되기" 를 눌러 동의한 경우에만 true 가 됨 →
 * 그 외(직접 URL 접근 등)에서는 자동 수락하지 않음.
 */
export function consumeAutoAcceptCode(code: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const flag = window.localStorage.getItem(AUTO_ACCEPT_KEY);
    if (flag !== code) return false;
    window.localStorage.removeItem(AUTO_ACCEPT_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * 로그인 콜백에서 호출. pending invite 가 있으면 그쪽 경로 반환 + storage 비움.
 * 없으면 defaultTarget 그대로.
 */
export function resolvePostLoginTarget(defaultTarget: string): string {
  if (typeof window === 'undefined') return defaultTarget;
  let pending: string | null = null;
  try {
    pending = window.localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return defaultTarget;
  }
  if (!pending) return defaultTarget;
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // ignore
  }
  return `/invite/${encodeURIComponent(pending)}`;
}
