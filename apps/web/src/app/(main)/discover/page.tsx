import { Suspense } from "react";
import { Discover } from "./Discover";

// /discover — 호환성 기반 디스커버리. 단일 정적 라우트.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Discover />
    </Suspense>
  );
}
