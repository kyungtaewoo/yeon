// 온보딩 영역은 비로그인(데모)도 둘러볼 수 있어야 함.
// 사주 입력 → 분석 → 선호도 → 이상형 결과까지 전부 클라이언트 사이드 계산이라 인증 불필요.
// 로그인은 프리미엄/실 매칭 단계에서만 요구.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
