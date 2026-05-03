/**
 * 점수 → 구간 매핑.
 *
 * 5단계 (이모지 라벨과 일관) — summary / outro 에 사용:
 *   ≥95 fantastic 🌟 환상적
 *   ≥85 heart     💛 마음 통함
 *   ≥70 stable    🤝 안정적
 *   ≥55 different ⚡ 다름이 매력
 *   <55 effort    🌪️ 노력 필요
 *
 * 3단계 — 항목별 explanation 에 사용 (단순화):
 *   ≥70 high
 *   ≥50 mid
 *   <50 low
 */

export type ScoreBand5 = 'fantastic' | 'heart' | 'stable' | 'different' | 'effort';
export type ScoreBand3 = 'high' | 'mid' | 'low';

export function getScoreBand5(score: number): ScoreBand5 {
  if (score >= 95) return 'fantastic';
  if (score >= 85) return 'heart';
  if (score >= 70) return 'stable';
  if (score >= 55) return 'different';
  return 'effort';
}

export function getScoreBand3(score: number): ScoreBand3 {
  if (score >= 70) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

export interface BreakdownExplanation {
  title: string;
  explanation: string;
}
