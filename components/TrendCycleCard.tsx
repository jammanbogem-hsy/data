"use client";

import { useMemo } from "react";
import type { TrendCycle, CycleAnalysis } from "@/lib/trend-cycle";
import { WordCloud } from "./WordCloud";

interface NewsItem {
  title: string;
  description: string;
  pubDate: string;
}

const POS = ["좋","최고","인기","성공","흥행","대박","호평","사랑","추천","만족","감동","기대","응원","히트","화제","열풍","맛있","편리","혁신","멋지","재미","신나"];
const NEG = ["논란","비판","문제","우려","위기","하락","불만","실패","취소","반발","불안","비싼","부담","최악","실망","걱정","갈등","적발","의혹","부진"];

const PATTERN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  annual: { label: "매년 반복", color: "var(--md-primary)", bg: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))" },
  seasonal: { label: "계절 반복", color: "#1565C0", bg: "color-mix(in srgb, #1565C0 12%, var(--md-surface-container))" },
  "one-time": { label: "1회성", color: "var(--md-on-surface-variant)", bg: "var(--md-surface-container-high)" },
  irregular: { label: "비주기적", color: "#F57F17", bg: "color-mix(in srgb, #F57F17 12%, var(--md-surface-container))" },
};

export function TrendCycleCard({
  analysis,
  news,
  keyword,
}: {
  analysis: CycleAnalysis;
  news: NewsItem[];
  keyword: string;
}) {
  if (analysis.cycles.length === 0) return null;

  return (
    <section className="m3-section">
      <div className="flex items-center justify-between">
        <h3 className="m3-section-title">
          <span className="m3-icon" style={{ color: "var(--md-primary)" }}>show_chart</span>
          유행 사이클 감지
        </h3>
        {(() => {
          const badge = PATTERN_BADGE[analysis.pattern] ?? PATTERN_BADGE["one-time"];
          return (
            <span className="rounded-m3-md px-3 py-1.5 text-xs font-semibold" style={{ color: badge.color, background: badge.bg }}>
              {badge.label}
            </span>
          );
        })()}
      </div>

      <p className="m3-body-sm">{analysis.patternDescription}</p>

      {/* 사이클 카드 */}
      <div className="grid gap-3 md:grid-cols-2">
        {analysis.cycles.slice(0, 4).map((cycle, i) => (
          <CycleMiniCard key={i} cycle={cycle} index={i} news={news} keyword={keyword} />
        ))}
      </div>

      {/* 주기성 인사이트 */}
      {analysis.cycles.length >= 2 && (
        <div className="m3-card" style={{ background: "var(--md-surface-container-low)" }}>
          <div className="flex items-start gap-2">
            <span className="m3-icon shrink-0" style={{ color: "var(--md-primary)" }}>insights</span>
            <div>
              <div className="m3-title-sm">주기성 분석</div>
              <p className="mt-1 m3-body-sm">
                {analysis.isRecurring
                  ? `이 키워드는 ${analysis.pattern === "annual" ? "매년" : `약 ${Math.round((analysis.recurringIntervalDays ?? 0) / 30)}개월마다`} 비슷한 패턴으로 유행이 돌아옵니다. 다음 유행을 예측할 수 있는 근거가 됩니다.`
                  : analysis.cycles.length === 1
                    ? "이 유행은 1회성으로 보입니다. 특정 사건이나 콘텐츠에 의한 일시적 관심일 가능성이 높습니다."
                    : `${analysis.cycles.length}번의 유행이 있었지만 규칙적인 주기는 발견되지 않았습니다. 각 유행마다 다른 원인이 작용했을 수 있습니다.`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CycleMiniCard({ cycle, index, news, keyword }: { cycle: TrendCycle; index: number; news: NewsItem[]; keyword: string }) {
  // 해당 기간의 뉴스에서 키워드 + 감정 추출
  const cycleAnalysis = useMemo(() => {
    const inRange = news.filter((n) => {
      const d = n.pubDate?.slice(0, 10);
      return d && d >= cycle.startPeriod && d <= cycle.endPeriod;
    });
    // 범위 내 뉴스 없으면 전체에서 키워드 매칭
    const target = inRange.length >= 3 ? inRange : news.slice(0, 30);

    const wordCounts = new Map<string, number>();
    let pos = 0, neg = 0, neu = 0;

    for (const n of target) {
      const text = `${n.title} ${n.description ?? ""}`;
      const hasPos = POS.some((w) => text.includes(w));
      const hasNeg = NEG.some((w) => text.includes(w));
      if (hasPos && !hasNeg) pos++; else if (hasNeg) neg++; else neu++;

      const tokens = text.match(/[가-힣]{2,6}/g) ?? [];
      for (const t of tokens) {
        if (t === keyword || t.length < 2) continue;
        wordCounts.set(t, (wordCounts.get(t) ?? 0) + 1);
      }
    }

    const total = Math.max(pos + neg + neu, 1);
    const topWords = Array.from(wordCounts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([w, c]) => ({
        text: w,
        value: c,
        sentiment: (POS.some((p) => w.includes(p)) ? "positive" : NEG.some((ng) => w.includes(ng)) ? "negative" : "neutral") as "positive" | "negative" | "neutral",
      }));

    return {
      newsCount: target.length,
      posP: Math.round((pos / total) * 100),
      negP: Math.round((neg / total) * 100),
      neuP: Math.round((neu / total) * 100),
      topWords,
      matchedNews: target,
    };
  }, [cycle, news, keyword]);

  return (
    <div className="m3-card space-y-3">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="m3-label-sm">유행 {index + 1}</div>
          <div className="mt-0.5 text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>
            {cycle.startPeriod.slice(5)} ~ {cycle.endPeriod.slice(5)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ color: "var(--md-primary)" }}>x{cycle.intensity}</div>
          <div className="m3-body-sm">{cycle.durationDays}일간</div>
        </div>
      </div>

      {/* 타임라인 바 */}
      <div className="flex items-center gap-2 m3-body-sm">
        <span>{cycle.startPeriod.slice(5)}</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--md-surface-container-high)" }}>
          <div
            className="h-full rounded-full"
            style={{
              background: "var(--md-primary)",
              width: `${Math.min(100, ((cycle.peakIdx - cycle.startIdx) / Math.max(cycle.endIdx - cycle.startIdx, 1)) * 100)}%`,
            }}
          />
        </div>
        <span>{cycle.endPeriod.slice(5)}</span>
      </div>
      <div className="m3-body-sm text-center">
        피크 {cycle.peakPeriod} (ratio {cycle.peakRatio.toFixed(1)})
      </div>

      {/* 감정 분포 */}
      <div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
          <div className="flex h-full">
            <div style={{ width: `${cycleAnalysis.posP}%`, background: "var(--md-primary)" }} />
            <div style={{ width: `${cycleAnalysis.neuP}%`, background: "var(--md-outline)" }} />
            <div style={{ width: `${cycleAnalysis.negP}%`, background: "var(--md-error)" }} />
          </div>
        </div>
        <div className="mt-1 flex gap-3 m3-body-sm">
          <span>긍정 {cycleAnalysis.posP}%</span>
          <span>중립 {cycleAnalysis.neuP}%</span>
          <span>부정 {cycleAnalysis.negP}%</span>
        </div>
      </div>

      {/* 워드클라우드 — 호버 시 해당 키워드 포함 뉴스 표시 */}
      {cycleAnalysis.topWords.length > 0 && (
        <WordCloud
          words={cycleAnalysis.topWords}
          height={160}
          comments={cycleAnalysis.matchedNews.map((n) => ({ text: `${n.title} — ${n.description ?? ""}`, likeCount: 0 }))}
        />
      )}
    </div>
  );
}
