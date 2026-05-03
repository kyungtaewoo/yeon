import { Suspense } from "react";
import { InviteWelcome } from "./InviteWelcome";

// output: export 모드에서 dynamic route 가 빌드되려면 generateStaticParams 가 최소 1개
// path 를 반환해야 함. 초대 코드는 런타임에 발급되므로 placeholder 1 개만 생성 — 실제
// 사용은 NativeBridge 의 client-side router.replace 가 처리하며, 이 placeholder URL 로
// 외부 진입은 발생하지 않음.
export function generateStaticParams() {
  return [{ code: "__placeholder__" }];
}

// useSearchParams 가 client 에서 hydrate 되기 전 prerender 단계에서 정적 fallback
// 이 필요 — 빈 fallback 으로 두면 Welcome 자체 loading 상태가 즉시 takeover.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <InviteWelcome />
    </Suspense>
  );
}
