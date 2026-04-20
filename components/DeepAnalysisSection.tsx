"use client";

import { useMemo, useState } from "react";
import type { SpikeRange } from "@/lib/spike";
import { RelatedKeywordsGraph, type RelatedGraphData } from "./RelatedKeywordsGraph";
import { CommunityComparisonCard, type CommunityComparisonData } from "./CommunityComparisonCard";
import type { SentimentTimeline } from "./SpikeAnalysisModal";

type TabKey = "voc" | "graph" | "community";

interface Evidence {
  news: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    viewCount: number;
  }>;
  comments: Array<{ videoId: string; text: string; likeCount: number }>;
}

interface Props {
  keyword: string;
  spikes: SpikeRange[];
  evidence: Evidence;
  accentColor?: string;
}

const TABS: Array<{ key: TabKey; label: string; icon: string; desc: string }> = [
  { key: "voc", label: "VoC 인용", icon: "📝", desc: "피크 전·당일·후 실제 목소리" },
  { key: "graph", label: "연관어 네트워크", icon: "🕸️", desc: "함께 언급된 키워드 관계망" },
  { key: "community", label: "커뮤니티 비교", icon: "🌐", desc: "뉴스·블로그·YouTube 톤 차이" },
];

export function DeepAnalysisSection({ keyword, spikes, evidence, accentColor = "#F97316" }: Props) {
  const [selectedSpikeIdx, setSelectedSpikeIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabKey>("voc");

  const [voc, setVoc] = useState<SentimentTimeline | null>(null);
  const [graph, setGraph] = useState<RelatedGraphData | null>(null);
  const [community, setCommunity] = useState<CommunityComparisonData | null>(null);

  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<{ voc?: string; graph?: string; community?: string }>({});
  const [lastRunSpikeIdx, setLastRunSpikeIdx] = useState<number | null>(null);

  const selectedSpike = spikes[selectedSpikeIdx] ?? null;

  const commentsLite = useMemo(
    () => evidence.comments.map((c) => ({ text: c.text, likeCount: c.likeCount })),
    [evidence.comments]
  );

  const hasResults = voc || graph || community;
  const spikeChanged = lastRunSpikeIdx !== null && lastRunSpikeIdx !== selectedSpikeIdx;

  async function runAll() {
    if (!selectedSpike) return;
    setRunning(true);
    setErrors({});
    setVoc(null);
    setGraph(null);
    setCommunity(null);

    const spikePayload = {
      startPeriod: selectedSpike.startPeriod,
      endPeriod: selectedSpike.endPeriod,
      peakPeriod: selectedSpike.peakPeriod,
      peakRatio: selectedSpike.peakRatio,
      multiplier: selectedSpike.multiplier,
    };

    const [vocRes, graphRes, commRes] = await Promise.allSettled([
      fetch("/api/spike-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          spike: spikePayload,
          news: evidence.news,
          videos: evidence.videos,
          comments: commentsLite,
          includeSentiment: true,
        }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `VoC ${r.status}`);
        return j.sentimentTimeline as SentimentTimeline | null;
      }),
      fetch("/api/spike-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          spike: spikePayload,
          news: evidence.news,
          videos: evidence.videos,
          comments: commentsLite,
          includeGraph: true,
        }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Graph ${r.status}`);
        return j.relatedGraph as RelatedGraphData | null;
      }),
      fetch("/api/community-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          news: evidence.news.map((n) => ({ title: n.title, description: n.description })),
          blogs: [],
          comments: commentsLite,
        }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Community ${r.status}`);
        return j.comparison as CommunityComparisonData;
      }),
    ]);

    const errs: typeof errors = {};
    if (vocRes.status === "fulfilled") setVoc(vocRes.value);
    else errs.voc = vocRes.reason?.message ?? "실패";
    if (graphRes.status === "fulfilled") setGraph(graphRes.value);
    else errs.graph = graphRes.reason?.message ?? "실패";
    if (commRes.status === "fulfilled") setCommunity(commRes.value);
    else errs.community = commRes.reason?.message ?? "실패";

    setErrors(errs);
    setLastRunSpikeIdx(selectedSpikeIdx);
    setRunning(false);
  }

  return (
    <section
      className="rounded-xl border-2 p-5"
      style={{ borderColor: `${accentColor}66`, background: `${accentColor}0a` }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
          style={{ background: accentColor }}
        >
          👥 사람들의 반응 심층 분석
        </span>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          VoC · 연관어 · 커뮤니티를 한 번에
        </span>
      </div>

      {/* 급등 구간 선택 + 실행 버튼 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-900/60">
        {spikes.length > 0 ? (
          <>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              분석 기준 급등:
            </label>
            <select
              value={selectedSpikeIdx}
              onChange={(e) => setSelectedSpikeIdx(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
              disabled={running}
            >
              {spikes.map((sp, i) => (
                <option key={i} value={i}>
                  {sp.peakPeriod} · ×{sp.multiplier.toFixed(1)} · 피크 {sp.peakRatio.toFixed(1)}
                </option>
              ))}
            </select>
            <button
              onClick={runAll}
              disabled={running}
              className="ml-auto rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
              style={{ background: accentColor }}
            >
              {running ? "🔎 분석 중…" : hasResults && !spikeChanged ? "🔄 재분석" : "🔍 심층 분석 시작"}
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-500">
            급등 구간이 없어 키워드 전체 기준으로 분석합니다
          </span>
        )}
        {spikeChanged && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            ⚠ 급등 구간 바뀜 — 재분석 필요
          </span>
        )}
      </div>

      {/* 탭 헤더 */}
      <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          const loaded = t.key === "voc" ? voc : t.key === "graph" ? graph : community;
          const err = errors[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-current text-slate-900 dark:text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              style={active ? { color: accentColor, borderColor: accentColor } : undefined}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {loaded && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {err && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />}
            </button>
          );
        })}
        <div className="ml-auto self-center text-[10px] text-slate-400">
          {TABS.find((t) => t.key === activeTab)?.desc}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="min-h-[200px]">
        {running && !hasResults && (
          <div className="animate-pulse py-8 text-center text-sm text-slate-500">
            🔎 Claude가 VoC·연관어·커뮤니티 3종을 병렬 분석 중…
          </div>
        )}

        {!running && !hasResults && !errors.voc && !errors.graph && !errors.community && (
          <div className="py-8 text-center text-sm text-slate-500">
            위 <b>🔍 심층 분석 시작</b> 버튼을 눌러주세요.
          </div>
        )}

        {activeTab === "voc" && (
          <VocTab voc={voc} error={errors.voc} running={running} />
        )}
        {activeTab === "graph" && (
          <GraphTab graph={graph} error={errors.graph} running={running} accentColor={accentColor} />
        )}
        {activeTab === "community" && (
          <CommunityTab community={community} error={errors.community} running={running} />
        )}
      </div>
    </section>
  );
}

