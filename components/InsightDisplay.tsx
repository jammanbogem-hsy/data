"use client";

import { useEffect, useMemo, useState } from "react";
import {
  detectSpikes,
  detectNaturalPeak,
  detectCommonSpikes,
  detectLeadingIndicators,
  type SpikeRange,
  type CommonSpikeCluster,
  type LeadingIndicator,
} from "@/lib/spike";
import { HypothesisCard } from "./HypothesisCard";
import { EventStudyCard } from "./EventStudyCard";
import { SummaryCards } from "./SummaryCards";
import { YouTubeStatsCard } from "./YouTubeStatsCard";
import { SentimentOverviewCard } from "./SentimentOverviewCard";
import { RelatedKeywordsCard } from "./RelatedKeywordsCard";
import { runEventStudy, type EventImpact } from "@/lib/event-study";
import { detectTrendCycles, type CycleAnalysis } from "@/lib/trend-cycle";
import { TrendCycleCard } from "./TrendCycleCard";
import { correctTimeSeries, computeSummaryMetrics } from "@/lib/correction";
import { SpikeAnalysisModal, type SpikeInsight, type Refetched, type PeakEvidence, type SentimentTimeline } from "./SpikeAnalysisModal";
import { ComparisonCard, type ComparisonInsight } from "./ComparisonCard";
import { DeepAnalysisSection } from "./DeepAnalysisSection";
import {
  savePastInvestigation,
  loadPastInvestigations,
  findSimilarPastSpikes,
  type SimilarityMatch,
} from "@/lib/past-investigations";
import { detectSeasonal } from "@/lib/korean-seasonal";
import { TrendSection } from "./TrendSection";
import { InsightSummarySection } from "./InsightSummarySection";

