import { apiClient } from '.';

// ---------------------------------------------------------------------------
// 응답 타입 — apps/api/src/matching/matching.service.ts getMatchDetail() 와 1:1.
// 변경 시 양쪽 같이.
// ---------------------------------------------------------------------------

export type MatchStatus =
  | 'pending'
  | 'notified'
  | 'a_accepted'
  | 'b_accepted'
  | 'both_accepted'
  | 'payment_pending'
  | 'completed'
  | 'rejected'
  | 'expired';

export type MatchDecision = 'pending' | 'accepted' | 'rejected';

export interface MatchEntity {
  id: string;
  userAId: string;
  userBId: string;
  idealMatchScore: number | null;
  compatibilityScore: number | null;
  status: MatchStatus;
  userADecision: MatchDecision | null;
  userBDecision: MatchDecision | null;
  notifiedAt: string | null;
  completedAt: string | null;
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

/** POST /matching/:id/accept */
export async function acceptMatch(
  token: string,
  matchId: string,
): Promise<MatchEntity> {
  return apiClient<MatchEntity>(
    `/matching/${encodeURIComponent(matchId)}/accept`,
    { method: 'POST', token },
  );
}

/** POST /matching/:id/reject */
export async function rejectMatch(
  token: string,
  matchId: string,
): Promise<MatchEntity> {
  return apiClient<MatchEntity>(
    `/matching/${encodeURIComponent(matchId)}/reject`,
    { method: 'POST', token },
  );
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

export interface DiscoveryResponse {
  candidates: DiscoveryCandidate[];
  total: number;
}

/** GET /matching/discovery */
export async function getDiscovery(token: string): Promise<DiscoveryResponse> {
  return apiClient<DiscoveryResponse>('/matching/discovery', { token });
}

/** POST /matching/express-interest */
export async function expressInterest(
  token: string,
  targetId: string,
): Promise<MatchEntity> {
  return apiClient<MatchEntity>('/matching/express-interest', {
    method: 'POST',
    token,
    body: { targetId },
  });
}
