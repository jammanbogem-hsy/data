// 언급량 보정 지수 (Corrected Index)
//
// 원리:
// 1. 요일 보정: 요일별 평균을 구해 각 날의 값을 나눔 → 요일 효과 제거
// 2. 주말/공휴일 보정: 주말 및 한국 공휴일의 트래픽 감소 보정 (korean-seasonal.ts 활용)
// 3. 이동평균 보정: 7일 이동평균 대비 비율 → 추세 제거, 이상치만 강조
// 4. 전년 동기 대비: (올해 최근 30일 평균 / 작년 같은 달 평균 - 1) × 100%
//
// 출력: 1.0 = 평시, >1.0 = 평시 대비 높음, <1.0 = 낮음

import { detectSeasonal } from "./korean-seasonal";

export interface TrendPoint {
  period: string; // YYYY-MM-DD
  ratio: number;
}

export interface CorrectedPoint extends TrendPoint {
  corrected: number; // 보정 후 값 (요일 + 주말/공휴일 + 이동평균 보정)
  weekday: number; // 0(일) ~ 6(토)
  ma7: number; // 7일 이동평균
  /** 공휴일/시즌 여부 (해당하면 키워드 배열, 아니면 빈 배열) */
  seasonal: string[];
  /** 주말 또는 공휴일 여부 */
  isHoliday: boolean;
}

/**
 * 요일 + 주말/공휴일 + 이동평균 보정 시계열.
 *
 * 보정 순서:
 *   1. 요일별 평균으로 나누어 요일 효과 제거
 *   2. 공휴일/주말 날은 평일 대비 감소 보정 (korean-seasonal.ts 활용)
 *   3. 7일 이동평균 계산
 *
 * @param series 원본 시계열
 * @param opts.holidayCorrection 공휴일 보정 활성화 (기본 true)
 */
export function correctTimeSeries(
  series: TrendPoint[],
  opts: { holidayCorrection?: boolean } = {}
): CorrectedPoint[] {
  const useHolidayCorrection = opts.holidayCorrection !== false;

  if (series.length < 14) {
    return series.map((p) => {
      const seasonal = detectSeasonal(p.period);
      const wd = new Date(p.period).getDay();
      return {
        ...p,
        corrected: p.ratio,
        weekday: wd,
        ma7: p.ratio,
        seasonal,
        isHoliday: wd === 0 || wd === 6 || seasonal.length > 0,
      };
    });
  }

  // 0) 각 포인트에 메타데이터 부여
  const enriched = series.map((p) => {
    const wd = new Date(p.period).getDay();
    const seasonal = detectSeasonal(p.period);
    const isWeekend = wd === 0 || wd === 6;
    // 공휴일: 시즌 키워드에 공휴일성 키워드가 포함된 경우
    const holidayKeywords = ["신정", "삼일절", "현충일", "광복절", "개천절", "한글날", "추석", "한가위", "설날", "구정", "어린이날", "근로자의날", "크리스마스"];
    const isPublicHoliday = seasonal.some((s) => holidayKeywords.includes(s));
    const isHoliday = isWeekend || isPublicHoliday;

    return { ...p, weekday: wd, seasonal, isHoliday };
  });

  // 1) 요일별 평균 계산
  const byDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const p of enriched) {
    byDay[p.weekday].push(p.ratio);
  }
  const dayAvg: Record<number, number> = {};
  for (let d = 0; d < 7; d++) {
    const arr = byDay[d];
    dayAvg[d] = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 1;
  }

  // 전체 평균
  const overallAvg = series.reduce((s, p) => s + p.ratio, 0) / series.length;

  // 2) 평일/주말·공휴일 평균 비율 계산 (공휴일 보정 계수)
  let holidayFactor = 1;
  if (useHolidayCorrection) {
    const weekdayRatios: number[] = [];
    const holidayRatios: number[] = [];
    for (const p of enriched) {
      if (p.isHoliday) {
        holidayRatios.push(p.ratio);
      } else {
        weekdayRatios.push(p.ratio);
      }
    }
    const avgWeekday = weekdayRatios.length > 0
      ? weekdayRatios.reduce((s, v) => s + v, 0) / weekdayRatios.length
      : overallAvg;
    const avgHoliday = holidayRatios.length > 0
      ? holidayRatios.reduce((s, v) => s + v, 0) / holidayRatios.length
      : overallAvg;
    // 공휴일이 평일 대비 얼마나 낮은지 (보통 0.7~0.9)
    holidayFactor = avgHoliday > 0 ? avgWeekday / avgHoliday : 1;
    // 클램핑 (극단치 방지)
    holidayFactor = Math.max(1, Math.min(2.0, holidayFactor));
  }

  // 3) 요일 보정 + 공휴일 보정
  const dayCorrected = enriched.map((p) => {
    const dAvg = dayAvg[p.weekday] || 1;
    let ratioDc = dAvg > 0 ? (p.ratio / dAvg) * overallAvg : p.ratio;

    // 공휴일/주말 보정: 해당 날의 값을 올려줌 (평일 수준으로 정규화)
    if (useHolidayCorrection && p.isHoliday) {
      ratioDc *= holidayFactor;
    }

    return { ...p, ratio_dc: ratioDc };
  });

  // 4) 7일 이동평균
  const result: CorrectedPoint[] = [];
  for (let i = 0; i < dayCorrected.length; i++) {
    let ma7 = dayCorrected[i].ratio_dc;
    if (i >= 7) {
      let sum = 0;
      for (let j = i - 7; j < i; j++) sum += dayCorrected[j].ratio_dc;
      ma7 = sum / 7;
    }

    result.push({
      period: dayCorrected[i].period,
      ratio: dayCorrected[i].ratio, // 원본 유지
      corrected: Math.round(dayCorrected[i].ratio_dc * 10) / 10,
      weekday: dayCorrected[i].weekday,
      ma7: Math.round(ma7 * 10) / 10,
      seasonal: dayCorrected[i].seasonal,
      isHoliday: dayCorrected[i].isHoliday,
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
