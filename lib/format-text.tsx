import React from "react";

/**
 * 텍스트 안의 마크다운 기호를 디자인 요소로 변환.
 * - **bold** → 청록 배경 + 흰 굵은 글씨
 * - # 헤딩 → 제거
 * - H1, H2, H3 → 가설1, 가설2, 가설3
 * - high confidence → "높은 확신"
 * - low confidence → "낮은 확신"
 */
export function FormatText({ text }: { text: string }): React.ReactElement {
  if (!text) return <></>;

  // 전처리: 용어 치환
  let processed = text
    .replace(/^#{1,6}\s+/gm, "") // # 헤딩 제거
    .replace(/H1\b/g, "가설 1")
    .replace(/H2\b/g, "가설 2")
    .replace(/H3\b/g, "가설 3")
    .replace(/high confidence/gi, "높은 확신")
    .replace(/medium confidence/gi, "보통 확신")
    .replace(/low confidence/gi, "낮은 확신")
    .replace(/confidence/gi, "확신도");

  // **bold** → 청록 강조 칩
  const parts = processed.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
          return (
            <span
              key={i}
              className="inline rounded px-1.5 py-0.5 text-sm font-bold"
              style={{
                background: "color-mix(in srgb, var(--md-primary) 15%, var(--md-surface-container))",
                color: "var(--md-primary)",
              }}
            >
              {boldMatch[1]}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
