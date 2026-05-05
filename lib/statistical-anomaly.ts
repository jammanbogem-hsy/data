// 통계 기반 이상치 탐지 (Statistical Anomaly Detection)
//
// STL 분해의 잔차(Residual) 성분에 z-score를 적용하여 이상치를 탐지한다.
// "추측이 아닌 데이터 속에서 의미를 얻는 것" — 숫자 패턴 자체가 말하는 것.
//
// 알고리즘:
//   1. STL 분해 → residual 추출
//   2. residual의 평균(μ)과 표준편차(σ) 계산
//   3. 각 시점의 z-score = (residual - μ) / σ
//   4. |z| > sigmaThreshold(기본 2.0) → 이상치 판정
//
// 기존 detectSpikes(이동평균 돌파)와 보완 관계:
//   - detectSpikes: "평소 대비 급등" (절대적 돌파)
//   - detectStatisticalAnomalies: "추세·계절성 제거 후 통계적 비정상" (구조적 이탈)
//
// 외부 패키지 없이 순수 TypeScript 구현.

export interface TrendPoint {
  period: string;  // YYYY-MM-DD or YYYY-WW or YYYY-MM
  ratio: number;   // 0-100 (네이버 데이터랩 상대치)
}

export interface AnomalyPoint {
  /** 원본 기간 */
  period: string;
  /** 원본 값 */
  ratio: number;
  /** 잔차의 z-score */
  zScore: number;
  /** 이상치 여부 */
  isAnomaly: boolean;
  /** 이상치 방향: 양의 이탈(up), 음의 이탈(down), 정상(normal) */
  direction: "up" | "down" | "normal";
}

interface STLResultInternal {
  trend: number[];
  seasonal: number[];
  residual: number[];
}

/**
 * 시계열 데이터에서 통계적 이상치를 탐지한다.
 *
 * STL 분해로 추세와 계절성을 제거한 뒤, 잔차의 z-score를 기반으로
 * 통계적으로 유의미한 이상값을 식별한다.
 *
 * @param series - 날짜순 정렬된 시계열 데이터 (TrendPoint[])
 * @param sigmaThreshold - z-score 임계값 (기본 2.0, |z| > threshold → 이상치)
 * @returns AnomalyPoint[] — 각 시점의 z-score와 이상치 여부
 *
 * @example
 * ```ts
 * const data: TrendPoint[] = [
 *   { period: "2025-01-06", ratio: 45 },
 *   { period: "2025-01-07", ratio: 50 },
 *   { period: "2025-01-08", ratio: 48 },
 *   // ... 최소 수 주 분량의 데이터
 *   { period: "2025-02-15", ratio: 92 }, // ← 이상치 후보
 * ];
 * const anomalies = detectStatisticalAnomalies(data, 2.0);
 * const found = anomalies.filter(a => a.isAnomaly);
 * console.log(`이상치 ${found.length}건 탐지`);
 * found.forEach(a => {
 *   console.log(`${a.period}: z=${a.zScore.toFixed(2)} (${a.direction})`);
 * });
 * ```
 */
export function detectStatisticalAnomalies(
  series: TrendPoint[],
  sigmaThreshold?: number,
): AnomalyPoint[] {
  const threshold = sigmaThreshold ?? 2.0;
  const n = series.length;

  if (n < 8) {
    // 데이터가 너무 적으면 분석 불가 — 모두 normal 반환
    return series.map((p) => ({
      period: p.period,
      ratio: p.ratio,
      zScore: 0,
      isAnomaly: false,
      direction: "normal" as const,
    }));
  }

  // STL 분해 (내부 구현 — 외부 import 없이 독립)
  const stl = stlDecomposeInternal(series);
  const residual = stl.residual;

  // 잔차의 평균과 표준편차
  const mean = residual.reduce((s, v) => s + v, 0) / n;
  const variance =
    residual.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);

  // z-score 계산 및 이상치 판정
  return series.map((p, i) => {
    const z = stddev > 0 ? (residual[i] - mean) / stddev : 0;
    const isAnomaly = Math.abs(z) > threshold;
    let direction: "up" | "down" | "normal" = "normal";
    if (isAnomaly) {
      direction = z > 0 ? "up" : "down";
    }
    return {
      period: p.period,
      ratio: p.ratio,
      zScore: z,
      isAnomaly,
      direction,
    };
  });
}

