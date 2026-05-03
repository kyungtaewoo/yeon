import { apiClient, ApiError } from '.';
import {
  FRIEND_ERROR_CODES,
  FriendInviteAlreadyAcceptedError,
  FriendInviteExpiredError,
  FriendInviteForbiddenError,
  FriendInviteGenerationFailedError,
  FriendInviteNotFoundError,
  FriendSelfInviteError,
  FriendNetworkError,
  FriendUnauthorizedError,
} from './friendsErrors';

// ---------------------------------------------------------------------------
// 응답 타입
// ---------------------------------------------------------------------------

export type FriendInviteStatus =
  | 'pending'
  | 'joined'
  | 'saju_complete'
  | 'calculated'
  | 'expired';

export interface FriendUserBrief {
  id: string;
  nickname: string;
  /** 동성/이성 분기용 — 백엔드 listMyInvites/getDetail 가 inviter/invitee 관계로
   *  full User entity 를 보내므로 항상 채워짐. 동성 친구는 일반 궁합만 표시. */
  gender: 'male' | 'female';
}

export interface FriendInviteRow {
  id: string;
  inviterId: string;
  inviter?: FriendUserBrief;
  inviteCode: string;
  inviteeId: string | null;
  invitee?: FriendUserBrief | null;
  status: FriendInviteStatus;
  expiresAt: string;
  createdAt: string;
  /** 백엔드 listMyInvites 가 compatibility 까지 prefetch — calculated 일 때만 채워짐 */
  compatibility?: FriendCompatibilityRow | null;
}

export interface VerifyInviteResponse {
  valid: boolean;
  status: FriendInviteStatus;
  inviteId: string;
  inviter: { nickname: string };
  hasInvitee: boolean;
}

/**
 * Breakdown 은 saju-engine 의 calculateXxxCompatibility 반환값 그대로 직렬화된 JSONB.
 *
 * v3 컨텐츠 확장:
 *   summary / outro / explanations 가 풍부한 단락 단위 서사.
 *   기존 narrative 는 호환성을 위해 남겨두지만 신규 화면은 summary 우선 사용.
 *   재계산 안 된 친구는 summary 가 undefined 이므로 fallback 필수.
 */
export interface BreakdownExplanation {
  title: string;
  explanation: string;
}

export interface GeneralBreakdown {
  totalScore: number;
  breakdown: {
    yearBranch: number;
    monthPillar: number;
    elements: number;
    tenGods: number;
    wonJin: number;
  };
  /** v3 — 점수 5단계 기반 단락 서사 */
  summary?: string;
  /** v3 — 점수 5단계 기반 마무리 한 줄 */
  outro?: string;
  /** v3 — 항목별 점수 3단계 기반 해설 */
  explanations?: Record<'yearBranch' | 'monthPillar' | 'elements' | 'tenGods' | 'wonJin', BreakdownExplanation>;
  /** @deprecated v3 부터 summary 사용 */
  narrative: string;
  factors: string[];
}

export interface RomanticBreakdown {
  totalScore: number;
  marriageScore: number;
  styleScore: number;
  breakdown: {
    dayGan: number;
    dayJi: number;
    officialStar: number;
    yearMonth: number;
    peachBlossom: number;
  };
  summary?: string;
  outro?: string;
  explanations?: Record<'dayGan' | 'dayJi' | 'officialStar' | 'yearMonth' | 'peachBlossom', BreakdownExplanation>;
  /** @deprecated v3 부터 summary 사용 */
  narrative: string;
  factors: string[];
}

export interface DeepBreakdown {
  totalScore: number;
  breakdown: {
    unconscious: number;
    emotional: number;
    attraction: number;
    innerComplement: number;
    yinyangBalance: number;
  };
  summary?: string;
  outro?: string;
  explanations?: Record<'unconscious' | 'emotional' | 'attraction' | 'innerComplement' | 'yinyangBalance', BreakdownExplanation>;
  /** @deprecated v3 부터 summary 사용. 구조 차이 주의 — Deep 만 객체. */
  narrative: {
    summary: string;
    details: { label: string; score: number; description: string }[];
  };
  factors: string[];
}