interface Hypothesis {
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

interface Props {
  data: {
    keyword: string;
    keywords?: string[];
    fetchedAt: string;
    range?: { startDate: string; endDate: string; timeUnit: "date" | "week" | "month" };
    insight: {
      hypotheses: Hypothesis[];
      summary: string;
      mindset: string;
    };
    compareInsight?: ComparisonInsight | null;
    verificationTrace?: {
      plans: Array<{ hypothesisTitle: string; verifyQueries: string[] }>;
      batches: Array<{ hypothesisTitle: string; query: string; newsCount: number }>;
      refined?: boolean;
    } | null;
    evidence: {
      news: Array<{ title: string; description: string; link: string; pubDate: string }>;
      videos: Array<{
        videoId: string;
        title: string;
        description: string;
        channelTitle: string;
        viewCount: number;
        likeCount: number;
      }>;
      comments: Array<{ videoId: string; text: string; likeCount: number }>;
      trend: Array<{ period: string; ratio: number }>;
      multiTrend?: Array<{ keyword: string; series: Array<{ period: string; ratio: number }> }>;
      wikipediaTrend?: Array<{ keyword: string; series: Array<{ period: string; ratio: number; views: number }> }>;
    };
  };
}

const COMPARE_PALETTE = ["#F59E0B", "#EC4899", "#8B5CF6", "#0EA5E9"]; // 주 키워드=초록, 비교=이 팔레트

const CONFIDENCE_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: "확신↑", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  medium: { text: "보통", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  low: { text: "추측", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

type SpikeStatus = "pending" | "loading" | "done" | "error";
interface SpikeResult {
  status: SpikeStatus;
  data?: SpikeInsight;
  refetched?: Refetched;
  peakEvidence?: PeakEvidence;
  sentimentTimeline?: SentimentTimeline | null;
  error?: string;
}

export function InsightDisplay({ data }: Props) {
  const { keyword, insight, evidence } = data;
  const [selectedSpikeIdx, setSelectedSpikeIdx] = useState<number>(0);
  const [selectedTabKey, setSelectedTabKey] = useState<string | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [spikeResults, setSpikeResults] = useState<Record<string, SpikeResult>>({});
  const [rawChart, setRawChart] = useState<boolean>(true);
  const [showCorrected, setShowCorrected] = useState<boolean>(false);

  // 보정 지수 시계열 + 요약 지표
  const correctedSeries = useMemo(
    () => correctTimeSeries(evidence.trend),
    [evidence.trend]
  );
  const summaryMetrics = useMemo(
    () =>
      computeSummaryMetrics(
        correctedSeries,
        evidence.news?.length ?? 0,
        evidence.videos?.length ?? 0,
        0 // blog count (뉴스에 합쳐져 있으므로 별도 없음)
      ),
    [correctedSeries, evidence.news, evidence.videos]
  );

  // 급등 구간 자동 탐지 (이동평균 돌파)
  const detectedSpikes = useMemo(
    () => detectSpikes(evidence.trend, { multiplierThreshold: 1.5, minAbs: 20 }).slice(0, 3),
    [evidence.trend]
  );

  // 폴백: 스파이크 없으면 계절성 자연 피크 (냉면 7월 같은 벨커브)
  const naturalPeak = useMemo(
    () => (detectedSpikes.length === 0 ? detectNaturalPeak(evidence.trend) : null),
    [detectedSpikes, evidence.trend]
  );

  const spikes: SpikeRange[] = useMemo(
    () => (detectedSpikes.length > 0 ? detectedSpikes : naturalPeak ? [naturalPeak] : []),
    [detectedSpikes, naturalPeak]
  );
  const isNaturalPeakOnly = detectedSpikes.length === 0 && naturalPeak !== null;
  const selectedSpike = spikes[selectedSpikeIdx] ?? null;

  // 비교 시리즈 색상 맵 (차트와 범례 공통)
  const colorMap = useMemo(() => {
    const m: Record<string, string> = { [keyword]: "#22C55E" };
    (evidence.multiTrend ?? [])
      .filter((t) => t.keyword !== keyword)
      .forEach((t, i) => {
        m[t.keyword] = COMPARE_PALETTE[i % COMPARE_PALETTE.length];
      });
    return m;
  }, [evidence.multiTrend, keyword]);

  // 각 키워드별 spike 탐지 (비교 모드에서만 의미 있음)
  const perKeywordSpikes = useMemo(() => {
    const trends = evidence.multiTrend ?? [];
    return trends
      .filter((t) => t.keyword !== keyword)
      .map((t) => ({
        keyword: t.keyword,
        color: colorMap[t.keyword] ?? "#94a3b8",
        spikes: detectSpikes(t.series, { multiplierThreshold: 1.5, minAbs: 20 }).slice(0, 3),
      }));
  }, [evidence.multiTrend, colorMap, keyword]);

  // 모든 spike를 하나의 탭 배열로 병합 (주+비교 통합 선택)
  const allSpikeTabs = useMemo(() => {
    const tabs: Array<{
      key: string;
      keyword: string;
      color: string;
      spike: SpikeRange;
      isPrimary: boolean;
    }> = [];
    detectedSpikes.forEach((sp, i) => {
      tabs.push({
        key: `${keyword}#${i}`,
        keyword,
        color: "#22C55E",
        spike: sp,
        isPrimary: true,
      });
    });
    perKeywordSpikes.forEach((p) => {
      p.spikes.forEach((sp, i) => {
        tabs.push({
          key: `${p.keyword}#${i}`,
          keyword: p.keyword,
          color: p.color,
          spike: sp,
          isPrimary: false,
        });
      });
    });
    // 강한 순 정렬
    tabs.sort(
      (a, b) => b.spike.peakRatio * b.spike.multiplier - a.spike.peakRatio * a.spike.multiplier
    );
    return tabs;
  }, [keyword, detectedSpikes, perKeywordSpikes]);

  // 기본 선택: 가장 강한 탭
  useEffect(() => {
    if (allSpikeTabs.length === 0) {
      setSelectedTabKey(null);
      return;
    }
    if (!selectedTabKey || !allSpikeTabs.find((t) => t.key === selectedTabKey)) {
      setSelectedTabKey(allSpikeTabs[0].key);
    }
  }, [allSpikeTabs, selectedTabKey]);

  const activeTab = useMemo(
    () => allSpikeTabs.find((t) => t.key === selectedTabKey) ?? null,
    [allSpikeTabs, selectedTabKey]
  );

  // 새 조사(data.fetchedAt 변경) 시 이전 결과 초기화
  useEffect(() => {
    setSpikeResults({});
    setModalKey(null);
  }, [data.fetchedAt]);

  // 이번 조사를 sessionStorage에 저장 (유사 사건 매칭용)
  useEffect(() => {
    const topForSave = detectedSpikes.slice(0, 3).map((sp) => ({
      peakPeriod: sp.peakPeriod,
      peakRatio: sp.peakRatio,
      multiplier: sp.multiplier,
      month: Number(sp.peakPeriod.slice(5, 7)),
      seasonal: detectSeasonal(sp.peakPeriod),
    }));
    if (topForSave.length > 0) {
      savePastInvestigation({
        keyword,
        fetchedAt: data.fetchedAt,
        topSpikes: topForSave,
      });
    }
  }, [keyword, data.fetchedAt, detectedSpikes]);

  // 이벤트 스터디: 한국 시즌/공휴일이 검색량에 얼마나 영향을 줬나
  // 유행 사이클 감지
  const cycleAnalysis = useMemo<CycleAnalysis>(() => {
    if (evidence.trend.length < 14) return { cycles: [], isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "" };
    return detectTrendCycles(evidence.trend);
  }, [evidence.trend]);

  const eventImpacts = useMemo<EventImpact[]>(() => {
    if (evidence.trend.length < 20) return [];
    return runEventStudy(evidence.trend, undefined, 8);
  }, [evidence.trend]);

  // 과거 조사와의 유사도 매칭
  const similarPast = useMemo<SimilarityMatch[]>(() => {
    if (detectedSpikes.length === 0) return [];
    const past = loadPastInvestigations();
    return findSimilarPastSpikes(keyword, detectedSpikes, past);
  }, [keyword, detectedSpikes, data.fetchedAt]);

  // 모든 급등 구간을 병렬(동시 3개)로 일괄 분석 → 결과 캐시
  useEffect(() => {
    if (allSpikeTabs.length === 0) return;
    let cancelled = false;

    const tabsToRun = allSpikeTabs.slice(0, 6); // 상위 6개만 자동 (나머지는 클릭 시 lazy)
    let idx = 0;

    async function worker() {
      while (idx < tabsToRun.length) {
        const i = idx++;
        const t = tabsToRun[i];
        if (!t || cancelled) return;
        // 이미 진행/완료면 skip
        const existing = spikeResults[t.key];
        if (existing && (existing.status === "loading" || existing.status === "done")) continue;

        setSpikeResults((r) => ({ ...r, [t.key]: { status: "loading" } }));
        try {
          const res = await fetch("/api/spike-insight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keyword: t.keyword,
              spike: {
                startPeriod: t.spike.startPeriod,
                endPeriod: t.spike.endPeriod,
                peakPeriod: t.spike.peakPeriod,
                peakRatio: t.spike.peakRatio,
                multiplier: t.spike.multiplier,
              },
              news: t.isPrimary ? evidence.news : [],
              videos: t.isPrimary ? evidence.videos : [],
              comments: t.isPrimary ? evidence.comments : [],
              includeSentiment: false, // lazy: 모달에서 버튼 클릭 시만
            }),
          });
          const j = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setSpikeResults((r) => ({
              ...r,
              [t.key]: { status: "error", error: j.error || `오류 ${res.status}` },
            }));
          } else {
            setSpikeResults((r) => ({
              ...r,
              [t.key]: {
                status: "done",
                data: j.insight,
                refetched: j.refetched,
                peakEvidence: j.evidence,
                sentimentTimeline: j.sentimentTimeline ?? null,
              },
            }));
          }
        } catch (e) {
          if (!cancelled) {
            setSpikeResults((r) => ({
              ...r,
              [t.key]: { status: "error", error: (e as Error).message },
            }));
          }
        }
      }
    }

    const concurrency = 3;
    const workers = Array.from({ length: concurrency }, () => worker());
    Promise.all(workers);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSpikeTabs, data.fetchedAt]);

  // 선행 지표: 주 키워드 급등 전에 비교 키워드가 먼저 올랐는지
  const leadingIndicators = useMemo<LeadingIndicator[]>(() => {
    if (perKeywordSpikes.length === 0 || detectedSpikes.length === 0) return [];
    return detectLeadingIndicators(
      detectedSpikes,
      perKeywordSpikes.map((p) => ({ keyword: p.keyword, spikes: p.spikes })),
      { maxDaysBefore: 21, minDaysBefore: 1 }
    ).slice(0, 6);
  }, [detectedSpikes, perKeywordSpikes]);

  // 공통 급등 구간 (주 키워드 + 비교 키워드 모두 포함)
  const commonSpikes = useMemo<CommonSpikeCluster[]>(() => {
    const all: Array<{ keyword: string; spikes: SpikeRange[] }> = [
      { keyword, spikes: detectedSpikes },
      ...perKeywordSpikes.map((p) => ({ keyword: p.keyword, spikes: p.spikes })),
    ];
    return detectCommonSpikes(all, { maxDayGap: 5 }).slice(0, 5);
  }, [keyword, detectedSpikes, perKeywordSpikes]);

  const trendStats = useMemo(() => {
    if (evidence.trend.length < 8) return null;
    const recent7 = evidence.trend.slice(-7);
    const prior30 =
      evidence.trend.length >= 37
        ? evidence.trend.slice(-37, -7)
        : evidence.trend.slice(0, -7);
    const avgR = recent7.reduce((s, p) => s + p.ratio, 0) / recent7.length;
    const avgP = prior30.reduce((s, p) => s + p.ratio, 0) / Math.max(prior30.length, 1);
    return {
      recentAvg: avgR,
      priorAvg: avgP,
      ratio: avgP > 0 ? avgR / avgP : 1,
    };
  }, [evidence.trend]);

  return (
    <div className="space-y-8">
      {/* ─── 섹션 1: 핵심 지표 카드 3개 (썸트렌드 스타일) ─── */}
      <SummaryCards metrics={summaryMetrics} keyword={keyword} />

      {/* ─── 섹션 2: AI 인사이트 요약 ─── */}
      <InsightSummarySection
        keyword={keyword}
        summary={insight.summary}
        mindset={insight.mindset}
        newsCount={evidence.news.length}
        videosCount={evidence.videos.length}
        commentsCount={evidence.comments.length}
        trendLength={evidence.trend.length}
        trendStats={trendStats}
      />

      {/* 검색 트렌드 꺾은선 그래프 + 급등 구간 하이라이트 */}
      <TrendSection
        trend={evidence.trend}
        multiTrend={evidence.multiTrend}
        wikipediaTrend={evidence.wikipediaTrend}
        spikes={spikes}
        allSpikeTabs={allSpikeTabs}
        selectedSpikeIdx={selectedSpikeIdx}
        selectedTabKey={selectedTabKey}
        colorMap={colorMap}
        perKeywordSpikes={perKeywordSpikes}
        correctedSeries={correctedSeries}
        keyword={keyword}
        range={data.range}
        isNaturalPeakOnly={isNaturalPeakOnly}
        naturalPeak={naturalPeak}
        detectedSpikes={detectedSpikes}
        spikeResultStatuses={spikeResults}
        rawChart={rawChart}
        showCorrected={showCorrected}
        setRawChart={setRawChart}
        setShowCorrected={setShowCorrected}
        setModalKey={setModalKey}
        setSelectedTabKey={setSelectedTabKey}
      />

      {/* 👥 사람들의 반응 심층 분석 (VoC + 연관어 + 커뮤니티 통합) */}
      {spikes.length > 0 && (
        <DeepAnalysisSection
          keyword={keyword}
          spikes={spikes}
          evidence={{
            news: evidence.news,
            videos: evidence.videos,
            comments: evidence.comments,
          }}
        />
      )}

      {/* 🎯 이벤트 스터디 — 시즌·공휴일이 검색에 준 영향 */}
      {eventImpacts.length > 0 && (
        <EventStudyCard keyword={keyword} impacts={eventImpacts} />
      )}

      {/* 유행 사이클 감지 */}
      {cycleAnalysis.cycles.length > 0 && (
        <TrendCycleCard analysis={cycleAnalysis} news={evidence.news} keyword={keyword} />
      )}

      {/* 과거 유사 사건 — 제거됨 (sessionStorage 한계) */}

      {/* ─── 접기 가능 상세: 선행지표 + 비교 + 검증체인 + 급등 진행 ─── */}
      <details className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          🔬 상세 분석 펼치기
          {leadingIndicators.length > 0 && <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900 dark:text-teal-300">선행지표 {leadingIndicators.length}</span>}
          {commonSpikes.length > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900 dark:text-amber-300">공통급등 {commonSpikes.length}</span>}
          {data.verificationTrace && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">2-step {data.verificationTrace.refined ? "✓" : "…"}</span>}
          {data.compareInsight && <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-900 dark:text-purple-300">비교</span>}
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {/* 선행 지표 */}
          {leadingIndicators.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-teal-700 dark:text-teal-300">📉 선행 지표</h4>
              {leadingIndicators.map((li, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorMap[li.leader.keyword] ?? "#14b8a6" }} />
                  <b>{li.leader.keyword}</b> ×{li.leader.spike.multiplier.toFixed(1)} →
                  <span className="rounded bg-teal-100 px-1 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900 dark:text-teal-300">{li.leader.daysBefore}일 전</span>
                  → {keyword} 급등
                </div>
              ))}
            </div>
          )}

          {/* 2-step 검증 */}
          {data.verificationTrace && (
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-indigo-700 dark:text-indigo-300">🧠 2-step 검증 체인 {data.verificationTrace.refined ? "(refined)" : ""}</h4>
              {data.verificationTrace.batches.map((b, i) => (
                <div key={i} className="text-slate-600 dark:text-slate-400">
                  &quot;{b.hypothesisTitle}&quot; → <span className="font-mono text-slate-500">&quot;{b.query}&quot;</span> ({b.newsCount}건)
                </div>
              ))}
            </div>
          )}

          {/* 비교 분석 */}
          {data.compareInsight && data.keywords && data.keywords.length >= 2 && (
            <ComparisonCard
              data={data.compareInsight}
              keywords={data.keywords}
              primaryKeyword={keyword}
              colors={colorMap}
            />
          )}
        </div>
      </details>

      {/* 급등 분석 — 인라인 한 줄 + 모달 */}
      {allSpikeTabs.length > 0 && (() => {
        const done = allSpikeTabs.filter((t) => spikeResults[t.key]?.status === "done").length;
        const total = Math.min(allSpikeTabs.length, 6);
        return (
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold">⚡ 급등 {done}/{total}</span>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
            <span>각 급등 점을 클릭하면 모달 상세 분석</span>
          </div>
        );
      })()}

      {/* 급등 구간 분석 모달 */}
      {modalKey && (() => {
        const t = allSpikeTabs.find((tab) => tab.key === modalKey);
        if (!t) return null;
        const r = spikeResults[t.key];

        // lazy: 아직 분석 안 됐으면 이 시점에 요청
        if (!r) {
          setSpikeResults((prev) => ({ ...prev, [t.key]: { status: "loading" } }));
          fetch("/api/spike-insight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keyword: t.keyword,
              spike: {
                startPeriod: t.spike.startPeriod,
                endPeriod: t.spike.endPeriod,
                peakPeriod: t.spike.peakPeriod,
                peakRatio: t.spike.peakRatio,
                multiplier: t.spike.multiplier,
              },
              news: t.isPrimary ? evidence.news : [],
              videos: t.isPrimary ? evidence.videos : [],
              comments: t.isPrimary ? evidence.comments : [],
              includeSentiment: false,
            }),
          })
            .then(async (res) => {
              const j = await res.json();
              if (!res.ok) throw new Error(j.error || `오류 ${res.status}`);
              setSpikeResults((prev) => ({
                ...prev,
                [t.key]: {
                  status: "done",
                  data: j.insight,
                  refetched: j.refetched,
                  peakEvidence: j.evidence,
                  sentimentTimeline: j.sentimentTimeline ?? null,
                },
              }));
            })
            .catch((e) => {
              setSpikeResults((prev) => ({
                ...prev,
                [t.key]: { status: "error", error: (e as Error).message },
              }));
            });
        }

        return (
          <SpikeAnalysisModal
            keyword={t.keyword}
            color={t.color}
            spike={t.spike}
            data={r?.data ?? null}
            refetched={r?.refetched ?? null}
            peakEvidence={r?.peakEvidence ?? null}
            loading={!r || r.status === "pending" || r.status === "loading"}
            error={r?.status === "error" ? r.error ?? "오류" : null}
            onClose={() => setModalKey(null)}
          />
        );
      })()}

      {/* 가설 카드 — 각 카드마다 "더 파보기" 버튼으로 인터랙티브 마이닝 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">🎯 가설 {insight.hypotheses.length}개</h3>
          <p className="text-xs text-slate-500">
            💡 각 가설의 <b>🔬 더 파보기</b>로 추가 검증 (가설당 Claude 1회 + 네이버 3쿼리)
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {insight.hypotheses.map((h, i) => (
            <HypothesisCard key={i} index={i} hypothesis={h} keyword={keyword} />
          ))}
        </div>
      </section>

      {/* ─── 섹션: 연관어 분석 (썸트렌드 연관어 네트워크 스타일) ─── */}
      {insight.relatedKeywords && insight.relatedKeywords.length > 0 && (
        <RelatedKeywordsCard keyword={keyword} relatedKeywords={insight.relatedKeywords} />
      )}

      {/* ─── 섹션: 유튜브 반응 (썸트렌드 스타일) ─── */}
      <YouTubeStatsCard videos={evidence.videos} comments={evidence.comments} />

      {/* ─── 섹션: 긍·부정 분석 ─── */}
      <SentimentOverviewCard
        keyword={keyword}
        news={evidence.news}
        mindset={insight.mindset}
      />

      {/* ─── 섹션: 원문 증거 ─── */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-semibold">
            📰 네이버 뉴스 <span className="text-sm font-normal text-slate-400">({evidence.news.length})</span>
          </h3>
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
            {evidence.news.slice(0, 20).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-slate-400">N{i + 1}</span>
                  <span className="text-xs text-slate-400">
                    {n.pubDate ? formatDate(n.pubDate) : ""}
                  </span>
                </div>
                <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {n.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {n.description}
                </p>
              </a>
            ))}
            {evidence.news.length === 0 && (
              <p className="text-sm text-slate-400">관련 뉴스가 없습니다.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold">
            🎬 YouTube 영상 <span className="text-sm font-normal text-slate-400">({evidence.videos.length})</span>
          </h3>
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
            {evidence.videos.map((v, i) => (
              <a
                key={v.videoId}
                href={`https://youtu.be/${v.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-red-300 hover:bg-red-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-800 dark:hover:bg-slate-800"
              >
                <img
                  src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt=""
                  className="h-16 w-28 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-slate-400">V{i + 1}</span>
                    <span className="text-xs text-slate-400">
                      👀 {v.viewCount.toLocaleString()}
                    </span>
                  </div>
                  <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {v.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">{v.channelTitle}</p>
                </div>
              </a>
            ))}
            {evidence.videos.length === 0 && (
              <p className="text-sm text-slate-400">관련 영상이 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      {/* 댓글 */}
      {evidence.comments.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold">
            💬 주요 댓글 샘플 <span className="text-sm font-normal text-slate-400">({evidence.comments.length})</span>
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {evidence.comments.slice(0, 10).map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-slate-400">C{i + 1}</span>
                  <span className="text-xs text-slate-400">👍 {c.likeCount}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-slate-700 dark:text-slate-300">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
