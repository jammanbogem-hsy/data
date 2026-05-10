"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface TimelineEntry {
  period: string;
  dominantEmotion: string;
  emotions: Record<string, number>;
  quote: string;
}

interface EmotionResult {
  keyword: string;
  timeline: TimelineEntry[];
  arc: string;
  turningPoint: string;
  meta: { newsCount: number; commentCount: number };
}

const EMOTION_COLORS: Record<string, string> = {
  기대: "#FFC107",
  흥분: "#FF5722",
  걱정: "#9E9E9E",
  피곤: "#607D8B",
  만족: "var(--md-primary)",
  실망: "#B3261E",
  무관심: "#BDBDBD",
  분노: "#D32F2F",
};

function getEmotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion] ?? "var(--md-on-surface-variant)";
}

export default function EmotionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmotionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/lab" className="m3-icon-sm no-underline" style={{ color: "var(--md-on-surface-variant)" }}>
          arrow_back
        </Link>
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>mood</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            감정 흐름 분석
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Emotion Trajectory</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Sentiment Timeline Analysis</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Temporal Emotion Modeling</span>
          </div>
          <p className="mt-1 m3-body-sm">사람들의 감정이 시간에 따라 어떻게 변화했는지 분석합니다. 기대감, 걱정, 만족 같은 감정의 흐름을 이벤트 전후로 추적합니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;사회 분위기와 감정은 어떻게 변했을까요?&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: AI, 교권)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 타임라인 요약 */}
          <LabResultCard icon="mood" title={`"${result.keyword}" 감정 흐름`} subtitle="최근 90일간 대중 감정 변화">
            <div className="flex flex-wrap gap-3 m3-body-sm">
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span>
                뉴스 {result.meta.newsCount}건
              </span>
              <span className="flex items-center gap-1">
                <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>chat</span>
                댓글 {result.meta.commentCount}건
              </span>
            </div>
          </LabResultCard>

          {/* 감정 타임라인 */}
          <div className="m3-card overflow-x-auto">
            <div className="flex min-w-[600px] relative">
              {/* 연결선 */}
              <div
                className="absolute top-8 left-[10%] right-[10%] h-0.5"
                style={{ background: "var(--md-outline-variant)" }}
              />

              {result.timeline.map((entry, i) => {
                const color = getEmotionColor(entry.dominantEmotion);
                const emotions = Object.entries(entry.emotions)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4);

                return (
                  <div key={i} className="flex-1 flex flex-col items-center px-2 relative z-10">
                    {/* 기간 라벨 */}
                    <span
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--md-on-surface-variant)" }}
                    >
                      {entry.period}
                    </span>

                    {/* 감정 노드 */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm"
                      style={{ background: color, color: "#fff" }}
                    >
                      <span className="text-[10px] font-bold">
                        {entry.dominantEmotion.slice(0, 2)}
                      </span>
                    </div>

                    {/* 감정명 */}
                    <span className="text-sm font-bold mb-2" style={{ color }}>
                      {entry.dominantEmotion}
                    </span>

                    {/* 감정 비율 바 */}
                    <div className="w-full space-y-1 mb-2">
                      {emotions.map(([emotion, pct]) => (
                        <div key={emotion} className="flex items-center gap-1">
                          <span
                            className="text-[10px] w-8 text-right shrink-0"
                            style={{ color: "var(--md-on-surface-variant)" }}
                          >
                            {emotion}
                          </span>
                          <div
                            className="h-1.5 flex-1 rounded-full overflow-hidden"
                            style={{ background: "var(--md-surface-container-high)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: getEmotionColor(emotion),
                              }}
                            />
                          </div>
                          <span
                            className="text-[9px] w-6 shrink-0"
                            style={{ color: "var(--md-on-surface-variant)" }}
                          >
                            {pct}%
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 대표 인용 */}
                    <p
                      className="text-[11px] italic text-center leading-tight"
                      style={{ color: "var(--md-on-surface-variant)" }}
                    >
                      &ldquo;{entry.quote.slice(0, 40)}{entry.quote.length > 40 ? "..." : ""}&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 감정 변화 스토리 */}
          <LabResultCard icon="auto_stories" title="감정 변화 스토리" subtitle="전체 흐름 요약">
            <p className="m3-body-sm" style={{ color: "var(--md-on-surface)", lineHeight: 1.7 }}>
              {result.arc}
            </p>
          </LabResultCard>

          {/* 전환점 */}
          <LabResultCard icon="trending_up" title="감정 전환점" subtitle="감정이 크게 바뀐 순간">
            <div
              className="rounded-xl p-3"
              style={{ background: "color-mix(in srgb, var(--md-primary) 8%, var(--md-surface-container))" }}
            >
              <p className="m3-body-sm font-medium" style={{ color: "var(--md-on-surface)" }}>
                {result.turningPoint}
              </p>
            </div>
          </LabResultCard>
        </div>
      ) : (
        !loading && !error && <LabEmptyCard />
      )}
    </div>
  );
}
