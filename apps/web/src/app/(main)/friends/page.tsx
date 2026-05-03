"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumBanner } from "@/components/premium/PremiumBanner";
import { usePremium } from "@/hooks/usePremium";
import { useAuthStore } from "@/stores/authStore";
import {
  createInvite,
  listFriends,
  type FriendInviteRow,
  FriendUnauthorizedError,
} from "@/lib/api/friends";
import { shareInvite } from "@/lib/share/inviteShare";
import { FriendsMatrix } from "./FriendsMatrix";

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** 내 입장에서 본 상대 닉네임 — 내가 inviter 면 invitee, 그 반대도 동일. */
function counterpartName(invite: FriendInviteRow, myUserId: string): string {
  if (invite.inviterId === myUserId) {
    return invite.invitee?.nickname ?? "이름 미상";
  }
  return invite.inviter?.nickname ?? "이름 미상";
}

/** 상대 gender. 양쪽이 매칭된 invite 에서만 의미. 동성/이성 분기용. */
function counterpartGender(
  invite: FriendInviteRow,
  myUserId: string,
): 'male' | 'female' | null {
  if (invite.inviterId === myUserId) return invite.invitee?.gender ?? null;
  return invite.inviter?.gender ?? null;
}

function ScoreLabel({
  label,
  score,
  locked,
}: {
  label: string;
  score?: number | null;
  locked: boolean;
}) {
  if (locked) {
    return (
      <span className="text-xs text-[var(--muted-foreground)]">
        {label}: <span className="text-[var(--brand-gold)]">🔒 프리미엄</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-[var(--muted-foreground)]">
      {label}: <span className="font-bold text-[var(--foreground)]">{score ?? "—"}점</span>
    </span>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const { isPremium } = usePremium();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);

  const [invites, setInvites] = useState<FriendInviteRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const list = await listFriends(token);
        if (cancelled) return;
        setInvites(list);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof FriendUnauthorizedError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(
          e instanceof Error ? e.message : "친구 목록을 불러오지 못했어요",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleInvite = async () => {
    if (!token || inviteSending) return;
    setInviteSending(true);
    try {
      const invite = await createInvite(token);
      // 새 초대를 목록 맨 앞에 즉시 반영 — listFriends 재호출 안 함.
      setInvites((prev) => [invite, ...(prev ?? [])]);

      const result = await shareInvite({
        inviteCode: invite.inviteCode,
        inviterNickname: me?.nickname ?? "",
      });
      if (result === "shared") {
        toast.success("초대를 보냈어요", {
          description: "친구가 수락하면 알림으로 알려드릴게요",
        });
      } else if (result === "fallback-copied") {
        toast.success("초대 링크가 복사됐어요", {
          description: "카카오톡에서 친구에게 붙여넣어 주세요",
        });
      }
      // "cancelled" 는 silent — 사용자가 의도적으로 닫은 것.
    } catch (e) {
      if (e instanceof FriendUnauthorizedError) {
        router.replace("/login");
        return;
      }
      toast.error("초대를 보내지 못했어요", {
        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요",
      });
    } finally {
      setInviteSending(false);
    }
  };

  // 비로그인 — 빈 상태 + 로그인 유도
  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md text-center space-y-4 mt-12">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            친구 궁합
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            로그인하고 친구를 초대해 사주 궁합을 확인해보세요
          </p>
          <Button onClick={() => router.push("/login")}>로그인하기</Button>
        </div>
      </div>
    );
  }

  const list = invites ?? [];

  // 섹션 분리:
  //  - sentPending: 내가 보낸 초대 중 아직 수락 안 된 것 (status=pending). 친구 아님.
  //  - friends: 양쪽이 연결된 invite (joined/saju_complete/calculated). "내 친구" 카운트 기준.
  //  - expired: 만료. 시각적으로 흐릿하게 별도 섹션.
  // pending 은 inviteeId 가 비어있으니 항상 내가 inviter — 별도 role 검사 불필요.
  const sentPending = list.filter((x) => x.status === "pending");
  const friends = list.filter(
    (x) =>
      x.status === "joined" ||
      x.status === "saju_complete" ||
      x.status === "calculated",
  );
  const expired = list.filter((x) => x.status === "expired");

  const calculated = friends.filter((x) => x.status === "calculated" && x.compatibility);
  const bestFriend = calculated.length
    ? [...calculated].sort(
        (a, b) =>
          (Number(b.compatibility?.generalScore ?? 0)) -
          (Number(a.compatibility?.generalScore ?? 0)),
      )[0]
    : null;

  const isEmpty =
    sentPending.length === 0 && friends.length === 0 && expired.length === 0;

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
              type="button"
              onClick={handleInvite}
              className="mt-3 bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#3C1E1E] text-sm font-bold"
            >
              카카오톡으로 초대하기
            </Button>
          </CardContent>
        </Card>

        {/* 로딩 */}
        {loading && (
          <p className="text-center text-sm text-[var(--muted-foreground)] py-6">
            불러오는 중...
          </p>
        )}

        {/* 에러 */}
        {!loading && errorMessage && (
          <Card className="border-none bg-[var(--brand-red)]/5">
            <CardContent className="py-4 text-center text-sm text-[var(--brand-red)]">
              {errorMessage}
            </CardContent>
          </Card>
        )}

        {/* 빈 상태 — 어느 섹션에도 invite 없을 때 */}
        {!loading && !errorMessage && isEmpty && (
          <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                아직 친구가 없어요
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                위 버튼으로 친구를 초대해보세요
              </p>
            </CardContent>
          </Card>
        )}

        {/* 보낸 초대 (수락 대기) — 친구 카운트엔 포함 X */}
        {!loading && !errorMessage && sentPending.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
              보낸 초대 ({sentPending.length}개)
              <span className="ml-1 text-xs">· 수락 대기</span>
            </p>
            <div className="space-y-3">
              {sentPending.map((invite) => (
                <Card key={invite.id} className="border-none shadow-sm bg-[var(--muted)]/40">
                  <CardContent className="py-3">
                    <span className="font-medium text-[var(--muted-foreground)]">
                      친구가 아직 수락하지 않았어요
                    </span>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      초대 {timeSince(invite.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 내 친구 — 수락된 invite 만 (joined / saju_complete / calculated)
            계산 완료 ≥3 명: 매트릭스 / <3: 카드 (Q4=B 결정)
            joined / saju_complete: 항상 카드 (계산 대기 안내) */}
        {!loading && !errorMessage && friends.length > 0 && me && (
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
              내 친구 ({friends.length}명)
            </p>

            {/* 매트릭스 — calculated 3명+ 만 노출 */}
            {calculated.length >= 3 && (
              <div className="mb-4">
                <FriendsMatrix
                  friends={calculated}
                  myUserId={me.id}
                  myGender={me.gender as 'male' | 'female'}
                  isPremium={isPremium}
                />
                <p className="mt-2 text-[10px] text-[var(--muted-foreground)] text-center">
                  * 일반 궁합 점수 기준 정렬 · 메달 = 1·2·3위
                </p>
              </div>
            )}

            {/* 카드 — calculated <3 인 경우 OR 사주 미완 친구 (joined/saju_complete) */}
            <div className="space-y-3">
              {friends
                .filter((invite) => {
                  // calculated 가 3명 이상이면 매트릭스에 표시되니 카드 영역에서 제외
                  if (calculated.length >= 3 && invite.status === "calculated") return false;
                  return true;
                })
                .map((invite) => {
                  const name = counterpartName(invite, me.id);
                  const compat = invite.compatibility ?? null;

                  if (invite.status === "calculated" && compat) {
                    const counterGender = counterpartGender(invite, me.id);
                    const sameSex =
                      counterGender !== null && counterGender === me.gender;
                    return (
                      <Card key={invite.id} className="border-none shadow-sm">
                        <CardContent className="py-3">
                          <Link
                            href={`/friend-detail?id=${encodeURIComponent(invite.id)}`}
                            className="block"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-[var(--foreground)]">
                                {name}
                              </span>
                              <span className="text-xs text-[var(--muted-foreground)]">
                                상세보기 &rarr;
                              </span>
                            </div>
                            <div className="space-y-1">
                              <ScoreLabel
                                label="일반 궁합"
                                score={compat.generalScore}
                                locked={false}
                              />
                              {!sameSex && (
                                <>
                                  <br />
                                  <ScoreLabel
                                    label="연인 궁합"
                                    score={compat.romanticScore}
                                    locked={!isPremium}
                                  />
                                  <br />
                                  <ScoreLabel
                                    label="깊은 궁합"
                                    score={compat.deepScore}
                                    locked={!isPremium}
                                  />
                                </>
                              )}
                            </div>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  }

                  const subText =
                    invite.status === "joined"
                      ? "친구가 사주 입력 중이에요"
                      : "양쪽 사주 완비 — 잠시 후 계산돼요";
                  return (
                    <Card key={invite.id} className="border-none shadow-sm">
                      <CardContent className="py-3">
                        <span className="font-medium text-[var(--foreground)]">
                          {name}
                        </span>
                        <p className="text-xs text-[var(--muted-foreground)]">{subText}</p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        {/* 만료된 초대 — 정리 차원에서 마지막 섹션, 흐리게 */}
        {!loading && !errorMessage && expired.length > 0 && me && (
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
              만료된 초대 ({expired.length}개)
            </p>
            <div className="space-y-3">
              {expired.map((invite) => (
                <Card key={invite.id} className="border-none shadow-sm">
                  <CardContent className="py-3 opacity-60">
                    <span className="font-medium text-[var(--muted-foreground)]">
                      {counterpartName(invite, me.id)}
                    </span>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      만료됨 · {timeSince(invite.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 통계 — 수락된 친구 기준 */}
        {!loading && calculated.length > 0 && (
          <div className="text-center text-xs text-[var(--muted-foreground)] py-2">
            친구 {friends.length}명 · {calculated.length}명 궁합 확인 완료
            {bestFriend && me && (
              <>
                <br />
                가장 궁합 좋은 친구: {counterpartName(bestFriend, me.id)} (
                {bestFriend.compatibility?.generalScore}점)
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
