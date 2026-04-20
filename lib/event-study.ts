// Event Study (이벤트 스터디) — 특정 이벤트 전/중/후 키워드 검색량 변화 자동 계산.
//
// 원리:
//   beforeAvg  = 이벤트 -N일 ~ -M일 평균
//   duringAvg  = 이벤트 -K일 ~ +K일 평균 (이벤트 당일 중심)
//   afterAvg   = 이벤트 +M일 ~ +N일 평균
//   lift       = (duringAvg - beforeAvg) / beforeAvg × 100 (%)
//   rebound    = (afterAvg - beforeAvg) / beforeAvg × 100 (이벤트 후 여진)
//
// 한 키워드 시계열 × 여러 이벤트 → 이벤트별 영향도 랭킹.

import { detectSeasonal } from "./korean-seasonal";

export interface EventDef {
  /** "추석", "초복", "수능" 등 */
  name: string;
  /** YYYY-MM-DD */
  date: string;
  /** 분류 (명절/절기/기념일/스포츠/기타) */
  category?: string;
}

export interface EventImpact {
  event: EventDef;
  beforeAvg: number;
  duringAvg: number;
  afterAvg: number;
  peakInDuring: number;
  /** (during - before) / before × 100 */
  lift: number;
  /** (after - before) / before × 100 */
  rebound: number;
  /** 샘플 크기 (before + during + after 포인트 수) */
  sampleSize: number;
  /** 신뢰도: 샘플 크기·lift 크기 기반 */
  confidence: "high" | "medium" | "low" | "insufficient";
}

export interface TrendPoint {
  period: string; // YYYY-MM-DD
  ratio: number;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function findIndexByDate(series: TrendPoint[], dateStr: string): number {
  // 가장 가까운 날짜의 index 반환 (이분탐색 or 선형)
  if (series.length === 0) return -1;
  const target = new Date(dateStr).getTime();
  let best = 0;
  let bestDiff = Math.abs(new Date(series[0].period).getTime() - target);
  for (let i = 1; i < series.length; i++) {
    const d = Math.abs(new Date(series[i].period).getTime() - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export function analyzeEventImpact(
  series: TrendPoint[],
  event: EventDef,
  opts: {
    beforeWindow?: number; // -N일 ~ -M일 (기본 14일~3일)
    duringWindow?: number; // ±K일 (기본 ±2일)
    afterWindow?: number; // +M일 ~ +N일 (기본 3일~10일)
  } = {}
): EventImpact | null {
  const beforeWindow = opts.beforeWindow ?? 14;
  const duringWindow = opts.duringWindow ?? 2;
  const afterWindow = opts.afterWindow ?? 10;

  const eIdx = findIndexByDate(series, event.date);
  if (eIdx < 0) return null;

  const n = series.length;
  // 인덱스 기반으로 범위 컷 (날짜 간격이 일간이라 가정)
  const beforeArr = series
    .slice(Math.max(0, eIdx - beforeWindow), Math.max(0, eIdx - duringWindow))
    .map((p) => p.ratio);
  const duringArr = series
    .slice(Math.max(0, eIdx - duringWindow), Math.min(n, eIdx + duringWindow + 1))
    .map((p) => p.ratio);
  const afterArr = series
    .slice(Math.min(n, eIdx + duringWindow + 1), Math.min(n, eIdx + afterWindow + 1))
    .map((p) => p.ratio);

  if (beforeArr.length < 3 || duringArr.length < 1) return null;

  const beforeAvg = avg(beforeArr);
  const duringAvg = avg(duringArr);
  const afterAvg = avg(afterArr);
  const peakInDuring = duringArr.reduce((m, v) => Math.max(m, v), 0);

  const lift = beforeAvg > 0 ? ((duringAvg - beforeAvg) / beforeAvg) * 100 : 0;
  const rebound = beforeAvg > 0 ? ((afterAvg - beforeAvg) / beforeAvg) * 100 : 0;

  const sampleSize = beforeArr.length + duringArr.length + afterArr.length;
  let confidence: EventImpact["confidence"] = "insufficient";
  if (sampleSize >= 15) {
    if (Math.abs(lift) >= 40) confidence = "high";
    else if (Math.abs(lift) >= 15) confidence = "medium";
    else confidence = "low";
  } else if (sampleSize >= 8) {
    confidence = Math.abs(lift) >= 30 ? "medium" : "low";
  }

  return {
    event,
    beforeAvg,
    duringAvg,
    afterAvg,
    peakInDuring,
    lift,
    rebound,
    sampleSize,
    confidence,
  };
}

/**
 * 시계열 기간 안에 존재하는 모든 시즌 이벤트를 자동 발굴해 영향 계산.
 * detectSeasonal을 매일 돌려 이벤트 목록을 추출한 뒤 동일 이벤트 중복 제거.
 */
export function autoDiscoverEvents(series: TrendPoint[]): EventDef[] {
  const found = new Map<string, EventDef>(); // key: "name|YYYY-MM"
  for (const p of series) {
    const seasonal = detectSeasonal(p.period);
    // 계절 같은 아주 일반적인 것 제외
    const filtered = seasonal.filter(
      (s) => !["봄", "여름", "가을", "겨울"].includes(s)
    );
    for (const name of filtered) {
      // 같은 이벤트가 연간 여러 날에 걸쳐 잡힐 수 있음 — 가장 이른 날짜 사용
      const monthKey = p.period.slice(0, 7);
      const key = `${name}|${monthKey}`;
      if (!found.has(key)) {
        found.set(key, { name, date: p.period });
      }
    }
  }
  return Array.from(found.values());
}

/**
 * 시계열에 대해 모든 이벤트 영향을 계산하고 강한 순으로 정렬해 상위 N개 반환.
 */
export function runEventStudy(
  series: TrendPoint[],
  events?: EventDef[],
  topN = 8
): EventImpact[] {
  const evList = events ?? autoDiscoverEvents(series);
  const impacts: EventImpact[] = [];
  for (const ev of evList) {
    const r = analyzeEventImpact(series, ev);
    if (r) impacts.push(r);
  }
  // 유의미한 것만 (lift 절대값 10%+ 또는 confidence 이상)
  const filtered = impacts.filter(
    (i) => Math.abs(i.lift) >= 10 || i.confidence === "high" || i.confidence === "medium"
  );
  filtered.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
  return filtered.slice(0, topN);
}