function VocTab({
  voc,
  error,
  running,
}: {
  voc: SentimentTimeline | null;
  error: string | undefined;
  running: boolean;
}) {
  if (error) return <ErrorBox msg={error} />;
  if (!voc && running) return <Loading label="VoC 분석 중…" />;
  if (!voc) return null;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{voc.narrative}</p>
      <div className="grid gap-2 md:grid-cols-3">
        {voc.buckets.map((b) => {
          const total = Math.max(b.positive + b.negative + b.neutral, 1);
          return (
            <div
              key={b.label}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{b.label}</span>
                <span className="text-[10px] text-slate-400">{b.itemCount}건</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{b.dateRange}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="flex h-full">
                  <div style={{ width: `${(b.positive / total) * 100}%` }} className="bg-emerald-400" />
                  <div style={{ width: `${(b.neutral / total) * 100}%` }} className="bg-slate-300 dark:bg-slate-600" />
                  <div style={{ width: `${(b.negative / total) * 100}%` }} className="bg-rose-400" />
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                <span>🟢 {b.positive}%</span>
                <span>⚪ {b.neutral}%</span>
                <span>🔴 {b.negative}%</span>
              </div>
              <p className="mt-1.5 text-[11px] italic text-slate-600 dark:text-slate-400">
                {b.dominantNote}
              </p>
              {b.voiceQuotes && b.voiceQuotes.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                  {b.voiceQuotes.slice(0, 3).map((q, qi) => (
                    <div
                      key={qi}
                      className={`rounded-md border-l-2 px-2 py-1 text-[11px] leading-relaxed ${
                        q.sentiment === "positive"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                          : q.sentiment === "negative"
                            ? "border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                            : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                      }`}
                    >
                      <p>&ldquo;{q.text}&rdquo;</p>
                      <div className="mt-0.5 flex items-center justify-between text-[9px] opacity-70">
                        <span>
                          {q.source === "news" ? "📰 뉴스" : q.source === "blog" ? "✍️ 블로그" : "💬 댓글"}
                        </span>
                        <span className="font-mono">{q.sourceLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphTab({
  graph,
  error,
  running,
  accentColor,
}: {
  graph: RelatedGraphData | null;
  error: string | undefined;
  running: boolean;
  accentColor: string;
}) {
  if (error) return <ErrorBox msg={error} />;
  if (!graph && running) return <Loading label="연관어 네트워크 추출 중…" />;
  if (!graph) return null;
  return <RelatedKeywordsGraph data={graph} accentColor={accentColor} />;
}

function CommunityTab({
  community,
  error,
  running,
}: {
  community: CommunityComparisonData | null;
  error: string | undefined;
  running: boolean;
}) {
  if (error) return <ErrorBox msg={error} />;
  if (!community && running) return <Loading label="플랫폼 비교 중…" />;
  if (!community) return null;
  return <CommunityComparisonCard data={community} />;
}

function Loading({ label }: { label: string }) {
  return <div className="animate-pulse py-6 text-center text-sm text-slate-500">🔎 {label}</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
      분석 실패: {msg}
    </div>
  );
}
