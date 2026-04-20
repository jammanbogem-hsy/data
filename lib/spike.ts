// 시계열 데이터에서 "급등 구간"을 자동 탐지한다.
//
// 알고리즘: 이동평균(MA) 돌파
//   - 각 시점의 직전 N일 이동평균 대비 ratio 가 임계값 이상이면 급등 후보
//   - 동시에 절대치도 일정 임계값(MIN_ABS) 이상이어야 노이즈 제거
//   - 연속된 급등 시점을 하나의 구간으로 병합
//
// 사용자에게 보여줄 설명: "평소(직전 N일 평균)보다 X배 이상 검색이 늘어난 구간"

export interface TrendPoint {
  period: string  // YYYY-MM-DD or YYYY-WW or YYYY-MM
  ratio: number   // 0-100 (네이버 데이터랩 상대치)
}

export interface SpikeRange {
  startIdx: number
  endIdx: number
  startPeriod: string
  endPeriod: string
  peakIdx: number
  peakPeriod: string
  peakRatio: number
  baselineAvg: number   // 직전 평균
  multiplier: number    // peakRatio / baselineAvg
}

export interface SpikeOptions {
  /** 이동평균 윈도우 (기본: 데이터 길이의 1/5, 최소 5, 최대 14) */
  window?: number
  /** 이동평균 대비 배율 임계값 (기본 1.5) */
  multiplierThreshold?: number
  /** 절대치 최소값 (기본 20 — 0~100 스케일에서 너무 작은 값 무시) */
  minAbs?: number
  /** 두 급등 구간 사이 간격이 이 값 이하면 병합 (기본 2일) */
  mergeGap?: number
}

export function detectSpikes(
  series: TrendPoint[],
  opts: SpikeOptions = {},
): SpikeRange[] {
  const n = series.length
  if (n < 8) return []

  const window = opts.window ?? Math.max(5, Math.min(14, Math.floor(n / 5)))
  const threshold = opts.multiplierThreshold ?? 1.5
  const minAbs = opts.minAbs ?? 20
  const mergeGap = opts.mergeGap ?? 2

  // 각 시점의 baseline (직전 window일 평균)
  const baseline: number[] = []
  for (let i = 0; i < n; i++) {
    if (i < window) {
      baseline.push(0)
      continue
    }
    let sum = 0
    for (let j = i - window; j < i; j++) sum += series[j].ratio
    baseline.push(sum / window)
  }

  // 급등 시점 마킹
  const isSpike: boolean[] = series.map((p, i) => {
    if (i < window) return false
    if (p.ratio < minAbs) return false
    if (baseline[i] <= 0) return p.ratio >= minAbs * 2
    return p.ratio / baseline[i] >= threshold
  })

  // 연속 구간 병합
  const ranges: SpikeRange[] = []
  let i = 0
  while (i < n) {
    if (!isSpike[i]) { i++; continue }
    const start = i
    let end = i
    let lastSpike = i
    while (end + 1 < n) {
      const next = end + 1
      if (isSpike[next]) {
        end = next
        lastSpike = next
      } else if (next - lastSpike <= mergeGap) {
        end = next
      } else {
        break
      }
    }
    end = lastSpike

    // peak 찾기
    let peakIdx = start
    for (let k = start; k <= end; k++) {
      if (series[k].ratio > series[peakIdx].ratio) peakIdx = k
    }
    const baselineAvg = baseline[peakIdx] || baseline[start] || 1

    ranges.push({
      startIdx: start,
      endIdx: end,
      startPeriod: series[start].period,
      endPeriod: series[end].period,
      peakIdx,
      peakPeriod: series[peakIdx].period,
      peakRatio: series[peakIdx].ratio,
      baselineAvg,
      multiplier: series[peakIdx].ratio / baselineAvg,
    })
    i = end + 1
  }

  // 강한 순으로 정렬 (multiplier × peakRatio)
  ranges.sort((a, b) => b.multiplier * b.peakRatio - a.multiplier * a.peakRatio)
  return ranges
}

/** 가장 강한 급등 구간만 반환 (없으면 null) */
export function topSpike(series: TrendPoint[], opts?: SpikeOptions): SpikeRange | null {
  const all = detectSpikes(series, opts)
  return all[0] ?? null
}

// 선행 지표(leading indicator) 탐지:
//   주 키워드의 각 급등 T에 대해, 비교 키워드가 [T-N, T-1] 구간에 급등했는지 찾는다.
//   "이 키워드가 뜨기 전에 먼저 뜬 키워드"를 식별해 인과/상관 힌트 제공.
export interface LeadingIndicator {
  targetSpike: SpikeRange;
  leader: {
    keyword: string;
    spike: SpikeRange;
    daysBefore: number; // 몇 일 전에 뜬 건지
  };
}

