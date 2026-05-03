import { apiClient } from '.';

// ---------------------------------------------------------------------------
// 응답 타입 — apps/api/src/matching/matching.service.ts 와 1:1.
// 모델 C (제안-승낙). 변경 시 양쪽 같이.
// ---------------------------------------------------------------------------

export type MatchStatus = 'proposed' | 'accepted' | 'rejected' | 'expired';

export type MatchDecision = 'pending' | 'accepted' | 'rejected';

/** 매칭 시도 출처 — 'discovery' (탐색하기) | 'ideal_match' (천생연분, v2.2) */
export type MatchSource = 'discovery' | 'ideal_match';

export interface ContactMethods {
  kakaoId?: boolean;
  openChat?: boolean;
}

export interface MatchEntity {
  id: string;
  userAId: string;
  userBId: string;
  idealMatchScore: number | null;
  compatibilityScore: number | null;
  status: MatchStatus;
  source: MatchSource;
  userADecision: MatchDecision | null;
  userBDecision: MatchDecision | null;
  contactMethods: ContactMethods | null;
  proposalMessage: string | null;
  kakaoTalkIdShared: string | null;
  kakaoTalkIdResponse: string | null;
  openChatRoomUrl: string | null;
  openChatPassword: string | null;
  openChatCreatedBy: string | null;
  openChatCreatedAt: string | null;
  proposedAt: string | null;
  respondedAt: string | null;
  notifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface MatchCounterpart {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  birthDate: string | null;
  age: number | null;
}

export interface MatchCounterpartSaju {
  yearStem: string;
  yearBranch: string;
  monthStem: string;
  monthBranch: string;
  dayStem: string;
  dayBranch: string;
  hourStem: string | null;
  hourBranch: string | null;
  dominantElement: string | null;
}

export interface MatchDetailResponse {
  match: MatchEntity;
  myDecision: MatchDecision | null;
  openChatCreatedByMe: boolean;
  isProposer: boolean;
  isReceiver: boolean;
  counterpart: MatchCounterpart | null;
  counterpartSaju: MatchCounterpartSaju | null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** GET /matching/:id — 매칭 상세 */
export async function getMatchDetail(
  token: string,
  matchId: string,
): Promise<MatchDetailResponse> {
  return apiClient<MatchDetailResponse>(
    `/matching/${encodeURIComponent(matchId)}`,
    { token },
  );
}

/** POST /matching/:id/respond — 받는쪽 수락/거절 */
export async function respondToProposal(
  token: string,
  matchId: string,
  decision: 'accepted' | 'rejected',
  extra?: { kakaoTalkIdResponse?: string | null },
): Promise<MatchEntity> {
  return apiClient<MatchEntity>(
    `/matching/${encodeURIComponent(matchId)}/respond`,
    {
      method: 'POST',
      token,
      body: { decision, ...extra },
    },
  );
}

/** @deprecated alias — /respond 사용 권장 */
export async function acceptMatch(
  token: string,
  matchId: string,
): Promise<MatchEntity> {
  return respondToProposal(token, matchId, 'accepted');
}

/** @deprecated alias — /respond 사용 권장 */
export async function rejectMatch(
  token: string,
  matchId: string,
): Promise<MatchEntity> {
  return respondToProposal(token, matchId, 'rejected');
}

// ---------------------------------------------------------------------------
// 디스커버리
// ---------------------------------------------------------------------------

export interface DiscoveryCandidate {
  id: string;
  nickname: string;
  score: number;
  emoji: string;
  label: string;
  dayPillar: string;
  gender: 'male' | 'female';
  ageRange: string;
  summaryOneLiner: string;
}

export type DiscoveryTier = 'general' | 'romantic' | 'deep';

export interface DiscoveryFilters {
  ageMin?: number;
  ageMax?: number;
  tier?: DiscoveryTier;
  minScore?: number;
}

export interface DiscoveryResponse {
  candidates: DiscoveryCandidate[];
  total: number;
  tier: DiscoveryTier;
  minScore: number;
}

/** GET /matching/discovery — 옵션 필터 query string. */
export async function getDiscovery(
  token: string,
  filters?: DiscoveryFilters,
): Promise<DiscoveryResponse> {
  const qs = new URLSearchParams();
  if (filters?.ageMin != null) qs.set('ageMin', String(filters.ageMin));
  if (filters?.ageMax != null) qs.set('ageMax', String(filters.ageMax));
  if (filters?.tier) qs.set('tier', filters.tier);
  if (filters?.minScore != null) qs.set('minScore', String(filters.minScore));
  const path = qs.toString() ? `/matching/discovery?${qs.toString()}` : '/matching/discovery';
  return apiClient<DiscoveryResponse>(path, { token });
}

// ---------------------------------------------------------------------------
// 모델 C — 제안-승낙
// ---------------------------------------------------------------------------

export interface ProposeInput {
  targetId: string;
  contactMethods: ContactMethods;
  message?: string | null;
  kakaoTalkIdShared?: string | null;
  openChatRoomUrl?: string | null;
  openChatPassword?: string | null;
  source?: MatchSource;
}

/** POST /matching/propose */
export async function proposeMatch(
  token: string,
  input: ProposeInput,
): Promise<MatchEntity> {
  return apiClient<MatchEntity>('/matching/propose', {
    method: 'POST',
    token,
    body: input,
  });
}

export interface ProposalQuota {
  used: number;
  limit: number; // -1 == unlimited (premium)
  isPremium: boolean;
}

/** GET /matching/quota */
export async function getProposalQuota(token: string): Promise<ProposalQuota> {
  return apiClient<ProposalQuota>('/matching/quota', { token });
}

/** POST /matching/me/kakao-talk-id */
export async function setMyKakaoTalkId(
  token: string,
  kakaoTalkId: string,
): Promise<{ kakaoTalkId: string }> {
  return apiClient<{ kakaoTalkId: string }>('/matching/me/kakao-talk-id', {
    method: 'POST',
    token,
    body: { kakaoTalkId },
  });
}
