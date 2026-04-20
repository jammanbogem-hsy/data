"use client";

import type { RelatedKeyword } from "@/lib/providers/claude";

const CATEGORY_ICON: Record<string, string> = {
  인물: "👤",
  제품: "🛒",
  장소: "📍",
  이벤트: "🎉",
  감정: "💭",
  브랜드: "🏷️",
  기타: "·",
};

const CATEGORY_COLOR: Record<string, string> = {
  인물: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  제품: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  장소: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  이벤트: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800",
  감정: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-800",
  브랜드: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800",
  기타: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const STRENGTH_SIZE: Record<string, string> = {
  strong: "text-sm font-bold px-3 py-1.5",
  medium: "text-xs font-semibold px-2.5 py-1",
  weak: "text-[11px] px-2 py-0.5",
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-rose-400",
  neutral: "bg-slate-400",
};

export function RelatedKeywordsCard({
  keyword,
  relatedKeywords,
}: {
  keyword: string;
  relatedKeywords: RelatedKeyword[];
}) {
  if (!relatedKeywords || relatedKeywords.length === 0) return null;

  // 카테고리별 그룹화
  const byCategory = new Map<string, RelatedKeyword[]>();
  for (const rk of relatedKeywords) {
    const cat = rk.category || "기타";
    const arr = byCategory.get(cat) ?? [];
    arr.push(rk);
    byCategory.set(cat, arr);
  }

  // 카테고리 정렬 (개수 큰 순)
  const sortedCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // 요약 3개
  const topCategory = sortedCategories[0]?.[0] ?? "—";
  const strongCount = relatedKeywords.filter((k) => k.strength === "strong").length;
  const posCount = relatedKeywords.filter((k) => k.sentiment === "positive").length;
  const negCount = relatedKeywords.filter((k) => k.sentiment === "negative").length;

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-xl">🔗</span>
        연관어 분석
      </h3>

      {/* 요약 카드 3개 */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-2xl dark:bg-indigo-900">
            {CATEGORY_ICON[topCategory] ?? "📊"}
          </div>
          <div>
            <div className="text-xs text-slate-500">가장 많이 언급된 카테고리</div>
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
              {topCategory}
            </div>
            <div className="text-xs text-slate-400">{sortedCategories[0]?.[1]?.length ?? 0}개 연관어</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-2xl dark:bg-yellow-900">
            ⭐
          </div>
          <div>
            <div className="text-xs text-slate-500">핵심 연관어 (strong)</div>
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
              {strongCount}개
            </div>
            <div className="text-xs text-slate-400">
              {relatedKeywords.filter((k) => k.strength === "strong").slice(0, 3).map((k) => k.keyword).join(", ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900">
            😊
          </div>
          <div>
            <div className="text-xs text-slate-500">감정 분포</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              긍정 {posCount} · 부정 {negCount} · 중립 {relatedKeywords.length - posCount - negCount}
            </div>
          </div>
        </div>
      </div>

      {/* 연관어 네트워크 (카테고리별 태그 클러스터) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            &ldquo;{keyword}&rdquo; 연관어 {relatedKeywords.length}개
          </h4>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 긍정</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> 중립</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> 부정</span>
            <span>| 크기 = 관계 강도</span>
          </div>
        </div>

        {/* 방사형 레이아웃 모방 — 카테고리별 행 */}
        <div className="space-y-3">
          {sortedCategories.map(([cat, keywords]) => (
            <div key={cat} className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0 text-right text-xs font-medium text-slate-500">
                {CATEGORY_ICON[cat]} {cat}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {keywords
                  .sort((a, b) => {
                    const order = { strong: 0, medium: 1, weak: 2 };
                    return (order[a.strength] ?? 1) - (order[b.strength] ?? 1);
                  })
                  .map((rk) => (
                    <span
                      key={rk.keyword}
                      className={`inline-flex items-center gap-1 rounded-full border ${CATEGORY_COLOR[cat] ?? CATEGORY_COLOR["기타"]} ${STRENGTH_SIZE[rk.strength] ?? STRENGTH_SIZE.medium}`}
                      title={rk.context}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${SENTIMENT_DOT[rk.sentiment] ?? SENTIMENT_DOT.neutral}`}
                      />
                      {rk.keyword}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
