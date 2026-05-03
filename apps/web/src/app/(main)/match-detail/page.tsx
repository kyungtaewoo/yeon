import { Suspense } from "react";
import { MatchDetail } from "./MatchDetail";

// 매칭 상세는 /match-detail?id=MATCH_ID 단일 경로. friend-detail 과 같은 패턴 —
// Capacitor static export 와 dynamic route 가 충돌해서 query string 으로 통일.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MatchDetail />
    </Suspense>
  );
}
