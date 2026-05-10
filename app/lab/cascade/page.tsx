"use client";

import { useState } from "react";
import Link from "next/link";
import { LabKeywordInput } from "@/components/lab/LabKeywordInput";
import { LabResultCard, LabErrorCard, LabEmptyCard } from "@/components/lab/LabResultCard";

interface CascadeEvent {
  platform: "youtube" | "news" | "search";
  date: string;
  title: string;
  lag: number;
}

interface CascadeData {
  events: CascadeEvent[];
  pattern: "youtube-first" | "news-first" | "simultaneous" | "search-only";
  spikePeak: string;
}

interface CascadeResponse {
  keyword: string;
  cascade: CascadeData;
  narrative: string;
  insight: string;
  meta: { newsCount: number; videoCount: number; trendDays: number };
}

const PLATFORM_CONFIG = {
  youtube: { icon: "smart_display", label: "YouTube", color: "#FF0000" },
  news: { icon: "newspaper", label: "뉴스", color: "var(--md-primary)" },
  search: { icon: "trending_up", label: "검색", color: "#1565C0" },
} as const;

const PATTERN_LABELS: Record<CascadeData["pattern"], string> = {
  "youtube-first": "유튜브 선행",
  "news-first": "뉴스 선행",
  simultaneous: "동시 발생",
  "search-only": "검색 단독",
};

const PATTERN_ICONS: Record<CascadeData["pattern"], string> = {
  "youtube-first": "smart_display",
  "news-first": "newspaper",
  simultaneous: "sync",
  "search-only": "trending_up",
};

export default function CascadePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CascadeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(keyword: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lab/cascade", {
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
        <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>share</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>
            유행 확산 분석
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Cascade Detection</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Diffusion Analysis</span>
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px]" style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>Temporal Propagation Tracking</span>
          </div>
          <p className="mt-1 m3-body-sm">유행이 어디에서 시작되어 어떻게 퍼졌는지 분석합니다. 유튜브, 뉴스, 검색량의 시간 흐름을 비교해 확산 경로를 추적합니다.</p>
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--md-primary)" }}>&ldquo;유행의 시작점과 퍼져나간 흐름을 추적합니다.&rdquo;</p>
        </div>
      </div>

      {/* 입력 */}
      <LabKeywordInput onSubmit={handleSubmit} loading={loading} placeholder="분석할 키워드 입력 (예: 탕후루, 로제 파스타)" />

      {/* 에러 */}
      {error && <LabErrorCard message={error} />}

      {/* 결과 */}
      {result ? (
        <div className="space-y-4">
          {/* 패턴 배지 + 수집 요약 */}
          <LabResultCard
            icon="share"
            title={`"${result.keyword}" 유행 확산 분석`}
            subtitle={`검색 급등일: ${result.cascade.spikePeak}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* 패턴 배지 */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
                style={{
                  background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))",
                  color: "var(--md-primary)",
                }}
              >
                <span className="m3-icon-sm" style={{ fontSize: 16 }}>
                  {PATTERN_ICONS[result.cascade.pattern]}
                </span>
                {PATTERN_LABELS[result.cascade.pattern]}
              </span>

              {/* 수집 데이터 요약 */}
              <div className="flex flex-wrap gap-3 m3-body-sm">
                <span className="flex items-center gap-1">
                  <span className="m3-icon-sm" style={{ fontSize: 14, color: "#FF0000" }}>smart_display</span>
                  영상 {result.meta.videoCount}건
                </span>
                <span className="flex items-center gap-1">
                  <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>newspaper</span>
                  뉴스 {result.meta.newsCount}건
                </span>
                <span className="flex items-center gap-1">
                  <span className="m3-icon-sm" style={{ fontSize: 14, color: "#1565C0" }}>trending_up</span>
                  트렌드 {result.meta.trendDays}일
                </span>
              </div>
            </div>
          </LabResultCard>

          {/* 타임라인 */}
          <LabResultCard icon="timeline" title="확산 타임라인" subtitle="트렌드가 플랫폼 간에 퍼진 순서">
            <div className="relative">
              {/* 타임라인 줄 */}
              <div
                className="absolute left-5 top-0 bottom-0 w-0.5"
                style={{ background: "var(--md-outline-variant)" }}
              />

              <div className="space-y-4">
                {result.cascade.events.map((event, i) => {
                  const config = PLATFORM_CONFIG[event.platform];
                  return (
                    <div key={i} className="relative flex items-start gap-4 pl-1">
                      {/* 아이콘 노드 */}
                      <div
                        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `color-mix(in srgb, ${config.color} 15%, var(--md-surface-container))`,
                        }}
                      >
                        <span className="m3-icon-sm" style={{ fontSize: 20, color: config.color }}>
                          {config.icon}
                        </span>
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: config.color }}>
                            {config.label}
                          </span>
                          <span className="m3-body-sm">{event.date}</span>
                          {event.lag !== 0 && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                background: event.lag < 0
                                  ? "color-mix(in srgb, #4CAF50 12%, var(--md-surface-container))"
                                  : "color-mix(in srgb, var(--md-error) 12%, var(--md-surface-container))",
                                color: event.lag < 0 ? "#2E7D32" : "var(--md-error)",
                              }}
                            >
                              {event.lag < 0 ? `${Math.abs(event.lag)}일 선행` : `${event.lag}일 후행`}
                            </span>
                          )}
                          {event.lag === 0 && event.platform === "search" && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                background: "color-mix(in srgb, #1565C0 12%, var(--md-surface-container))",
                                color: "#1565C0",
                              }}
                            >
                              급등 기준점
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-0.5 text-sm leading-relaxed"
                          style={{ color: "var(--md-on-surface-variant)" }}
                        >
                          {event.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </LabResultCard>

          {/* AI 해석 */}
          <LabResultCard icon="auto_awesome" title="AI 해석" subtitle={result.insight}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--md-on-surface)" }}>
              {result.narrative}
            </p>
          </LabResultCard>
        </div>
      ) : (
        !loading && !error && <LabEmptyCard />
      )}
    </div>
  );
}