/**
 * 이상치만 필터링하여 z-score 절댓값 내림차순으로 정렬한 결과를 반환한다.
 *
 * @param series - 시계열 데이터
 * @param sigmaThreshold - z-score 임계값 (기본 2.0)
 * @returns 이상치만 포함된 배열 (강한 순 정렬)
 *
 * @example
 * ```ts
 * const topAnomalies = getTopAnomalies(data, 2.5);
 * topAnomalies.forEach(a => {
 *   console.log(`${a.period}: ratio=${a.ratio}, z=${a.zScore.toFixed(2)}`);
 * });
 * ```
 */
export function getTopAnomalies(
  series: TrendPoint[],
  sigmaThreshold?: number,
): AnomalyPoint[] {
  return detectStatisticalAnomalies(series, sigmaThreshold)
    .filter((a) => a.isAnomaly)
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

// ─── 내부 STL 분해 (독립 구현, stl-decompose.ts와 import 관계 없음) ───

/**
 * 내부용 STL 분해. stl-decompose.ts와 동일한 로직이지만 독립적으로 구현.
 */
function stlDecomposeInternal(
  series: TrendPoint[],
  trendWindow = 21,
): STLResultInternal {
  const n = series.length;
  const values = series.map((p) => p.ratio);

  // Trend: 중심 이동평균
  const trend = centeredMA(values, trendWindow);

  // Detrended
  const detrended = values.map((v, i) => v - trend[i]);

  // Seasonal: 요일별 평균 편차
  const dowSums = new Array(7).fill(0);
  const dowCounts = new Array(7).fill(0);

  for (let i = 0; i < n; i++) {
    const dow = parseDayOfWeek(series[i].period);
    if (dow >= 0) {
      dowSums[dow] += detrended[i];
      dowCounts[dow] += 1;
    }
  }

  const dowAvg = new Array(7).fill(0);
  for (let d = 0; d < 7; d++) {
    if (dowCounts[d] > 0) dowAvg[d] = dowSums[d] / dowCounts[d];
  }

  // 중심화
  const center = dowAvg.reduce((s, v) => s + v, 0) / 7;
  for (let d = 0; d < 7; d++) dowAvg[d] -= center;

  const seasonal = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const dow = parseDayOfWeek(series[i].period);
    seasonal[i] = dow >= 0 ? dowAvg[dow] : 0;
  }

  // Residual
  const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

  return { trend, seasonal, residual };
}

/** 중심 이동평균 */
function centeredMA(values: number[], window: number): number[] {
  const n = values.length;
  const result = new Array(n);
  const half = Math.floor(window / 2);

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    result[i] = sum / (hi - lo + 1);
  }

  return result;
}

/** YYYY-MM-DD에서 요일 추출 (0=일, 6=토). 실패 시 -1 */
function parseDayOfWeek(period: string): number {
  const m = period.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return -1;
  return new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
  ).getDay();
}

// 수동 테스트용
// const testData: TrendPoint[] = Array.from({ length: 60 }, (_, i) => {
//   const date = new Date(2025, 0, 6 + i);
//   const period = date.toISOString().slice(0, 10);
//   const base = 50 + Math.sin(i / 10) * 10;
//   // i=30 지점에 인위적 이상치 삽입
//   const spike = i === 30 ? 35 : 0;
//   const noise = (Math.random() - 0.5) * 3;
//   return { period, ratio: Math.max(0, Math.min(100, base + spike + noise)) };
// });
// const anomalies = detectStatisticalAnomalies(testData, 2.0);
// const found = anomalies.filter(a => a.isAnomaly);
// console.log(`총 ${testData.length}개 중 이상치 ${found.length}건:`);
// found.forEach(a => console.log(`  ${a.period}: ratio=${a.ratio.toFixed(1)}, z=${a.zScore.toFixed(2)} (${a.direction})`));
