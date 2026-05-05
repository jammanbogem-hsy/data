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

export function detectTrendCycles(
  series: TrendPoint[],
  opts: {
    threshold?: number; // 기준선 대비 배율 (기본 1.3)
    minDurationDays?: number; // 최소 유행 기간 (기본 5일)
    mergeGapDays?: number; // 이 간격 이하면 하나로 병합 (기본 3일)
  } = {}
): CycleAnalysis {
  const threshold = opts.threshold ?? 1.3;
  const minDuration = opts.minDurationDays ?? 5;
  const mergeGap = opts.mergeGapDays ?? 3;
  const n = series.length;

  if (n < 14) {
    return { cycles: [], isRecurring: false, recurringIntervalDays: null, pattern: "one-time", patternDescription: "데이터가 부족합니다" };
  }

  // 기준선: 전체 평균
  const baseline = series.reduce((s, p) => s + p.ratio, 0) / n;
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
    });
  }

  // 강도 순 정렬
  cycles.sort((a, b) => b.intensity - a.intensity);

  // 주기성 판단
  const analysis = analyzeRecurrence(cycles, series);

  return {
    cycles,
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
