// 유행 사이클 감지 — 검색량이 올라갔다가 내려오는 bell curve를 하나의 "유행"으로 인식.
//
// 알고리즘:
//   1. 전체 평균 × threshold 를 기준선으로
//   2. 기준선을 넘는 연속 구간 = 유행 후보
//   3. 각 구간에서 피크 + 시작 + 종료 결정
//   4. 너무 짧은 건 노이즈로 제거
//   5. 사이클 간 간격 → 주기성 판단

export interface TrendPoint {
  period: string;
  ratio: number;
}

export interface TrendCycle {
  startIdx: number;
  peakIdx: number;
  endIdx: number;
  startPeriod: string;
  peakPeriod: string;
  endPeriod: string;
  peakRatio: number;
  durationDays: number;
  avgRatio: number;
  baselineAvg: number;
  intensity: number; // peakRatio / baseline
  /** AUC 기반 강도: 기준선 위 면적 합산 (면적이 클수록 강한 유행) */
  auc: number;
  /** 정규화된 AUC (일 평균 초과량) */
  aucPerDay: number;
}

export interface CycleAnalysis {
  cycles: TrendCycle[];
  isRecurring: boolean;
  recurringIntervalDays: number | null;
  pattern: "annual" | "seasonal" | "one-time" | "irregular";
  patternDescription: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * 유행 사이클 감지.
 *
 * 알고리즘:
 *   1. adaptive threshold — 데이터 분포(평균 + k*표준편차)로 자동 결정하거나, 명시적 threshold 사용
 *   2. 기준선 넘는 연속 구간 찾기
 *   3. 각 구간에서 피크 + 시작 + 종료 결정
 *   4. AUC(면적) 기반 유행 강도 추가 계산
 *   5. 사이클 간 간격 → 주기성 판단
 *
 * @param series 시계열 데이터
 * @param opts.threshold 기준선 대비 배율. 미지정 시 adaptive (평균 + 1σ 기반)
 * @param opts.adaptive adaptive threshold 사용 여부 (기본 true, threshold 명시 시 무시)
 * @param opts.minDurationDays 최소 유행 기간 (기본 5일)
 * @param opts.mergeGapDays 이 간격 이하면 하나로 병합 (기본 3일)
 */
export function detectTrendCycles(
  series: TrendPoint[],
  opts: {
    threshold?: number; // 기준선 대비 배율 (기본: adaptive)
    adaptive?: boolean; // adaptive threshold 사용 (기본 true)
    minDurationDays?: number; // 최소 유행 기간 (기본 5일)
    mergeGapDays?: number; // 이 간격 이하면 하나로 병합 (기본 3일)
  } = {}
): CycleAnalysis {
  const minDuration = opts.minDurationDays ?? 5;
  const mergeGap = opts.mergeGapDays ?? 3;
  const n = series.length;

  if (n < 14) {
    return { cycles: [], isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "데이터가 부족합니다" };
  }

  // 기준선: 전체 평균
  const baseline = series.reduce((s, p) => s + p.ratio, 0) / n;

  // Adaptive threshold: 명시적 threshold가 없으면, 데이터 분포 기반 결정
  // mean + 1σ 를 cutoff로 사용 → 변동이 크면 threshold 높아지고, 안정적이면 낮아짐
  let threshold: number;
  if (opts.threshold != null) {
    threshold = opts.threshold;
  } else if (opts.adaptive === false) {
    threshold = 1.3; // 레거시 기본값
  } else {
    // adaptive: (mean + 1*std) / mean 로 threshold 결정
    const variance = series.reduce((s, p) => s + (p.ratio - baseline) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    // threshold = (baseline + std) / baseline = 1 + std/baseline
    // 최소 1.15, 최대 2.0 으로 클램핑
    const raw = baseline > 0 ? 1 + std / baseline : 1.3;
    threshold = Math.max(1.15, Math.min(2.0, raw));
  }

  const cutoff = baseline * threshold;

  // 기준선 넘는 연속 구간 찾기
  const rawSegments: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < n) {
    if (series[i].ratio >= cutoff) {
      const start = i;
      while (i < n && series[i].ratio >= cutoff * 0.8) i++; // 살짝 아래도 포함 (하강 구간)
      rawSegments.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }

  // 인접 구간 병합
  const merged: Array<{ start: number; end: number }> = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && seg.start - last.end <= mergeGap) {
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  // 사이클 생성
  const cycles: TrendCycle[] = [];
  for (const seg of merged) {
    const duration = seg.start < n - 1 && seg.end > 0
      ? daysBetween(series[seg.start].period, series[seg.end].period)
      : seg.end - seg.start;

    if (duration < minDuration) continue;

    // 피크 찾기
    let peakIdx = seg.start;
    for (let k = seg.start; k <= seg.end; k++) {
      if (series[k].ratio > series[peakIdx].ratio) peakIdx = k;
    }

    // 실제 시작: 피크 전에 기준선 아래로 내려간 마지막 지점
    let realStart = seg.start;
    for (let k = peakIdx - 1; k >= 0; k--) {
      if (series[k].ratio < baseline) { realStart = k + 1; break; }
      if (k === 0) realStart = 0;
    }

    // 실제 종료: 피크 후에 기준선 아래로 내려간 첫 지점
    let realEnd = seg.end;
    for (let k = peakIdx + 1; k < n; k++) {
      if (series[k].ratio < baseline) { realEnd = k - 1; break; }
      if (k === n - 1) realEnd = n - 1;
    }

    const cycleSlice = series.slice(realStart, realEnd + 1);
    const avgRatio = cycleSlice.reduce((s, p) => s + p.ratio, 0) / cycleSlice.length;
    const actualDuration = daysBetween(series[realStart].period, series[realEnd].period);

    // AUC: 기준선 위 면적 (사다리꼴 적분 근사)
    let auc = 0;
    for (let k = realStart; k <= realEnd; k++) {
      const excess = Math.max(series[k].ratio - baseline, 0);
      auc += excess;
    }
    const durationForAuc = Math.max(actualDuration, 1);
    const aucPerDay = auc / durationForAuc;

    cycles.push({
      startIdx: realStart,
      peakIdx,
      endIdx: realEnd,
      startPeriod: series[realStart].period,
      peakPeriod: series[peakIdx].period,
      endPeriod: series[realEnd].period,
      peakRatio: series[peakIdx].ratio,
      durationDays: Math.max(actualDuration, 1),
      avgRatio: Math.round(avgRatio * 10) / 10,
      baselineAvg: Math.round(baseline * 10) / 10,
      intensity: Math.round((series[peakIdx].ratio / Math.max(baseline, 1)) * 10) / 10,
      auc: Math.round(auc * 10) / 10,
      aucPerDay: Math.round(aucPerDay * 100) / 100,
    });
  }

  // 기간이 겹치는 사이클 병합 — 가장 강한 피크만 유지
  const deduped: TrendCycle[] = [];
  const used = new Set<number>();
  // 피크 강도 순으로 처리
  const byIntensity = [...cycles].sort((a, b) => b.intensity - a.intensity);
  for (const c of byIntensity) {
    if (used.has(c.peakIdx)) continue;
    // 이 사이클과 80% 이상 겹치는 기존 항목이 있으면 skip
    const overlap = deduped.some((d) => {
      const overlapStart = Math.max(d.startIdx, c.startIdx);
      const overlapEnd = Math.min(d.endIdx, c.endIdx);
      if (overlapStart > overlapEnd) return false;
      const overlapLen = overlapEnd - overlapStart;
      const shorterLen = Math.min(d.endIdx - d.startIdx, c.endIdx - c.startIdx);
      return shorterLen > 0 && overlapLen / shorterLen > 0.5;
    });
    if (!overlap) {
      deduped.push(c);
      used.add(c.peakIdx);
    }
  }
  const dedupedCycles = deduped;

  // 강도 순 정렬
  dedupedCycles.sort((a, b) => b.intensity - a.intensity);

  // 주기성 판단
  const analysis = analyzeRecurrence(dedupedCycles, series);

  return {
    cycles: dedupedCycles,
    ...analysis,
  };
}

function analyzeRecurrence(cycles: TrendCycle[], series: TrendPoint[]): {
  isRecurring: boolean;
  recurringIntervalDays: number | null;
  pattern: "annual" | "seasonal" | "one-time" | "irregular";
  patternDescription: string;
} {
  if (cycles.length === 0) {
    return { isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "유행 사이클이 감지되지 않았습니다" };
  }

  if (cycles.length === 1) {
    return { isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: `1회성 유행 (${cycles[0].startPeriod} ~ ${cycles[0].endPeriod}, ${cycles[0].durationDays}일간)` };
  }

  // 피크 날짜 기준 시간순 정렬
  const sorted = [...cycles].sort((a, b) => a.peakPeriod.localeCompare(b.peakPeriod));

  // 피크 간 간격 계산
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1].peakPeriod, sorted[i].peakPeriod));
  }

  if (gaps.length === 0) {
    return { isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "1회성 유행" };
  }

  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const gapVariance = gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length;
  const gapStd = Math.sqrt(gapVariance);

  // 연간 주기 (300-400일 간격, 표준편차 60일 이내)
  if (avgGap >= 300 && avgGap <= 400 && gapStd < 60) {
    return {
      isRecurring: true,
      recurringIntervalDays: Math.round(avgGap),
      pattern: "annual",
      patternDescription: `매년 비슷한 시기에 반복되는 유행 (약 ${Math.round(avgGap)}일 주기, ${cycles.length}회 감지)`,
    };
  }

  // 계절성 (60-200일 간격)
  if (avgGap >= 60 && avgGap <= 200 && gapStd < avgGap * 0.4) {
    return {
      isRecurring: true,
      recurringIntervalDays: Math.round(avgGap),
      pattern: "seasonal",
      patternDescription: `약 ${Math.round(avgGap / 30)}개월 주기로 반복 (${cycles.length}회 감지)`,
    };
  }

  // 비주기적이지만 여러 번
  if (cycles.length >= 2) {
    // 같은 달(월)에 반복되는지 체크
    const months = sorted.map((c) => parseInt(c.peakPeriod.slice(5, 7), 10));
    const monthCounts = new Map<number, number>();
    for (const m of months) monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
    const maxMonthCount = Math.max(...monthCounts.values());
    const peakMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const monthNames = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    if (maxMonthCount >= 2) {
      return {
        isRecurring: true,
        recurringIntervalDays: Math.round(avgGap),
        pattern: "annual",
        patternDescription: `${monthNames[peakMonth]} 전후에 주로 유행 (${maxMonthCount}회 반복, 연간 패턴)`,
      };
    }

    return {
      isRecurring: false,
      recurringIntervalDays: null,
      pattern: "irregular",
      patternDescription: `${cycles.length}회 유행이 감지됐지만 규칙적 주기는 없음 (비주기적)`,
    };
  }

  return { isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "1회성 유행" };
}
