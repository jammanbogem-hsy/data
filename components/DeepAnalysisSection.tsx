"use client";

import { useMemo, useState } from "react";
import type { SpikeRange } from "@/lib/spike";
import { RelatedKeywordsGraph, type RelatedGraphData } from "./RelatedKeywordsGraph";
import { CommunityComparisonCard, type CommunityComparisonData } from "./CommunityComparisonCard";
import type { SentimentTimeline } from "./SpikeAnalysisModal";

type TabKey = "voc" | "graph" | "community";

interface Evidence {
  news: Array<{ title: string; description: string; link: string; pubDate: string }>;
  videos: Array<{ videoId: string; title: string; description: string; channelTitle: string; viewCount: number }>;
  comments: Array<{ videoId: string; text: string; likeCount: number }>;
}

interface Props {
  keyword: string;
  spikes: SpikeRange[];
  evidence: Evidence;
  accentColor?: string;
}

const TABS: Array<{ key: TabKey; label: string; icon: string; desc: string }> = [
  { key: "voc", label: "사람들의 목소리", icon: "record_voice_over", desc: "피크 전후 실제 반응" },
  { key: "graph", label: "연관어 관계", icon: "hub", desc: "함께 언급된 키워드" },
  { key: "community", label: "채널 비교", icon: "compare", desc: "뉴스·블로그·YouTube 톤 차이" },
];

export function DeepAnalysisSection({ keyword, spikes, evidence }: Props) {
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

    const [vocRes, graphRes, commRes] = await Promise.allSettled([
      fetch("/api/spike-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          spike: { startPeriod: selectedSpike.startPeriod, endPeriod: selectedSpike.endPeriod, peakPeriod: selectedSpike.peakPeriod, peakRatio: selectedSpike.peakRatio, multiplier: selectedSpike.multiplier },
          news: evidence.news, videos: evidence.videos, comments: commentsLite,
          includeSentiment: true,
        }),
      }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.sentimentTimeline as SentimentTimeline | null; }),
      fetch("/api/spike-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          spike: { startPeriod: selectedSpike.startPeriod, endPeriod: selectedSpike.endPeriod, peakPeriod: selectedSpike.peakPeriod, peakRatio: selectedSpike.peakRatio, multiplier: selectedSpike.multiplier },
          news: evidence.news, videos: evidence.videos, comments: commentsLite,
          includeGraph: true,
        }),
      }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.relatedGraph as RelatedGraphData | null; }),
      fetch("/api/community-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, news: evidence.news.map((n) => ({ title: n.title, description: n.description })), blogs: [], comments: commentsLite }),
      }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.comparison as CommunityComparisonData; }),
    ]);

    const errs: typeof errors = {};
    if (vocRes.status === "fulfilled") setVoc(vocRes.value); else errs.voc = vocRes.reason?.message ?? "실패";
    if (graphRes.status === "fulfilled") setGraph(graphRes.value); else errs.graph = graphRes.reason?.message ?? "실패";
    if (commRes.status === "fulfilled") setCommunity(commRes.value); else errs.community = commRes.reason?.message ?? "실패";
    setErrors(errs);
    setLastRunSpikeIdx(selectedSpikeIdx);
    setRunning(false);
  }

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon" style={{ color: "var(--md-primary)" }}>groups</span>
        사람들의 반응 분석
      </h3>
      <p className="m3-body-sm -mt-2">
        급등 시점에 사람들이 어떤 말을 했는지, 어떤 키워드가 함께 올랐는지 분석합니다.
      </p>

      {/* 급등 선택 + 실행 */}
      <div className="m3-card flex flex-wrap items-center gap-3">
        {spikes.length > 0 ? (
          <>
            <label className="m3-body-sm font-medium">분석할 급등 구간</label>
            <select
              value={selectedSpikeIdx}
              onChange={(e) => setSelectedSpikeIdx(Number(e.target.value))}
              disabled={running}
              className="h-9 rounded-m3-sm border px-2 text-sm"
              style={{ borderColor: "var(--md-outline)", background: "var(--md-surface-container)", color: "var(--md-on-surface)" }}
            >
              {spikes.map((sp, i) => (
                <option key={i} value={i}>
                  {sp.peakPeriod} · x{sp.multiplier.toFixed(1)} · 피크 {sp.peakRatio.toFixed(1)}
                </option>
              ))}
            </select>
            <button onClick={runAll} disabled={running} className="m3-btn-filled ml-auto flex items-center gap-1.5">
              <span className="m3-icon-sm">{running ? "hourglass_top" : "search"}</span>
              {running ? "분석 중..." : hasResults && !spikeChanged ? "다시 분석" : "분석 시작"}
            </button>
          </>
        ) : (
          <span className="m3-body-sm">급등 구간이 없어 전체 기간으로 분석합니다</span>
        )}
        {spikeChanged && (
          <span className="m3-chip text-[11px]" style={{ background: "#FFF8E1", color: "#F57F17" }}>
            구간이 바뀌었습니다. 다시 분석해주세요
          </span>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          const loaded = t.key === "voc" ? voc : t.key === "graph" ? graph : community;
          const err = errors[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition"
              style={{
                borderColor: active ? "var(--md-primary)" : "transparent",
                color: active ? "var(--md-primary)" : "var(--md-on-surface-variant)",
              }}
            >
              <span className="m3-icon-sm">{t.icon}</span>
              {t.label}
              {loaded && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--md-primary)" }} />}
              {err && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--md-error)" }} />}
            </button>
          );
        })}
        <span className="ml-auto self-center m3-body-sm">
          {TABS.find((t) => t.key === activeTab)?.desc}
        </span>
      </div>

      {/* 탭 내용 */}
      <div className="min-h-[200px]">
        {running && !hasResults && (
          <div className="animate-pulse py-8 text-center m3-body-md" style={{ color: "var(--md-primary)" }}>
            <span className="m3-icon">hourglass_top</span> 분석 중입니다...
          </div>
        )}
        {!running && !hasResults && !errors.voc && !errors.graph && !errors.community && (
          <div className="py-8 text-center m3-body-md">
            위 <b>분석 시작</b> 버튼을 눌러주세요.
          </div>
        )}
        {activeTab === "voc" && <VocTab voc={voc} error={errors.voc} running={running} />}
        {activeTab === "graph" && <GraphTab graph={graph} error={errors.graph} running={running} />}
        {activeTab === "community" && <CommunityTab community={community} error={errors.community} running={running} />}
      </div>
    </section>
  );
}

