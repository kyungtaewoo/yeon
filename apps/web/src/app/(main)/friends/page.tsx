"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumBanner } from "@/components/premium/PremiumBanner";
import { usePremium } from "@/hooks/usePremium";
import Link from "next/link";

// 임시 목 데이터 (추후 API 연동)
interface FriendItem {
  inviteId: string;
  nickname: string;
  status: "completed" | "pending" | "expired";
  generalScore?: number;
  romanticScore?: number;
  deepScore?: number;
  sentAt: string;
}

const MOCK_FRIENDS: FriendItem[] = [
  {
    inviteId: "1",
    nickname: "수진",
    status: "completed",
    generalScore: 82,
    romanticScore: 88,
    deepScore: 92,
    sentAt: "2026-04-08T10:00:00Z",
  },
  {
    inviteId: "2",
    nickname: "민수",
    status: "completed",
    generalScore: 71,
    romanticScore: 65,
    deepScore: 58,
    sentAt: "2026-04-07T14:00:00Z",
  },
  {
    inviteId: "3",
    nickname: "현우",
    status: "pending",
    sentAt: "2026-04-09T06:00:00Z",
  },
  {
    inviteId: "4",
    nickname: "지은",
    status: "expired",
    sentAt: "2026-03-30T10:00:00Z",
  },
];

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function ScoreLabel({ label, score, locked }: { label: string; score?: number; locked: boolean }) {
  if (locked) {
    return (
      <span className="text-xs text-[var(--muted-foreground)]">
        {label}: <span className="text-[var(--brand-gold)]">🔒 프리미엄</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-[var(--muted-foreground)]">
      {label}: <span className="font-bold text-[var(--foreground)]">{score}점</span>
    </span>
  );
}

export default function FriendsPage() {
  const { isPremium } = usePremium();
  const [friends] = useState<FriendItem[]>(MOCK_FRIENDS);

  const completedFriends = friends.filter(f => f.status === "completed");
  const bestFriend = completedFriends.sort((a, b) => (b.generalScore ?? 0) - (a.generalScore ?? 0))[0];

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          친구 궁합
        </h1>

        {/* 초대 버튼 */}
        <Card className="border-none shadow-md bg-[var(--brand-red)]/5">
          <CardContent className="py-4 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">
              카카오톡으로 친구를 초대하고
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              사주 궁합을 확인해보세요
            </p>
            <Button
              className="mt-3 bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#3C1E1E] text-sm font-bold"
            >
              카카오톡으로 초대하기
            </Button>
          </CardContent>
        </Card>

        {/* 친구 목록 */}
        <div>
          <p className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
            내 친구 ({friends.length}명)
          </p>

          <div className="space-y-3">
            {friends.map((friend) => (
              <Card key={friend.inviteId} className="border-none shadow-sm">
                <CardContent className="py-3">
                  {friend.status === "completed" ? (
                    <Link href={`/friends/${friend.inviteId}`} className="block">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[var(--foreground)]">
                          {friend.nickname}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          상세보기 &rarr;
                        </span>
                      </div>
                      <div className="space-y-1">
                        <ScoreLabel label="일반 궁합" score={friend.generalScore} locked={false} />
                        <br />
                        <ScoreLabel label="연인 궁합" score={friend.romanticScore} locked={!isPremium} />
                        <br />
                        <ScoreLabel label="깊은 궁합" score={friend.deepScore} locked={!isPremium} />
                      </div>
                    </Link>
                  ) : friend.status === "pending" ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-[var(--muted-foreground)]">
                          {friend.nickname}
                        </span>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          사주 입력 대기 중 &middot; 초대 {timeSince(friend.sentAt)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs">
                        다시 초대
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between opacity-60">
                      <div>
                        <span className="font-medium text-[var(--muted-foreground)]">
                          {friend.nickname}
                        </span>
                        <p className="text-xs text-[var(--muted-foreground)]">만료됨</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs">
                        다시 초대
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 통계 */}
        {completedFriends.length > 0 && (
          <div className="text-center text-xs text-[var(--muted-foreground)] py-2">
            총 {friends.length}명 초대 &middot; {completedFriends.length}명 궁합 확인 완료
            {bestFriend && (
              <>
                <br />
                가장 궁합 좋은 친구: {bestFriend.nickname} ({bestFriend.generalScore}점)
              </>
            )}
          </div>
        )}

        {/* 프리미엄 배너 */}
        {!isPremium && <PremiumBanner />}
      </div>
    </div>
  );
}
