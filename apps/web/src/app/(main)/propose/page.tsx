import { Suspense } from "react";
import { Propose } from "./Propose";

// /propose?targetId=...&nickname=...&score=...&dayPillar=...&ageRange=...
// Capacitor 정적 export 호환을 위해 단일 정적 라우트 + query string.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Propose />
    </Suspense>
  );
}
