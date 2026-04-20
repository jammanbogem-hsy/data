"use client";

import { useEffect, useState } from "react";
import type { SpikeRange } from "@/lib/spike";

interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}
interface SpikeInsight {
  hypotheses: Hypothesis[];
  summary: string;
  topKeywords: string[];
  topComments: Array<{ text: string; likeCount: number; reason: string }>;
}

interface Refetched {
  peakDay: string;
  weekday: string;
  seasonal: string[];
  queries: string[];
  newsWindowCount: number;
  newsContextCount: number;
  blogsWindowCount: number;
  newsTotal: number;
  blogsTotal: number;
  videosCount: number;
  commentsCount: number;
  ratio: { naver: number; youtube: number };
}

interface PeakEvidence {
  peakVideos: Array<{ videoId: string; title: string; channelTitle: string; viewCount: number; publishedAt: string }>;
  peakBlogs: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakNews: Array<{ title: string; link: string; description: string; pubDate: string }>;
  peakComments: Array<{ text: string; likeCount: number }>;
}

interface Props {
  keyword: string;
  spike: SpikeRange;
  news: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{ title: string; description: string; channelTitle: string; viewCount: number }>;
  comments: Array<{ text: string; likeCount: number }>;
}

const CONFIDENCE_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: "확신↑", color: "bg-emerald-100 text-emerald-700" },
  medium: { text: "보통", color: "bg-blue-100 text-blue-700" },
  low: { text: "추측", color: "bg-slate-100 text-slate-600" },
};

