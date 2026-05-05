// STL 분해 (Seasonal-Trend decomposition using Loess — 간이 버전)
//
// 시계열 데이터를 Trend + Seasonal(주간) + Residual 세 성분으로 분해한다.
// "추측이 아닌 데이터 속에서 의미를 얻는 것" — 숫자 패턴 자체가 말하는 것.
//
// 알고리즘:
//   1. Trend: 이동평균(MA)으로 장기 추세 추출 (기본 윈도우 21일)
//   2. Detrended: original - trend
//   3. Seasonal: 요일별(0-6) 평균 편차를 계산, 전체 길이에 반복 적용
//   4. Residual: original - trend - seasonal
//
// 외부 패키지 없이 순수 TypeScript 구현.

export interface TrendPoint {
  period: string;  // YYYY-MM-DD or YYYY-WW or YYYY-MM
  ratio: number;   // 0-100 (네이버 데이터랩 상대치)
}

export interface STLResult {
  /** 장기 추세 성분 (이동평균) */
  trend: number[];
  /** 주간 계절성 성분 (요일별 반복 패턴) */
  seasonal: number[];
  /** 잔차 성분 (original - trend - seasonal) */
  residual: number[];
}

/**
 * 시계열을 Trend + Seasonal(주간) + Residual로 분해한다.
 *
 * @param series - 날짜순 정렬된 시계열 데이터 (TrendPoint[])
 * @param trendWindow - 이동평균 윈도우 크기 (기본 21, 홀수 권장)
 * @returns STLResult — trend, seasonal, residual 각 성분 배열
 *
 * @example
 * ```ts
 * const data: TrendPoint[] = [
 *   { period: "2025-01-06", ratio: 45 },
 *   { period: "2025-01-07", ratio: 50 },
 *   // ... 최소 수 주 분량
 * ];
 * const result = stlDecompose(data, 21);
 * console.log(result.trend);     // 장기 추세
 * console.log(result.seasonal);  // 요일 패턴
 * console.log(result.residual);  // 이상치 후보
 * ```
 */
export function stlDecompose(
  series: TrendPoint[],
  trendWindow?: number,
): STLResult {
  const n = series.length;
  const values = series.map((p) => p.ratio);
  const window = trendWindow ?? 21;

  // --- 1단계: Trend (이동평균) ---
  const trend = movingAverage(values, window);

  // --- 2단계: Detrended ---
  const detrended = values.map((v, i) => v - trend[i]);

  // --- 3단계: Seasonal (요일별 평균 편차) ---
  // 각 데이터 포인트의 요일을 추출하여 요일별 평균 편차 계산
  const dayOfWeekSums: number[] = new Array(7).fill(0);
  const dayOfWeekCounts: number[] = new Array(7).fill(0);

  for (let i = 0; i < n; i++) {
    const dow = getDayOfWeek(series[i].period);
    if (dow >= 0) {
      dayOfWeekSums[dow] += detrended[i];
      dayOfWeekCounts[dow] += 1;
    }
  }

  // 요일별 평균 계산
  const dayOfWeekAvg: number[] = new Array(7).fill(0);
  for (let d = 0; d < 7; d++) {
    if (dayOfWeekCounts[d] > 0) {
      dayOfWeekAvg[d] = dayOfWeekSums[d] / dayOfWeekCounts[d];
    }
  }

  // 평균이 0이 되도록 중심화 (계절 성분 합 = 0)
  const avgOfAvgs = dayOfWeekAvg.reduce((s, v) => s + v, 0) / 7;
  for (let d = 0; d < 7; d++) {
    dayOfWeekAvg[d] -= avgOfAvgs;
  }

  // 전체 길이에 요일 패턴 매핑
  const seasonal: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const dow = getDayOfWeek(series[i].period);
    seasonal[i] = dow >= 0 ? dayOfWeekAvg[dow] : 0;
  }

  // --- 4단계: Residual ---
  const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

  return { trend, seasonal, residual };
}

/**
 * 중심 이동평균(centered moving average)을 계산한다.
 * 양 끝에서는 가용한 범위만큼 축소된 윈도우를 사용한다.
 *
 * @param values - 숫자 배열
 * @param window - 이동평균 윈도우 크기
 * @returns 동일 길이의 이동평균 배열
 */
function movingAverage(values: number[], window: number): number[] {
  const n = values.length;
  const result: number[] = new Array(n);
  const half = Math.floor(window / 2);

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) {
      sum += values[j];
    }
    result[i] = sum / (hi - lo + 1);
  }

  return result;
}

/**
 * period 문자열에서 요일(0=일, 1=월, ..., 6=토)을 추출한다.
 * YYYY-MM-DD 형식이 아닌 경우 -1을 반환.
 */
function getDayOfWeek(period: string): number {
  const match = period.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return -1;
  const d = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
  return d.getDay();
}

// 수동 테스트용
// const testSeries: TrendPoint[] = Array.from({ length: 56 }, (_, i) => {
//   const date = new Date(2025, 0, 6 + i); // 2025-01-06(월)부터 8주
//   const period = date.toISOString().slice(0, 10);
//   const trend = 50 + i * 0.3;            // 완만한 상승 추세
//   const seasonal = [0, 5, 3, -2, -1, -3, -2][date.getDay()]; // 월·화 높고 금·토 낮음
//   const noise = (Math.random() - 0.5) * 4;
//   return { period, ratio: Math.max(0, Math.min(100, trend + seasonal + noise)) };
// });
// const result = stlDecompose(testSeries);
// console.log("Trend (처음 7개):", result.trend.slice(0, 7).map(v => v.toFixed(1)));
// console.log("Seasonal (처음 7개):", result.seasonal.slice(0, 7).map(v => v.toFixed(2)));
// console.log("Residual 평균:", (result.residual.reduce((s, v) => s + v, 0) / result.residual.length).toFixed(3));
