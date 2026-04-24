"use client";

/**
 * 매칭 대기 화면용 모티프.
 * 나중에 디자인 변경 시 이 컴포넌트만 바꿔 끼울 수 있도록 독립 컴포넌트로 분리.
 *
 * 구성:
 * - 외곽: 천천히 회전하는 나침반 링 (gold)
 * - 중앙: 緣 글자 + 그 주위를 도는 방위 (東西南北)
 * - 외부: 떠다니는 오행 한자 (木火土金水) — 각자 다른 궤도/속도
 */

interface CompassMotifProps {
  /** 전체 크기 (px). 기본 280. */
  size?: number;
}

const ELEMENTS: Array<{ char: string; color: string; angle: number; orbit: number }> = [
  { char: "木", color: "var(--element-wood)", angle: 0, orbit: 1.0 },
  { char: "火", color: "var(--element-fire)", angle: 72, orbit: 1.1 },
  { char: "土", color: "var(--element-earth)", angle: 144, orbit: 0.95 },
  { char: "金", color: "var(--element-metal)", angle: 216, orbit: 1.05 },
  { char: "水", color: "var(--element-water)", angle: 288, orbit: 1.0 },
];

const DIRECTIONS = ["東", "南", "西", "北"];

export function CompassMotif({ size = 280 }: CompassMotifProps) {
  const half = size / 2;
  const ringOuter = half - 10;
  const ringInner = ringOuter - 6;
  const elementOrbitBase = ringOuter + 28;
  const directionOrbit = ringInner - 34;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* 오행 한자 — 나침반 바깥을 떠다님 */}
      <div className="absolute inset-0 compass-orbit-slow">
        {ELEMENTS.map(({ char, color, angle, orbit }) => {
          const rad = (angle * Math.PI) / 180;
          const r = elementOrbitBase * orbit;
          const x = half + r * Math.cos(rad) - 14;
          const y = half + r * Math.sin(rad) - 14;
          return (
            <span
              key={char}
              className="absolute font-[family-name:var(--font-serif)] text-2xl compass-float"
              style={{
                left: x,
                top: y,
                color,
                animationDelay: `${angle * 10}ms`,
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* 나침반 링 — 느리게 회전 */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 compass-rotate"
      >
        {/* 외곽 링 */}
        <circle
          cx={half}
          cy={half}
          r={ringOuter}
          fill="none"
          stroke="var(--brand-gold)"
          strokeWidth={1.5}
          opacity={0.9}
        />
        {/* 내곽 링 */}
        <circle
          cx={half}
          cy={half}
          r={ringInner}
          fill="none"
          stroke="var(--brand-purple)"
          strokeWidth={1}
          opacity={0.6}
        />
        {/* 8방위 눈금 */}
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const rad = (angle * Math.PI) / 180;
          const long = i % 2 === 0;
          const len = long ? 10 : 5;
          const x1 = half + (ringOuter - len) * Math.cos(rad);
          const y1 = half + (ringOuter - len) * Math.sin(rad);
          const x2 = half + ringOuter * Math.cos(rad);
          const y2 = half + ringOuter * Math.sin(rad);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={long ? "var(--brand-gold)" : "var(--brand-purple-light)"}
              strokeWidth={long ? 1.5 : 1}
              opacity={long ? 1 : 0.5}
            />
          );
        })}
        {/* 중심 십자선 */}
        <line
          x1={half}
          y1={half - ringInner + 10}
          x2={half}
          y2={half + ringInner - 10}
          stroke="var(--brand-gold)"
          strokeWidth={0.6}
          opacity={0.3}
        />
        <line
          x1={half - ringInner + 10}
          y1={half}
          x2={half + ringInner - 10}
          y2={half}
          stroke="var(--brand-gold)"
          strokeWidth={0.6}
          opacity={0.3}
        />
        {/* 지침 (needle) */}
        <path
          d={`M ${half} ${half - ringInner + 20} L ${half - 6} ${half} L ${half} ${half + ringInner - 20} L ${half + 6} ${half} Z`}
          fill="var(--brand-purple)"
          opacity={0.8}
        />
        <circle cx={half} cy={half} r={4} fill="var(--brand-gold)" />
      </svg>

      {/* 방위 한자 — 링 안쪽에서 역회전 */}
      <div className="absolute inset-0 compass-rotate-reverse">
        {DIRECTIONS.map((ch, i) => {
          const angle = i * 90;
          const rad = (angle * Math.PI) / 180;
          const x = half + directionOrbit * Math.cos(rad) - 10;
          const y = half + directionOrbit * Math.sin(rad) - 12;
          return (
            <span
              key={ch}
              className="absolute font-[family-name:var(--font-serif)] text-base"
              style={{
                left: x,
                top: y,
                color: "var(--brand-purple)",
                opacity: 0.55,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {/* 중앙 緣 글자 — 은은하게 박동 */}
      <div
        className="absolute inset-0 flex items-center justify-center compass-pulse"
        style={{ pointerEvents: "none" }}
      >
        <span
          className="font-[family-name:var(--font-serif)] text-5xl"
          style={{ color: "var(--brand-red)" }}
        >
          緣
        </span>
      </div>

      <style jsx>{`
        .compass-rotate {
          animation: compass-spin 32s linear infinite;
          transform-origin: 50% 50%;
        }
        .compass-rotate-reverse {
          animation: compass-spin 48s linear infinite reverse;
          transform-origin: 50% 50%;
        }
        .compass-orbit-slow {
          animation: compass-spin 90s linear infinite;
          transform-origin: 50% 50%;
        }
        .compass-pulse {
          animation: compass-heart 3.2s ease-in-out infinite;
        }
        .compass-float {
          animation: compass-drift 4.5s ease-in-out infinite;
          will-change: transform, opacity;
        }
        @keyframes compass-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes compass-heart {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.95;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }
        @keyframes compass-drift {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.85;
          }
          50% {
            transform: translateY(-6px) scale(1.05);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