export function SpikeAnalysisCard({ keyword, spike, news, videos, comments }: Props) {
  const [data, setData] = useState<SpikeInsight | null>(null);
  const [refetched, setRefetched] = useState<Refetched | null>(null);
  const [peakEvidence, setPeakEvidence] = useState<PeakEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // spike 변경 시 새 분석 요청
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setRefetched(null);
    setPeakEvidence(null);
    setError(null);
    fetch("/api/spike-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        spike: {
          startPeriod: spike.startPeriod,
          endPeriod: spike.endPeriod,
          peakPeriod: spike.peakPeriod,
          peakRatio: spike.peakRatio,
          multiplier: spike.multiplier,
        },
        news,
        videos,
        comments,
      }),
    })
      .then(async (r) => {
        if (cancelled) return;
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `오류 ${r.status}`);
        setData(j.insight);
        if (j.refetched) setRefetched(j.refetched);
        if (j.evidence) setPeakEvidence(j.evidence);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [keyword, spike.startPeriod, spike.endPeriod, news, videos, comments]);

  return (
    <section className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-5 dark:border-orange-800 dark:from-orange-950 dark:to-amber-950">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
          🔥 급등 구간 분석
        </span>
        <span className="font-mono text-xs text-orange-800 dark:text-orange-300">
          {spike.startPeriod} ~ {spike.endPeriod}
        </span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900 dark:text-orange-200">
          평소 ×{spike.multiplier.toFixed(1)} · 피크 {spike.peakRatio.toFixed(1)}
        </span>
      </div>

      {loading && (
        <div className="animate-pulse space-y-1 py-6 text-sm text-orange-600">
          <div>🔎 피크 기간(±2주) YouTube 영상 재검색 + 네이버 블로그/뉴스 기간 쿼리…</div>
          <div className="text-xs">Claude가 피크 시점 댓글·영상·기사로 가설을 좁히고 있습니다.</div>
        </div>
      )}

      {refetched && !loading && (
        <div className="mb-3 space-y-1.5 rounded-md bg-white/70 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <div>
            🔄 <b>{refetched.peakDay}</b> ({refetched.weekday}요일){" "}
            {refetched.seasonal.length > 0 && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                🏮 시즌: {refetched.seasonal.join(", ")}
              </span>
            )}
          </div>
          <div>
            📊 수집{" "}
            <b className="text-green-700 dark:text-green-400">네이버 {refetched.ratio.naver}건</b>
            {" ("}뉴스 {refetched.newsWindowCount}+{refetched.newsContextCount}, 블로그 {refetched.blogsWindowCount}{") "}
            · <b className="text-red-700 dark:text-red-400">YouTube {refetched.ratio.youtube}건</b>
            {" ("}영상 {refetched.videosCount}, 댓글 {refetched.commentsCount}{")"}
          </div>
          {refetched.queries.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-slate-500">쿼리 {refetched.queries.length}개:</span>
              {refetched.queries.map((q, i) => (
                <span
                  key={i}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >
                  {q}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          분석 실패: {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* 종합 요약 */}
          <div className="rounded-lg bg-white/60 p-3 text-sm leading-relaxed text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
            <span className="mr-1 font-semibold text-orange-700 dark:text-orange-300">왜 떴나?</span>
            {data.summary}
          </div>

          {/* 핵심 키워드 */}
          {data.topKeywords?.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                급등 구간 키워드
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.topKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-orange-200 px-2.5 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-900 dark:text-orange-200"
                  >
                    #{k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 가설 카드 */}
          {data.hypotheses?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                급등 가설
              </h4>
              <div className="grid gap-2 md:grid-cols-3">
                {data.hypotheses.map((h, i) => (
                  <article
                    key={i}
                    className="flex flex-col rounded-lg border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-orange-500">#{i + 1}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_LABEL[h.confidence]?.color ?? ""}`}>
                        {CONFIDENCE_LABEL[h.confidence]?.text ?? h.confidence}
                      </span>
                    </div>
                    <h5 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {h.title}
                    </h5>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {h.reasoning}
                    </p>
                    {h.evidence?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.evidence.slice(0, 4).map((ev, j) => (
                          <span
                            key={j}
                            className="rounded bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          >
                            {ev.slice(0, 50)}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* 피크 기간에 실제로 업로드된 YouTube 영상 */}
          {peakEvidence && peakEvidence.peakVideos?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                피크 기간 YouTube 영상 (publishedAfter/Before 필터)
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {peakEvidence.peakVideos.slice(0, 6).map((v, i) => (
                  <a
                    key={v.videoId}
                    href={`https://youtu.be/${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 rounded-lg border border-orange-200 bg-white p-2 transition hover:border-red-400 dark:border-orange-800 dark:bg-slate-900"
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                      alt=""
                      className="h-14 w-24 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 text-[10px] text-slate-400">
                        <span className="font-mono">PV{i + 1}</span>
                        <span>{v.publishedAt?.slice(0, 10)}</span>
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {v.title}
                      </p>
                      <div className="text-[10px] text-slate-500">
                        {v.channelTitle} · 👀 {v.viewCount.toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 피크 기간 블로그/뉴스 (쿼리 힌트 기반) */}
          {peakEvidence && (peakEvidence.peakBlogs?.length > 0 || peakEvidence.peakNews?.length > 0) && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                피크 기간 블로그·뉴스 (&ldquo;{keyword}&rdquo; 쿼리)
              </h4>
              <div className="space-y-1.5">
                {[...(peakEvidence.peakNews ?? []), ...(peakEvidence.peakBlogs ?? [])]
                  .slice(0, 8)
                  .map((n, i) => (
                    <a
                      key={n.link + i}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded border border-orange-100 bg-white px-3 py-2 transition hover:border-green-400 dark:border-orange-900 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2 text-[10px]">
                        <span className="font-mono text-slate-400">PN{i + 1}</span>
                        <span className="text-slate-400">{n.pubDate?.slice(0, 10)}</span>
                      </div>
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </h5>
                      <p className="line-clamp-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {n.description}
                      </p>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* 시사적 댓글 */}
          {data.topComments?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                시사적 댓글
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {data.topComments.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-slate-900"
                  >
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      &ldquo;{c.text}&rdquo;
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] italic text-orange-700 dark:text-orange-300">
                        💡 {c.reason}
                      </span>
                      <span className="text-[10px] text-slate-400">👍 {c.likeCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
