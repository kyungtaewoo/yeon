"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { FriendInviteRow } from "@/lib/api/friends";

interface Props {
  friends: FriendInviteRow[]; // status==='calculated' && compatibility != null 만 들어옴
  myUserId: string;
  myGender: 'male' | 'female';
  isPremium: boolean;
}

type SortKey = 'general' | 'romantic' | 'deep';

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

function getScore(invite: FriendInviteRow, key: SortKey): number | null {
  const c = invite.compatibility;
  if (!c) return null;
  if (key === 'general') return c.generalScore != null ? Number(c.generalScore) : null;
  if (key === 'romantic') return c.romanticScore != null ? Number(c.romanticScore) : null;
  return c.deepScore != null ? Number(c.deepScore) : null;
}

/**
 * 친구 궁합 매트릭스 — 친구 row × 궁합 종류 column.
 *
 * 정렬: 헤더 클릭으로 일반/연인/깊은 desc 전환 (기본 일반)
 * 메달: 활성 sort column 의 1/2/3 위 (점수 null 인 친구 제외)
 * 동성 친구: 연인/깊은 cell = '동성'  (해당 column 으로 sort 시 점수 없음 → 하단)
 * 비프리미엄: 연인/깊은 헤더 disabled (sort 불가) + cell = '🔒'
 * Row click → /friend-detail?id=...
 *
 * 호출부 (friends/page.tsx) 가 calculated.length >= 3 일 때만 렌더.
 */
export function FriendsMatrix({ friends, myUserId, myGender, isPremium }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('general');

  const { sorted, rankByInviteId } = useMemo(() => {
    // sort: score 있는 row 먼저 (desc), 없는 row 는 뒤로
    const withScore: { invite: FriendInviteRow; score: number }[] = [];
    const withoutScore: FriendInviteRow[] = [];
    for (const inv of friends) {
      const s = getScore(inv, sortKey);
      if (s == null) withoutScore.push(inv);
      else withScore.push({ invite: inv, score: s });
    }
    withScore.sort((a, b) => b.score - a.score);

    // 메달은 점수 있는 행에 한해서만 1/2/3 부여
    const rankByInviteId = new Map<string, number>();
    withScore.forEach(({ invite }, idx) => {
      rankByInviteId.set(invite.id, idx + 1);
    });

    const sorted = [...withScore.map((x) => x.invite), ...withoutScore];
    return { sorted, rankByInviteId };
  }, [friends, sortKey]);

  const canSort: Record<SortKey, boolean> = {
    general: true,
    romantic: isPremium,
    deep: isPremium,
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
      {/* 헤더 — 친구 col 1.3fr + 점수 3 col 1fr + chevron 자리 */}
      <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_18px] bg-[var(--brand-gold)]/5 text-[11px] font-medium text-[var(--muted-foreground)] border-b border-[var(--border)]">
        <div className="px-3 py-2">친구</div>
        <SortHeader
          label="일반궁합"
          active={sortKey === 'general'}
          enabled={canSort.general}
          onClick={() => setSortKey('general')}
        />
        <SortHeader
          label="연인궁합"
          active={sortKey === 'romantic'}
          enabled={canSort.romantic}
          onClick={() => setSortKey('romantic')}
        />
        <SortHeader
          label="깊은궁합"
          active={sortKey === 'deep'}
          enabled={canSort.deep}
          onClick={() => setSortKey('deep')}
        />
        <div className="py-2" />
      </div>

      {/* 행 */}
      {sorted.map((invite) => {
        const name = counterpartName(invite, myUserId);
        const compat = invite.compatibility!;
        const counterGender = counterpartGender(invite, myUserId);
        const sameSex = counterGender !== null && counterGender === myGender;
        const rank = rankByInviteId.get(invite.id);
        const medal = rank ? medalForRank(rank) : null;

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
            <Cell
              score={compat.generalScore}
              locked={false}
              sameSex={false}
              medal={sortKey === 'general' ? medal : null}
              activeSort={sortKey === 'general'}
            />
            <Cell
              score={compat.romanticScore}
              locked={!isPremium}
              sameSex={sameSex}
              medal={sortKey === 'romantic' ? medal : null}
              activeSort={sortKey === 'romantic'}
            />
            <Cell
              score={compat.deepScore}
              locked={!isPremium}
              sameSex={sameSex}
              medal={sortKey === 'deep' ? medal : null}
              activeSort={sortKey === 'deep'}
            />
            <div className="flex items-center justify-end pr-1.5 text-[var(--muted-foreground)]">
              <span aria-hidden className="text-sm">›</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  active,
  enabled,
  onClick,
}: {
  label: string;
  active: boolean;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-pressed={active}
      className={`px-1 py-2 text-center transition-colors ${
        active
          ? "text-[var(--brand-gold)] font-bold"
          : enabled
            ? "hover:bg-[var(--brand-gold)]/10"
            : "opacity-50 cursor-not-allowed"
      }`}
    >
      <span>{label}</span>
      {active && <span className="ml-0.5">↓</span>}
      {!enabled && <span className="ml-0.5">🔒</span>}
    </button>
  );
}

function Cell({
  score,
  locked,
  sameSex,
  medal,
  activeSort,
}: {
  score: number | null;
  locked: boolean;
  sameSex: boolean;
  medal: string | null;
  activeSort: boolean;
}) {
  if (sameSex) {
    return (
      <div className="px-1 py-3 text-center text-xs text-[var(--muted-foreground)]">
        동성
      </div>
    );
  }
  if (locked) {
    return (
      <div className="px-1 py-3 text-center">
        <span className="text-sm">🔒</span>
      </div>
    );
  }
  if (score == null) {
    return (
      <div className="px-1 py-3 text-center text-xs text-[var(--muted-foreground)]">—</div>
    );
  }
  return (
    <div className={`px-1 py-3 text-center ${activeSort ? "bg-[var(--brand-gold)]/5" : ""}`}>
      <span className={`text-sm font-bold ${activeSort ? "text-[var(--brand-gold)]" : "text-[var(--foreground)]"}`}>
        {Math.round(Number(score))}
      </span>
      {medal && <span className="ml-0.5 text-xs">{medal}</span>}
    </div>
  );
}
