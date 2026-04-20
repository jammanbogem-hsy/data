"use client";

import { useMemo } from "react";

interface NewsItem {
  title: string;
  description: string;
  pubDate: string;
}

// 간단 규칙 기반 감정 분류 (Claude 호출 없이 즉시, 비용 0)
const POS_WORDS = [
  "좋", "최고", "인기", "성공", "흥행", "대박", "호평", "사랑", "추천", "만족",
  "감동", "행복", "기쁨", "축하", "달성", "돌파", "화제", "열풍", "긍정", "선호",
  "맛있", "편리", "혁신", "상승", "증가", "호황", "수상", "매력",
];
const NEG_WORDS = [
  "논란", "비판", "문제", "사고", "피해", "우려", "위기", "하락", "감소", "불만",
  "실패", "취소", "중단", "처벌", "위반", "고소", "고발", "반발", "분노", "불안",
  "비싼", "부담", "불편", "위험", "경고", "적발", "의혹",
];

function classifyTitle(title: string): "positive" | "negative" | "neutral" {
  const t = title.toLowerCase();
  const posHits = POS_WORDS.filter((w) => t.includes(w)).length;
  const negHits = NEG_WORDS.filter((w) => t.includes(w)).length;
  if (posHits > negHits) return "positive";
  if (negHits > posHits) return "negative";
  return "neutral";
}

export function SentimentOverviewCard({
  keyword,
  news,
  mindset,
}: {
  keyword: string;
  news: NewsItem[];
  mindset: string;
}) {
  const analysis = useMemo(() => {
    if (!news || news.length === 0) return null;

    let pos = 0;
    let neg = 0;
    let neu = 0;
    const posWords = new Map<string, number>();
    const negWords = new Map<string, number>();
    let bestPosDate = "";
    let bestNegDate = "";
    let bestPosRatio = 0;
    let worstNegRatio = 0;

    // 일자별 감정 계산
    const byDate = new Map<string, { pos: number; neg: number; neu: number }>();
    for (const n of news) {
      const sent = classifyTitle(n.title);
      if (sent === "positive") pos++;
      else if (sent === "negative") neg++;
      else neu++;

      // 감정 단어 빈도
      const t = n.title.toLowerCase();
      for (const w of POS_WORDS) {
        if (t.includes(w)) posWords.set(w, (posWords.get(w) ?? 0) + 1);
      }
      for (const w of NEG_WORDS) {
        if (t.includes(w)) negWords.set(w, (negWords.get(w) ?? 0) + 1);
      }

      // 날짜별 집계
      const d = n.pubDate?.slice(0, 10) ?? "";
      if (d) {
        const prev = byDate.get(d) ?? { pos: 0, neg: 0, neu: 0 };
        if (sent === "positive") prev.pos++;
        else if (sent === "negative") prev.neg++;
        else prev.neu++;
        byDate.set(d, prev);
      }
    }

    // 긍정/부정 비율 가장 높은 날
    for (const [d, cnt] of byDate.entries()) {
      const total = cnt.pos + cnt.neg + cnt.neu;
      if (total < 2) continue;
      const pRatio = cnt.pos / total;
      const nRatio = cnt.neg / total;
      if (pRatio > bestPosRatio) { bestPosRatio = pRatio; bestPosDate = d; }
      if (nRatio > worstNegRatio) { worstNegRatio = nRatio; bestNegDate = d; }
    }

    const total = pos + neg + neu;
    const topPosWords = Array.from(posWords.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topNegWords = Array.from(negWords.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      pos, neg, neu, total,
      posPercent: total > 0 ? Math.round((pos / total) * 100) : 0,
      negPercent: total > 0 ? Math.round((neg / total) * 100) : 0,
      neuPercent: total > 0 ? Math.round((neu / total) * 100) : 0,
      topPosWords,
      topNegWords,
      bestPosDate,
      bestNegDate,
    };
  }, [news]);

  if (!analysis) return null;

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-xl">😊</span>
        긍·부정 분석
      </h3>

      {/* 요약 카드 3개 (썸트렌드 스타일) */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* 대표 감정 */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl dark:bg-blue-900">
            👍
          </div>
          <div>
            <div className="text-xs text-slate-500">대표 긍·부정</div>
            <div className={`text-lg font-bold ${analysis.posPercent >= 60 ? "text-emerald-600" : analysis.negPercent >= 40 ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
              {analysis.posPercent >= 60 ? `긍정 ${analysis.posPercent}%` :
               analysis.negPercent >= 40 ? `부정 ${analysis.negPercent}%` :
               `중립 ${analysis.neuPercent}%`}
            </div>
            <div className="text-xs text-slate-400">
              긍정 {analysis.pos} · 부정 {analysis.neg} · 중립 {analysis.neu}
            </div>
          </div>
        </div>

        {/* 긍정 최고일 */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900">
            📗
          </div>
          <div>
            <div className="text-xs text-slate-500">긍정 비율 가장 높았던 날</div>
            <div className="text-lg font-bold text-emerald-600">
              {analysis.bestPosDate || "—"}
            </div>
          </div>
        </div>

        {/* 부정 최고일 */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-2xl dark:bg-rose-900">
            📕
          </div>
          <div>
            <div className="text-xs text-slate-500">부정 비율 가장 높았던 날</div>
            <div className="text-lg font-bold text-rose-600">
              {analysis.bestNegDate || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* 감정 바 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          전체 감정 분포 ({analysis.total}건 뉴스·블로그 분석)
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="flex h-full">
            <div style={{ width: `${analysis.posPercent}%` }} className="bg-emerald-400" />
            <div style={{ width: `${analysis.neuPercent}%` }} className="bg-slate-300 dark:bg-slate-600" />
            <div style={{ width: `${analysis.negPercent}%` }} className="bg-rose-400" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> 긍정 {analysis.posPercent}%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> 중립 {analysis.neuPercent}%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> 부정 {analysis.negPercent}%</span>
        </div>
      </div>

      {/* 감정 키워드 태그 (워드클라우드 대안) */}
      <div className="grid gap-3 md:grid-cols-2">
        {analysis.topPosWords.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <h4 className="mb-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">긍정 키워드</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.topPosWords.map(([w, c]) => (
                <span
                  key={w}
                  className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                  style={{ fontSize: `${Math.max(11, Math.min(16, 11 + c * 2))}px` }}
                >
                  {w} <span className="opacity-60">{c}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {analysis.topNegWords.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950">
            <h4 className="mb-2 text-xs font-bold text-rose-700 dark:text-rose-300">부정 키워드</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.topNegWords.map(([w, c]) => (
                <span
                  key={w}
                  className="rounded-full bg-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                  style={{ fontSize: `${Math.max(11, Math.min(16, 11 + c * 2))}px` }}
                >
                  {w} <span className="opacity-60">{c}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI 마음 읽기 */}
      {mindset && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm italic text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          💭 <b>사람들의 마음</b>: {mindset}
        </div>
      )}
    </section>
  );
}
