"use client";

import Link from "next/link";
import type { FriendInviteRow } from "@/lib/api/friends";

interface Props {
  friends: FriendInviteRow[]; // status==='calculated' && compatibility != null 만 들어옴
  myUserId: string;
  myGender: 'male' | 'female';
  isPremium: boolean;
}

function counterpartName(invite: FriendInviteRow, myUserId: string): string {
  if (invite.inviterId === myUserId) return invite.invitee?.nickname ?? "이름 미상";
  return invite.inviter?.nickname ?? "이름 미상";
}

function counterpartGender(
  invite: FriendInviteRow,
  myUserId: string,
): 'male' | 'female' | null {
  if (invite.inviterId === myUserId) return invite.invitee?.gender ?? null;
  return invite.inviter?.gender ?? null;
}

function medalForRank(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

/**
 * 친구 궁합 매트릭스 — 친구 row × 궁합 종류 column.
 *
 * 정렬: 일반 점수 desc (Q3=A 결정)
 * 메달: 일반 column 만 (1/2/3 위)
 * 동성 친구: 연인/깊은 cell = '동성'
 * 비프리미엄: 연인/깊은 cell = '🔒'
 * Row click → /friend-detail?id=...
 *
 * 호출부 (friends/page.tsx) 가 calculated.length >= 3 일 때만 렌더 — 그 이하면 카드 레이아웃 유지.
 */
export function FriendsMatrix({ friends, myUserId, myGender, isPremium }: Props) {
  const sorted = [...friends].sort((a, b) => {
    const sa = Number(a.compatibility?.generalScore ?? 0);
    const sb = Number(b.compatibility?.generalScore ?? 0);
    return sb - sa;
  });

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
      {/* 헤더 — 친구 col 1.3fr + 점수 3 col 1fr + chevron 자리 (탭 가능 표시) */}
      <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_18px] bg-[var(--brand-gold)]/5 text-[11px] font-medium text-[var(--muted-foreground)] border-b border-[var(--border)]">
        <div className="px-3 py-2">친구</div>
        <div className="px-1 py-2 text-center">일반궁합</div>
        <div className="px-1 py-2 text-center">연인궁합</div>
        <div className="px-1 py-2 text-center">깊은궁합</div>
        <div className="py-2" />
      </div>

      {/* 행 */}
      {sorted.map((invite, idx) => {
        const name = counterpartName(invite, myUserId);
        const compat = invite.compatibility!;
        const counterGender = counterpartGender(invite, myUserId);
        const sameSex = counterGender !== null && counterGender === myGender;
        const generalRank = idx + 1;
        const medal = medalForRank(generalRank);

        return (
          <Link
            key={invite.id}
            href={`/friend-detail?id=${encodeURIComponent(invite.id)}`}
            aria-label={`${name} 궁합 상세보기`}
            className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_18px] border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/40 active:bg-[var(--muted)]/60 transition-colors"
          >
            <div className="px-3 py-3 truncate">
              <span className="text-sm font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)]/30 decoration-1 underline-offset-4">
                {name}
              </span>
            </div>
            {/* 일반 — 항상 표시 + 메달 */}
            <Cell
              score={compat.generalScore}
              locked={false}
              sameSex={false}
              medal={medal}
              accent
            />
            {/* 연인 */}
            <Cell
              score={compat.romanticScore}
              locked={!isPremium}
              sameSex={sameSex}
              medal={null}
            />
            {/* 깊은 */}
            <Cell
              score={compat.deepScore}
              locked={!isPremium}
              sameSex={sameSex}
              medal={null}
            />
            {/* 탭 가능 표시 */}
            <div className="flex items-center justify-end pr-1.5 text-[var(--muted-foreground)]">
              <span aria-hidden className="text-sm">›</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Cell({
  score,
  locked,
  sameSex,
  medal,
  accent,
}: {
  score: number | null;
  locked: boolean;
  sameSex: boolean;
  medal: string | null;
  accent?: boolean;
}) {
  if (sameSex) {
    return (
      <div className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">
        동성
      </div>
    );
  }
  if (locked) {
    return (
      <div className="px-2 py-3 text-center">
        <span className="text-sm">🔒</span>
      </div>
    );
  }
  if (score == null) {
    return (
      <div className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">—</div>
    );
  }
  return (
    <div className="px-2 py-3 text-center">
      <span className={`text-sm font-bold ${accent ? "text-[var(--brand-gold)]" : "text-[var(--foreground)]"}`}>
        {Math.round(Number(score))}
      </span>
      {medal && <span className="ml-0.5 text-xs">{medal}</span>}
    </div>
  );
}
