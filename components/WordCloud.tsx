"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import cloud from "d3-cloud";

export interface WordCloudItem {
  text: string;
  value: number;
  sentiment: "positive" | "negative" | "neutral";
}

interface LayoutWord {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  sentiment: "positive" | "negative" | "neutral";
}

function highlightWord(text: string, word: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <b style={{ color: "var(--md-primary)" }}>{text.slice(idx, idx + word.length)}</b>
      {text.slice(idx + word.length)}
    </>
  );
}

const COLORS = {
  positive: "var(--md-primary)",
  negative: "var(--md-error)",
  neutral: "var(--md-on-surface-variant)",
};

export function WordCloud({
  words,
  width = 700,
  height = 320,
  comments,
}: {
  words: WordCloudItem[];
  width?: number;
  height?: number;
  /** 호버 시 해당 키워드 포함 댓글을 팝오버로 보여줌 */
  comments?: Array<{ text: string; likeCount?: number }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutWords, setLayoutWords] = useState<LayoutWord[]>([]);
  const [actualWidth, setActualWidth] = useState(width);
  const [hover, setHover] = useState<{ word: string; x: number; y: number } | null>(null);

  // 호버된 키워드의 매칭 댓글
  const matchedComments = hover && comments
    ? comments.filter((c) => c.text.includes(hover.word)).slice(0, 5)
    : [];

  // 메모이제이션: 단어 크기 사전 계산
  const wordInputs = useMemo(() => {
    if (words.length === 0) return [];
    const maxVal = Math.max(...words.map((w) => w.value), 1);
    return words.map((w) => ({
      text: w.text,
      size: Math.max(14, Math.min(56, 14 + (w.value / maxVal) * 42)),
      sentiment: w.sentiment,
    }));
  }, [words]);

  // 반응형 너비
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setActualWidth(Math.floor(w));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // d3-cloud 레이아웃 계산 (memoized inputs)
  useEffect(() => {
    if (wordInputs.length === 0) return;

    const layout = cloud<{ text: string; size: number; sentiment: "positive" | "negative" | "neutral" }>()
      .size([actualWidth, height])
      .words(wordInputs.map((w) => ({ ...w })))
      .padding(5)
      .rotate(() => {
        const r = Math.random();
        return r > 0.85 ? 90 : r > 0.7 ? -45 : 0;
      })
      .font("'Noto Sans KR', sans-serif")
      .fontSize((d) => d.size!)
      .spiral("archimedean")
      .on("end", (computed) => {
        setLayoutWords(
          computed.map((w: any) => ({
            text: w.text ?? "",
            size: w.size ?? 14,
            x: w.x ?? 0,
            y: w.y ?? 0,
            rotate: w.rotate ?? 0,
            sentiment: w.sentiment ?? "neutral",
          }))
        );
      });

    layout.start();
  }, [wordInputs, actualWidth, height]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 m3-body-sm" style={{ height }}>
        키워드 데이터가 없습니다
      </div>
    );
  }

  // 모바일에서 높이 축소 (320 -> 200)
  const responsiveHeight = typeof window !== "undefined" && window.innerWidth < 768
    ? Math.min(height, 200)
    : height;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={actualWidth}
        height={responsiveHeight}
        viewBox={`0 0 ${actualWidth} ${height}`}
        className="mx-auto"
        role="img"
        aria-label="워드클라우드: 키워드 빈도 및 감정 시각화"
      >
        <g transform={`translate(${actualWidth / 2},${height / 2})`}>
          {layoutWords.map((w, i) => (
            <text
              key={`${w.text}-${i}`}
              textAnchor="middle"
              transform={`translate(${w.x},${w.y})rotate(${w.rotate})`}
              style={{
                fontSize: `${w.size}px`,
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: w.size > 30 ? 700 : w.size > 20 ? 600 : 400,
                fill: hover?.word === w.text ? "var(--md-primary-dark)" : (COLORS[w.sentiment] ?? COLORS.neutral),
                cursor: comments ? "pointer" : "default",
                transition: "opacity 0.15s, fill 0.15s",
                opacity: hover && hover.word !== w.text ? 0.3 : 1,
              }}
              onMouseEnter={(e) => {
                if (!comments) return;
                const svg = e.currentTarget.closest("svg");
                const rect = svg?.getBoundingClientRect();
                if (!rect) return;
                setHover({
                  word: w.text,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }}
              onMouseLeave={() => setHover(null)}
            >
              {w.text}
            </text>
          ))}
        </g>
      </svg>

      {/* 호버 팝오버 — 해당 키워드 포함 댓글 */}
      {hover && matchedComments.length > 0 && (
        <div
          className="pointer-events-none absolute z-20 rounded-m3-md p-3"
          style={{
            width: Math.min(460, actualWidth - 32),
            left: Math.max(16, Math.min(hover.x - 230, actualWidth - 476)),
            top: hover.y + 16,
            background: "var(--md-surface-container)",
            boxShadow: "var(--md-elevation-3)",
            border: "1px solid var(--md-outline-variant)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)", fontSize: 16 }}>chat_bubble</span>
            <span className="text-xs font-semibold" style={{ color: "var(--md-primary)" }}>
              &ldquo;{hover.word}&rdquo; 포함 댓글 {matchedComments.length}개
            </span>
          </div>
          <div className="space-y-1.5">
            {matchedComments.map((c, i) => (
              <div key={i} className="rounded-m3-sm p-2 text-xs" style={{ background: "var(--md-surface-container-low)", color: "var(--md-on-surface)" }}>
                <p className="line-clamp-3">{highlightWord(c.text, hover.word)}</p>
                {c.likeCount != null && c.likeCount > 0 && (
                  <span className="mt-0.5 block text-[10px]" style={{ color: "var(--md-on-surface-variant)" }}>
                    좋아요 {c.likeCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-2 flex justify-center gap-4 m3-body-sm">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.positive }} /> 긍정
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.neutral }} /> 중립
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.negative }} /> 부정
        </span>
      </div>
    </div>
  );
}
