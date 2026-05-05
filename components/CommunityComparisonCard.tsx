"use client";

export interface CommunityPlatformInsight {
  platform: "naver_news" | "naver_blog" | "youtube_comments";
  platformLabel: string;
  sampleSize: number;
  sentiment: { positive: number; negative: number; neutral: number };
  dominantTone: string;
  keyTerms: string[];
  representativeQuotes: Array<{ text: string; sentiment: "positive" | "negative" | "neutral" }>;
  uniqueAngle: string;
}

export interface CommunityComparisonData {
  platforms: CommunityPlatformInsight[];
  comparison: string;
  divergence: "high" | "medium" | "low";
}

const PLATFORM_ICON: Record<string, string> = {
  naver_news: "newspaper",
  naver_blog: "edit_note",
  youtube_comments: "chat",
};

const DIVERGENCE = {
  high: { text: "온도차 큼", bg: "var(--md-error)", color: "white" },
  medium: { text: "보통 차이", bg: "#F57F17", color: "white" },
  low: { text: "비슷함", bg: "var(--md-outline)", color: "var(--md-on-surface)" },
};

export function CommunityComparisonCard({ data }: { data: CommunityComparisonData }) {
  const div = DIVERGENCE[data.divergence] ?? DIVERGENCE.medium;

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-m3-sm px-2.5 py-1 text-[11px] font-semibold" style={{ background: div.bg, color: div.color }}>
          {div.text}
        </span>
        <p className="flex-1 m3-body-sm leading-relaxed">{data.comparison}</p>
      </div>

      {/* 플랫폼 카드 3개 */}
      <div className="grid gap-3 md:grid-cols-3">
        {data.platforms.map((p) => {
          const icon = PLATFORM_ICON[p.platform] ?? "article";
          const total = Math.max(p.sentiment.positive + p.sentiment.negative + p.sentiment.neutral, 1);
          return (
            <div key={p.platform} className="m3-card flex flex-col gap-3">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="m3-icon" style={{ color: "var(--md-primary)" }}>{icon}</span>
                  <span className="m3-title-sm">{p.platformLabel}</span>
                </div>
                <span className="m3-body-sm">n={p.sampleSize}</span>
              </div>

              {/* 감정 바 */}
              <div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
                  <div className="flex h-full">
                    <div style={{ width: `${(p.sentiment.positive / total) * 100}%`, background: "var(--md-primary)" }} />
                    <div style={{ width: `${(p.sentiment.neutral / total) * 100}%`, background: "var(--md-outline)" }} />
                    <div style={{ width: `${(p.sentiment.negative / total) * 100}%`, background: "var(--md-error)" }} />
                  </div>
                </div>
                <div className="mt-1 flex gap-2 m3-body-sm">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--md-primary)" }} />{p.sentiment.positive}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--md-outline)" }} />{p.sentiment.neutral}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--md-error)" }} />{p.sentiment.negative}%</span>
                </div>
              </div>

              {/* 톤 */}
              <p className="m3-body-sm">{p.dominantTone}</p>

              {/* 키워드 */}
              <div className="flex flex-wrap gap-1">
                {p.keyTerms.slice(0, 6).map((t, i) => (
                  <span key={i} className="m3-chip text-[11px]">#{t}</span>
                ))}
              </div>

              {/* 인용 */}
              {p.representativeQuotes.slice(0, 2).map((q, i) => (
                <div key={i} className="rounded-m3-sm p-2 m3-body-sm italic" style={{
                  background: q.sentiment === "positive" ? "color-mix(in srgb, var(--md-primary) 10%, var(--md-surface-container))"
                    : q.sentiment === "negative" ? "color-mix(in srgb, var(--md-error) 10%, var(--md-surface-container))"
                    : "var(--md-surface-container-low)",
                  borderLeft: `3px solid ${q.sentiment === "positive" ? "var(--md-primary)" : q.sentiment === "negative" ? "var(--md-error)" : "var(--md-outline)"}`,
                }}>
                  &ldquo;{q.text}&rdquo;
                </div>
              ))}

              {/* 독특한 관점 */}
              <div className="m3-body-sm" style={{ color: "var(--md-on-surface-variant)" }}>
                <b>특징:</b> {p.uniqueAngle}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
