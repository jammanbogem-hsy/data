// 언급량 보정 지수 (Corrected Index)
//
// 원리:
// 1. 요일 보정: 요일별 평균을 구해 각 날의 값을 나눔 → 요일 효과 제거
// 2. 이동평균 보정: 7일 이동평균 대비 비율 → 추세 제거, 이상치만 강조
// 3. 전년 동기 대비: (올해 최근 30일 평균 / 작년 같은 달 평균 - 1) × 100%
//
// 출력: 1.0 = 평시, >1.0 = 평시 대비 높음, <1.0 = 낮음

export interface TrendPoint {
  period: string; // YYYY-MM-DD
  ratio: number;
}

export interface CorrectedPoint extends TrendPoint {
  corrected: number; // 보정 후 값 (요일 + 이동평균 보정)
  weekday: number; // 0(일) ~ 6(토)
  ma7: number; // 7일 이동평균
}

/**
 * 요일 + 이동평균 보정 시계열.
 * corrected = (ratio / 요일평균) / (MA7 of ratio/요일평균) × 100
 * 결과적으로 100 근처가 평시, 튀면 이상치.
 */
export function correctTimeSeries(series: TrendPoint[]): CorrectedPoint[] {
  if (series.length < 14) {
    return series.map((p) => ({
      ...p,
      corrected: p.ratio,
      weekday: new Date(p.period).getDay(),
      ma7: p.ratio,
    }));
  }

  // 1) 요일별 평균 계산
  const byDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const p of series) {
    const wd = new Date(p.period).getDay();
    byDay[wd].push(p.ratio);
  }
  const dayAvg: Record<number, number> = {};
  for (let d = 0; d < 7; d++) {
    const arr = byDay[d];
    dayAvg[d] = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 1;
  }

  // 전체 평균
  const overallAvg = series.reduce((s, p) => s + p.ratio, 0) / series.length;

  // 2) 요일 보정 (요일평균으로 나눠 요일 효과 제거, 전체 평균 스케일 유지)
  const dayCorrected = series.map((p) => {
    const wd = new Date(p.period).getDay();
    const dAvg = dayAvg[wd] || 1;
    return {
      ...p,
      weekday: wd,
      ratio_dc: dAvg > 0 ? (p.ratio / dAvg) * overallAvg : p.ratio,
    };
  });

  // 3) 7일 이동평균
  const result: CorrectedPoint[] = [];
  for (let i = 0; i < dayCorrected.length; i++) {
    let ma7 = dayCorrected[i].ratio_dc;
    if (i >= 7) {
      let sum = 0;
      for (let j = i - 7; j < i; j++) sum += dayCorrected[j].ratio_dc;
      ma7 = sum / 7;
    }

    // 보정 지수: 요일 보정된 값을 0-100 스케일로 유지
    result.push({
      period: dayCorrected[i].period,
      ratio: dayCorrected[i].ratio, // 원본 유지
      corrected: Math.round(dayCorrected[i].ratio_dc * 10) / 10,
      weekday: dayCorrected[i].weekday,
      ma7: Math.round(ma7 * 10) / 10,
    });
  }

  return result;
}

/**
 * 핵심 요약 지표 3개 — 썸트렌드 스타일 상단 카드용.
 */
export interface SummaryMetrics {
  /** 피크 날짜 (ratio 최대) */
  peakDate: string;
  peakRatio: number;
  /** 주요 소스: "네이버 뉴스" | "YouTube" 등 (뉴스 건수 기반) */
  dominantSource: string;
  dominantSourceCount: number;
  /** 최근 30일 vs 직전 30일 변화율 (%) */
  recentChangePercent: number;
  /** 평균 ratio */
  avgRatio: number;
  /** 보정 지수 평균 (최근 7일) */
  recentCorrectedAvg: number;
  /** 요일별 패턴: 가장 높은 요일 */
  peakWeekday: string;
  peakWeekdayAvg: number;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function computeSummaryMetrics(
  corrected: CorrectedPoint[],
  newsCount: number,
  videoCount: number,
  blogCount: number
): SummaryMetrics {
  // 피크
  let peakIdx = 0;
  for (let i = 1; i < corrected.length; i++) {
    if (corrected[i].ratio > corrected[peakIdx].ratio) peakIdx = i;
  }

  // 최근 30 vs 직전 30
  const n = corrected.length;
  const recent30 = corrected.slice(Math.max(0, n - 30));
  const prior30 = corrected.slice(Math.max(0, n - 60), Math.max(0, n - 30));
  const recentAvg = recent30.reduce((s, p) => s + p.ratio, 0) / Math.max(recent30.length, 1);
  const priorAvg = prior30.reduce((s, p) => s + p.ratio, 0) / Math.max(prior30.length, 1);
  const changePercent = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  // 소스
  const sources: Array<[string, number]> = [
    ["네이버 뉴스", newsCount],
    ["YouTube", videoCount],
    ["블로그", blogCount],
  ];
  sources.sort((a, b) => b[1] - a[1]);

  // 전체 평균
  const avgRatio = corrected.reduce((s, p) => s + p.ratio, 0) / Math.max(n, 1);

  // 최근 7일 보정 평균
  const recent7 = corrected.slice(Math.max(0, n - 7));
  const recentCorrectedAvg = recent7.reduce((s, p) => s + p.corrected, 0) / Math.max(recent7.length, 1);

  // 요일별 패턴
  const byDay: Record<number, number[]> = {};
  for (const p of corrected) {
    (byDay[p.weekday] ??= []).push(p.ratio);
  }
  let peakDay = 0;
  let peakDayAvg = 0;
  for (let d = 0; d < 7; d++) {
    const arr = byDay[d] ?? [];
    const avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    if (avg > peakDayAvg) {
      peakDayAvg = avg;
      peakDay = d;
    }
  }

  return {
    peakDate: corrected[peakIdx]?.period ?? "",
    peakRatio: corrected[peakIdx]?.ratio ?? 0,
    dominantSource: sources[0][0],
    dominantSourceCount: sources[0][1],
    recentChangePercent: Math.round(changePercent * 10) / 10,
    avgRatio: Math.round(avgRatio * 10) / 10,
    recentCorrectedAvg: Math.round(recentCorrectedAvg * 10) / 10,
    peakWeekday: WEEKDAY_KO[peakDay],
    peakWeekdayAvg: Math.round(peakDayAvg * 10) / 10,
  };
}
