"use client";

import { useRef } from "react";
import type { FourPillars, Element, ElementScores } from "@/lib/saju/types";
import { STEM_KOREAN, BRANCH_KOREAN, ELEMENT_NAMES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "@/lib/saju/constants";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "#4a7c59", fire: "#c4493c", earth: "#c9a84c", metal: "#8a8a8a", water: "#2d5f8a",
};

interface SajuCardProps {
  pillars: FourPillars;
  elementScores: ElementScores;
  dominantElement: Element;
}

export function SajuCard({ pillars, elementScores, dominantElement }: SajuCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (navigator.share) {
      const text = formatShareText(pillars, dominantElement);
      await navigator.share({
        title: "緣 — 나의 사주",
        text,
        url: window.location.origin,
      });
    } else {
      // 클립보드에 복사
      const text = formatShareText(pillars, dominantElement);
      await navigator.clipboard.writeText(text);
      alert("사주 정보가 클립보드에 복사되었습니다!");
    }
  };

  const elements: Element[] = ["wood", "fire", "earth", "metal", "water"];
  const maxScore = Math.max(...elements.map(e => elementScores[e]));

  return (
    <div>
      <div
        ref={cardRef}
        style={{
          background: "linear-gradient(135deg, #8b2f3a 0%, #5a1f28 100%)",
          borderRadius: 16,
          padding: "24px 20px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 배경 장식 */}
        <div style={{
          position: "absolute", top: -30, right: -30, fontSize: 120,
          opacity: 0.06, fontFamily: "serif", fontWeight: "bold",
        }}>
          緣
        </div>

        {/* 상단 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#e8d5a0", letterSpacing: 2 }}>MY SAJU CARD</p>
          <p style={{ fontSize: 24, fontFamily: "serif", fontWeight: 700, color: "#e8d5a0", marginTop: 4 }}>
            나의 사주팔자
          </p>
        </div>

        {/* 4기둥 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[
            { label: "시", pillar: pillars.hour },
            { label: "일", pillar: pillars.day },
            { label: "월", pillar: pillars.month },
            { label: "년", pillar: pillars.year },
          ].map(({ label, pillar }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "#c4757e", marginBottom: 4 }}>{label}주</p>
              {pillar ? (
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 4px" }}>
                  <p style={{ fontSize: 22, fontFamily: "serif", fontWeight: 700, color: "#e8d5a0" }}>
                    {pillar.stem}
                  </p>
                  <p style={{ fontSize: 9, color: "#c4757e" }}>
                    {STEM_KOREAN[pillar.stem]}
                  </p>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "4px 0" }} />
                  <p style={{ fontSize: 22, fontFamily: "serif", fontWeight: 700, color: "#e8d5a0" }}>
                    {pillar.branch}
                  </p>
                  <p style={{ fontSize: 9, color: "#c4757e" }}>
                    {BRANCH_KOREAN[pillar.branch]}
                  </p>
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "16px 4px" }}>
                  <p style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>?</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 오행 바 */}
        <div style={{ marginBottom: 16 }}>
          {elements.map(el => {
            const pct = maxScore > 0 ? (elementScores[el] / maxScore) * 100 : 0;
            return (
              <div key={el} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 20, fontSize: 12, fontFamily: "serif", fontWeight: 700, color: ELEMENT_COLORS[el] }}>
                  {ELEMENT_NAMES[el].hanja}
                </span>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: ELEMENT_COLORS[el], borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 주요 오행 */}
        <div style={{ textAlign: "center" }}>
          <span style={{
            display: "inline-block", padding: "4px 16px", borderRadius: 20,
            background: "rgba(232,213,160,0.15)", color: "#e8d5a0",
            fontSize: 12, fontWeight: 500,
          }}>
            {ELEMENT_NAMES[dominantElement].hanja}({ELEMENT_NAMES[dominantElement].ko}) 기운이 강한 사주
          </span>
        </div>

        {/* 하단 */}
        <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 16 }}>
          緣 (연) — saju.yeon.app
        </p>
      </div>

      {/* 공유 버튼 */}
      <button
        onClick={handleShare}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "12px 0",
          borderRadius: 10,
          border: "1px solid #c9a84c",
          background: "transparent",
          color: "#c9a84c",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        내 사주 카드 공유하기
      </button>
    </div>
  );
}

function formatShareText(pillars: FourPillars, dominant: Element): string {
  const dayStem = pillars.day.stem;
  const dayBranch = pillars.day.branch;
  const elName = ELEMENT_NAMES[dominant];
  return `🔮 나의 사주팔자

연주: ${pillars.year.stem}${pillars.year.branch} (${STEM_KOREAN[pillars.year.stem]}${BRANCH_KOREAN[pillars.year.branch]})
월주: ${pillars.month.stem}${pillars.month.branch} (${STEM_KOREAN[pillars.month.stem]}${BRANCH_KOREAN[pillars.month.branch]})
일주: ${dayStem}${dayBranch} (${STEM_KOREAN[dayStem]}${BRANCH_KOREAN[dayBranch]})
${pillars.hour ? `시주: ${pillars.hour.stem}${pillars.hour.branch} (${STEM_KOREAN[pillars.hour.stem]}${BRANCH_KOREAN[pillars.hour.branch]})` : "시주: 미상"}

주요 기운: ${elName.hanja}(${elName.ko})

🔗 緣 (연) — 사주궁합 매칭`;
}