function VocTab({ voc, error, running }: { voc: SentimentTimeline | null; error: string | undefined; running: boolean }) {
  if (error) return <ErrorBox msg={error} />;
  if (!voc && running) return <Loading label="목소리 분석 중..." />;
  if (!voc) return null;
  return (
    <div>
      <p className="mb-3 m3-body-md">{voc.narrative}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {voc.buckets.map((b) => {
          const total = Math.max(b.positive + b.negative + b.neutral, 1);
          return (
            <div key={b.label} className="m3-card-outlined">
              <div className="flex justify-between m3-label-sm">
                <span>{b.label}</span>
                <span>{b.itemCount}건</span>
              </div>
              <div className="m3-body-sm mt-0.5">{b.dateRange}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
                <div className="flex h-full">
                  <div style={{ width: `${(b.positive / total) * 100}%`, background: "var(--md-primary)" }} />
                  <div style={{ width: `${(b.neutral / total) * 100}%`, background: "var(--md-outline)" }} />
                  <div style={{ width: `${(b.negative / total) * 100}%`, background: "var(--md-error)" }} />
                </div>
              </div>
              <p className="mt-1.5 m3-body-sm italic">{b.dominantNote}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphTab({ graph, error, running }: { graph: RelatedGraphData | null; error: string | undefined; running: boolean }) {
  if (error) return <ErrorBox msg={error} />;
  if (!graph && running) return <Loading label="연관어 분석 중..." />;
  if (!graph) return null;
  return <RelatedKeywordsGraph data={graph} />;
}

function CommunityTab({ community, error, running }: { community: CommunityComparisonData | null; error: string | undefined; running: boolean }) {
  if (error) return <ErrorBox msg={error} />;
  if (!community && running) return <Loading label="채널 비교 중..." />;
  if (!community) return null;
  return <CommunityComparisonCard data={community} />;
}

function Loading({ label }: { label: string }) {
  return (
    <div className="animate-pulse py-6 text-center m3-body-md" style={{ color: "var(--md-primary)" }}>
      <span className="m3-icon-sm mr-1">hourglass_top</span> {label}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-m3-md border p-3 m3-body-sm" style={{ borderColor: "var(--md-error)", color: "var(--md-error)" }}>
      <span className="m3-icon-sm mr-1">error</span> {msg}
    </div>
  );
}
