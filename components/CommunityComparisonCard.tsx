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

const PLATFORM_META: Record<
  string,
  { icon: string; color: string; bg: string; darkBg: string; border: string; darkBorder: string }
> = {
  naver_news: {
    icon: "📰",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50",
    darkBg: "dark:bg-sky-950/60",
    border: "border-sky-200",
    darkBorder: "dark:border-sky-800",
  },
  naver_blog: {
    icon: "✍️",
    color: "text-lime-700 dark:text-lime-300",
    bg: "bg-lime-50",
    darkBg: "dark:bg-lime-950/60",
    border: "border-lime-200",
    darkBorder: "dark:border-lime-800",
  },
  youtube_comments: {
    icon: "💬",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50",
    darkBg: "dark:bg-rose-950/60",
    border: "border-rose-200",
    darkBorder: "dark:border-rose-800",
  },
};

const DIVERGENCE_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: "큰 온도차", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  medium: { text: "보통 차이", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  low: { text: "비슷", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

function SentimentBar({
  s,
}: {
  s: { positive: number; negative: number; neutral: number };
}) {
  const total = Math.max(s.positive + s.negative + s.neutral, 1);
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="flex h-full">
          <div
            style={{ width: `${(s.positive / total) * 100}%` }}
            className="bg-emerald-400"
            title={`긍정 ${s.positive}%`}
          />
          <div
            style={{ width: `${(s.neutral / total) * 100}%` }}
            className="bg-slate-300 dark:bg-slate-600"
            title={`중립 ${s.neutral}%`}
          />
          <div
            style={{ width: `${(s.negative / total) * 100}%` }}
            className="bg-rose-400"
            title={`부정 ${s.negative}%`}
          />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> {s.positive}%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" /> {s.neutral}%
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" /> {s.negative}%
        </span>
      </div>
    </div>
  );
}

export function CommunityComparisonCard({ data }: { data: CommunityComparisonData }) {
  const divMeta = DIVERGENCE_LABEL[data.divergence] ?? DIVERGENCE_LABEL.medium;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${divMeta.color}`}>
          {divMeta.text}
        </span>
        <p className="flex-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {data.comparison}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {data.platforms.map((p) => {
          const meta = PLATFORM_META[p.platform] ?? PLATFORM_META.naver_news;
          return (
            <div
              key={p.platform}
              className={`flex flex-col gap-2 rounded-lg border ${meta.border} ${meta.darkBorder} ${meta.bg} ${meta.darkBg} p-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{meta.icon}</span>
                  <span className={`text-sm font-bold ${meta.color}`}>{p.platformLabel}</span>
                </div>
                <span className="text-[10px] text-slate-500">n={p.sampleSize}</span>
              </div>

              <SentimentBar s={p.sentiment} />

              <div className="text-[11px] italic text-slate-700 dark:text-slate-300">
                {p.dominantTone}
              </div>

              {p.keyTerms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.keyTerms.slice(0, 6).map((t, i) => (
                    <span
                      key={i}
                      className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {p.representativeQuotes.length > 0 && (
                <div className="space-y-1 border-t border-white/60 pt-1.5 dark:border-slate-700/60">
                  {p.representativeQuotes.slice(0, 2).map((q, i) => (
                    <div
                      key={i}
                      className={`rounded border-l-2 px-1.5 py-1 text-[10px] leading-snug ${
                        q.sentiment === "positive"
                          ? "border-emerald-400 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : q.sentiment === "negative"
                            ? "border-rose-400 bg-rose-50/70 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                            : "border-slate-300 bg-slate-50/70 text-slate-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300"
                      }`}
                    >
                      &ldquo;{q.text}&rdquo;
                    </div>
                  ))}
                </div>
              )}

              {p.uniqueAngle && (
                <div className="mt-auto rounded bg-white/50 px-2 py-1 text-[10px] text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                  <b>독특:</b> {p.uniqueAngle}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