export function detectLeadingIndicators(
  primarySpikes: SpikeRange[],
  otherKeywordSpikes: Array<{ keyword: string; spikes: SpikeRange[] }>,
  opts: { maxDaysBefore?: number; minDaysBefore?: number } = {}
): LeadingIndicator[] {
  const maxBefore = opts.maxDaysBefore ?? 21;
  const minBefore = opts.minDaysBefore ?? 1;

  const results: LeadingIndicator[] = [];
  for (const target of primarySpikes) {
    const tDate = new Date(target.peakPeriod).getTime();
    for (const other of otherKeywordSpikes) {
      for (const sp of other.spikes) {
        const sDate = new Date(sp.peakPeriod).getTime();
        const days = (tDate - sDate) / 86400000;
        if (days >= minBefore && days <= maxBefore) {
          results.push({
            targetSpike: target,
            leader: { keyword: other.keyword, spike: sp, daysBefore: Math.round(days) },
          });
        }
      }
    }
  }

  // 선행 거리(가까운 것)와 세기 기준 정렬
  results.sort((a, b) => {
    const strengthA = a.leader.spike.multiplier / Math.max(a.leader.daysBefore, 1);
    const strengthB = b.leader.spike.multiplier / Math.max(b.leader.daysBefore, 1);
    return strengthB - strengthA;
  });
  return results;
}

// 다중 키워드의 spike를 "같은 시기에 여럿이 튄" 클러스터로 묶는다.
export interface CommonSpikeCluster {
  peakPeriod: string;   // 클러스터 대표 날짜 (중앙값)
  startPeriod: string;  // 가장 이른 start
  endPeriod: string;    // 가장 늦은 end
  members: Array<{ keyword: string; spike: SpikeRange }>; // 참여 (키워드, spike)
  uniqueKeywords: string[];
  strength: number;     // 참여 키워드 수 × 평균 multiplier (정렬용)
}

export function detectCommonSpikes(
  perKeyword: Array<{ keyword: string; spikes: SpikeRange[] }>,
  opts: { maxDayGap?: number } = {}
): CommonSpikeCluster[] {
  const maxDayGap = opts.maxDayGap ?? 5;

  // 모든 spike 평탄화 + 날짜순 정렬
  type Item = { keyword: string; spike: SpikeRange; date: Date };
  const all: Item[] = [];
  for (const p of perKeyword) {
    for (const s of p.spikes) {
      const dt = new Date(s.peakPeriod);
      if (!isNaN(dt.getTime())) all.push({ keyword: p.keyword, spike: s, date: dt });
    }
  }
  all.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 인접한 것끼리 클러스터
  const clusters: Item[][] = [];
  for (const item of all) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const lastDate = last[last.length - 1].date;
      const diff = Math.abs(item.date.getTime() - lastDate.getTime()) / 86400000;
      if (diff <= maxDayGap) {
        last.push(item);
        continue;
      }
    }
    clusters.push([item]);
  }

  // 여러 키워드가 있는 클러스터만
  const results: CommonSpikeCluster[] = [];
  for (const cluster of clusters) {
    const unique = Array.from(new Set(cluster.map((c) => c.keyword)));
    if (unique.length < 2) continue;

    const sorted = [...cluster].sort((a, b) => a.date.getTime() - b.date.getTime());
    const midIdx = Math.floor(sorted.length / 2);
    const avgMul = sorted.reduce((s, c) => s + c.spike.multiplier, 0) / sorted.length;

    results.push({
      peakPeriod: sorted[midIdx].spike.peakPeriod,
      startPeriod: sorted[0].spike.startPeriod,
      endPeriod: sorted[sorted.length - 1].spike.endPeriod,
      members: sorted.map((c) => ({ keyword: c.keyword, spike: c.spike })),
      uniqueKeywords: unique,
      strength: unique.length * avgMul,
    });
  }

  results.sort((a, b) => b.strength - a.strength);
  return results;
}

/**
 * detectSpikes 가 아무것도 못 찾았을 때 폴백:
 * 전체 기간에서 가장 높은 "자연 peak" 한 개를 반환.
 * 계절성 수요(냉면 여름, 팥빙수 여름, 스키 겨울)처럼 이동평균 돌파가 아닌
 * 완만한 벨커브 패턴을 포착한다.
 */
export function detectNaturalPeak(
  series: TrendPoint[],
  opts: { windowAround?: number; minRelative?: number } = {},
): SpikeRange | null {
  const n = series.length
  if (n < 8) return null

  const windowAround = opts.windowAround ?? Math.max(7, Math.floor(n / 12))
  const minRelative = opts.minRelative ?? 1.5

  const overallAvg = series.reduce((s, p) => s + p.ratio, 0) / n
  if (overallAvg <= 0) return null

  let peakIdx = 0
  for (let i = 1; i < n; i++) {
    if (series[i].ratio > series[peakIdx].ratio) peakIdx = i
  }
  const peakRatio = series[peakIdx].ratio
  if (peakRatio < overallAvg * minRelative) return null

  const start = Math.max(0, peakIdx - windowAround)
  const end = Math.min(n - 1, peakIdx + windowAround)

  return {
    startIdx: start,
    endIdx: end,
    startPeriod: series[start].period,
    endPeriod: series[end].period,
    peakIdx,
    peakPeriod: series[peakIdx].period,
    peakRatio,
    baselineAvg: overallAvg,
    multiplier: peakRatio / overallAvg,
  }
}