export interface FriendCompatibilityRow {
  id: string;
  inviteId: string;
  userAId: string;
  userBId: string;
  generalScore: number | null;
  generalBreakdown: GeneralBreakdown | null;
  romanticScore: number | null;
  romanticBreakdown: RomanticBreakdown | null;
  deepScore: number | null;
  deepBreakdown: DeepBreakdown | null;
  /** entity 에 정의되어 있으나 v2 시점에 채우지 않음 — UI 미사용. */
  deepNarrative: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface FriendDetailResponse {
  invite: FriendInviteRow;
  compatibility: FriendCompatibilityRow | null;
}

// ---------------------------------------------------------------------------
// ApiError → 도메인 에러 매핑
// ---------------------------------------------------------------------------

export function mapFriendsError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      throw new FriendUnauthorizedError(err.message || '다시 로그인이 필요해요');
    }

    switch (err.code) {
      case FRIEND_ERROR_CODES.INVITE_NOT_FOUND:
        throw new FriendInviteNotFoundError(err.message);
      case FRIEND_ERROR_CODES.INVITE_GENERATION_FAILED:
        throw new FriendInviteGenerationFailedError(err.message);
      case FRIEND_ERROR_CODES.SELF_INVITE:
        throw new FriendSelfInviteError(err.message);
      case FRIEND_ERROR_CODES.INVITE_EXPIRED:
        throw new FriendInviteExpiredError(err.message);
      case FRIEND_ERROR_CODES.INVITE_ALREADY_ACCEPTED:
        throw new FriendInviteAlreadyAcceptedError(err.message);
      case FRIEND_ERROR_CODES.INVITE_FORBIDDEN:
        throw new FriendInviteForbiddenError(err.message);
    }

    if (err.status === 0 || err.status >= 500) {
      throw new FriendNetworkError(err.message);
    }
    throw err;
  }
  if (err instanceof Error) {
    throw new FriendNetworkError(err.message);
  }
  throw new FriendNetworkError('알 수 없는 오류');
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** POST /friends/invite — 초대 코드 생성 (로그인) */
export async function createInvite(token: string): Promise<FriendInviteRow> {
  try {
    return await apiClient<FriendInviteRow>('/friends/invite', {
      method: 'POST',
      token,
    });
  } catch (err) {
    mapFriendsError(err);
  }
}

/** GET /friends/invite/:code/verify — 초대 코드 검증 (비로그인 가능) */
export async function verifyInvite(code: string): Promise<VerifyInviteResponse> {
  try {
    return await apiClient<VerifyInviteResponse>(
      `/friends/invite/${encodeURIComponent(code)}/verify`,
    );
  } catch (err) {
    mapFriendsError(err);
  }
}

/** POST /friends/invite/:code/accept — 초대 수락 (로그인 + 사주 완비 권장) */
export async function acceptInvite(
  token: string,
  code: string,
): Promise<FriendInviteRow> {
  try {
    return await apiClient<FriendInviteRow>(
      `/friends/invite/${encodeURIComponent(code)}/accept`,
      { method: 'POST', token },
    );
  } catch (err) {
    mapFriendsError(err);
  }
}

/** GET /friends — 내 친구(=내가 관여한 초대) 목록 */
export async function listFriends(token: string): Promise<FriendInviteRow[]> {
  try {
    return await apiClient<FriendInviteRow[]>('/friends', { token });
  } catch (err) {
    mapFriendsError(err);
  }
}

/** GET /friends/:inviteId — 초대 상세 + 저장된 궁합 */
export async function getFriendDetail(
  token: string,
  inviteId: string,
): Promise<FriendDetailResponse> {
  try {
    return await apiClient<FriendDetailResponse>(
      `/friends/${encodeURIComponent(inviteId)}`,
      { token },
    );
  } catch (err) {
    mapFriendsError(err);
  }
}

/** POST /friends/:inviteId/recompute — 사주 변경 후 재계산 */
export async function recomputeCompatibility(
  token: string,
  inviteId: string,
): Promise<FriendInviteRow> {
  try {
    return await apiClient<FriendInviteRow>(
      `/friends/${encodeURIComponent(inviteId)}/recompute`,
      { method: 'POST', token },
    );
  } catch (err) {
    mapFriendsError(err);
  }
}

// 에러 클래스 re-export — 호출부 한 import 로 모두 사용 가능.
export {
  FRIEND_ERROR_CODES,
  FriendInviteAlreadyAcceptedError,
  FriendInviteExpiredError,
  FriendInviteForbiddenError,
  FriendInviteGenerationFailedError,
  FriendInviteNotFoundError,
  FriendSelfInviteError,
  FriendNetworkError,
  FriendUnauthorizedError,
} from './friendsErrors';
export type { FriendErrorCode } from './friendsErrors';
