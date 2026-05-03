import { Suspense } from "react";
import { FriendDetail } from "./FriendDetail";

// 친구 상세는 /friend-detail?id=INVITE_ID 단일 경로. dynamic route 가 아니므로
// generateStaticParams 불필요 — 정적 페이지 1개만 생성됨.
//
// useSearchParams 가 client hydration 전 prerender 단계에서 정적 fallback 필요.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <FriendDetail />
    </Suspense>
  );
}
