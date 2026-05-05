// 상관 분석 유틸리티 (Correlation Analysis)
//
// 다중 키워드 시계열 간 상관관계를 수학적으로 검증한다.
// "추측이 아닌 데이터 속에서 의미를 얻는 것" — 숫자 패턴 자체가 말하는 것.
//
// 포함 함수:
//   1. pearsonCorrelation: Pearson r + t-test p-value
//   2. correlationMatrix: 다중 키워드 전 쌍 상관 행렬
//   3. crossCorrelation: lag별 상관 → 선행/후행 관계 수학적 검증
//
// 외부 패키지 없이 순수 TypeScript 구현.

export interface CorrelationResult {
  /** Pearson 상관계수 (-1 ~ 1) */
  r: number;
  /** t-test 기반 p-value (양측 검정, 자유도 n-2) */
  pValue: number;
  /** 통계적 유의성 여부 (p < 0.05) */
  significant: boolean;
  /** 사람이 읽을 수 있는 해석 */
  interpretation: string;
}

/**
 * 두 시계열의 Pearson 상관계수와 통계적 유의성을 계산한다.
 *
 * @param seriesA - 첫 번째 숫자 배열
 * @param seriesB - 두 번째 숫자 배열 (seriesA와 동일 길이)
 * @returns CorrelationResult — r, p-value, 유의성, 해석
 * @throws 두 배열의 길이가 다르거나 3개 미만일 때 에러
 *
 * @example
 * ```ts
 * const a = [10, 20, 30, 40, 50, 60, 70];
 * const b = [12, 22, 28, 42, 48, 62, 68];
 * const result = pearsonCorrelation(a, b);
 * console.log(`r = ${result.r.toFixed(4)}`);           // r ≈ 0.9990
 * console.log(`p = ${result.pValue.toExponential(2)}`); // p ≈ 매우 작음
 * console.log(result.interpretation);                    // "매우 강한 양의 상관관계"
 * ```
 */
export function pearsonCorrelation(
  seriesA: number[],
  seriesB: number[],
): CorrelationResult {
  const n = seriesA.length;

  if (n !== seriesB.length) {
    throw new Error(
      `두 시계열의 길이가 다릅니다: ${n} vs ${seriesB.length}`,
    );
  }
  if (n < 3) {
    throw new Error(
      `상관 분석에 최소 3개 이상의 데이터가 필요합니다 (현재: ${n})`,
    );
  }

  // 평균
  const meanA = seriesA.reduce((s, v) => s + v, 0) / n;
  const meanB = seriesB.reduce((s, v) => s + v, 0) / n;

  // 공분산 및 표준편차 계산
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;

  for (let i = 0; i < n; i++) {
    const dA = seriesA[i] - meanA;
    const dB = seriesB[i] - meanB;
    sumAB += dA * dB;
    sumA2 += dA * dA;
    sumB2 += dB * dB;
  }

  const denominator = Math.sqrt(sumA2 * sumB2);

  // 분산이 0인 경우 (상수 시계열)
  if (denominator === 0) {
    return {
      r: 0,
      pValue: 1,
      significant: false,
      interpretation: "분산이 0인 시계열이 포함되어 상관 분석 불가",
    };
  }

  const r = sumAB / denominator;

  // t-test: t = r * sqrt(n-2) / sqrt(1-r^2), 자유도 = n-2
  const df = n - 2;
  const rSquared = r * r;
  let pValue: number;

  if (rSquared >= 1) {
    // 완전 상관 (수치 오차 포함)
    pValue = 0;
  } else {
    const t = r * Math.sqrt(df / (1 - rSquared));
    pValue = tTestTwoTailed(Math.abs(t), df);
  }

  const significant = pValue < 0.05;
  const interpretation = interpretCorrelation(r, pValue);

  return { r, pValue, significant, interpretation };
}

/**
 * 다중 키워드 시계열의 전 쌍(pair-wise) 상관 행렬을 계산한다.
 *
 * @param series - 키워드 이름을 key, 숫자 배열을 value로 가진 객체
 * @returns 중첩 Record — series[keyA][keyB] = CorrelationResult
 *
 * @example
 * ```ts
 * const data = {
 *   "삼겹살": [50, 55, 60, 48, 52, 58, 62],
 *   "소주":   [45, 50, 55, 44, 48, 54, 58],
 *   "맥주":   [30, 35, 70, 32, 68, 72, 40],
 * };
 * const matrix = correlationMatrix(data);
 * console.log(`삼겹살↔소주: r=${matrix["삼겹살"]["소주"].r.toFixed(3)}`);
 * // 모든 쌍을 순회
 * for (const [a, row] of Object.entries(matrix)) {
 *   for (const [b, result] of Object.entries(row)) {
 *     if (a < b) console.log(`${a}↔${b}: r=${result.r.toFixed(3)}, p=${result.pValue.toFixed(4)}`);
 *   }
 * }
 * ```
 */
export function correlationMatrix(
  series: Record<string, number[]>,
): Record<string, Record<string, CorrelationResult>> {
  const keys = Object.keys(series);
  const result: Record<string, Record<string, CorrelationResult>> = {};

  for (const a of keys) {
    result[a] = {};
    for (const b of keys) {
      if (a === b) {
        // 자기 자신과의 상관 = 완전 상관
        result[a][b] = {
          r: 1,
          pValue: 0,
          significant: true,
          interpretation: "자기 자신과의 상관 (r=1)",
        };
      } else {
        result[a][b] = pearsonCorrelation(series[a], series[b]);
      }
    }
  }

  return result;
}

/**
 * 두 시계열 간 교차상관(Cross-Correlation)을 lag별로 계산한다.
 *
 * lag > 0: seriesA가 seriesB에 선행 (A가 B보다 먼저 움직임)
 * lag < 0: seriesB가 seriesA에 선행 (B가 A보다 먼저 움직임)
 * lag = 0: 동시점 상관
 *
 * @param seriesA - 첫 번째 숫자 배열
 * @param seriesB - 두 번째 숫자 배열 (동일 길이)
 * @param maxLag - 최대 lag 범위 (기본 7, -maxLag ~ +maxLag)
 * @returns lag별 상관계수 배열 (lag 오름차순)
 *
 * @example
 * ```ts
 * // A가 B보다 3일 선행하는 패턴
 * const a = [10, 20, 80, 20, 10, 10, 10, 10, 10, 10];
 * const b = [10, 10, 10, 10, 20, 80, 20, 10, 10, 10];
 * // ↑ a의 피크가 b보다 2~3일 빠름
 *
 * const cc = crossCorrelation(a, b, 5);
 * // lag=3 근처에서 r이 최대 → A가 B에 3일 선행
 * const best = cc.reduce((max, c) => c.r > max.r ? c : max);
 * console.log(`최대 상관 lag=${best.lag}, r=${best.r.toFixed(3)}`);
 * ```
 */
export function crossCorrelation(
  seriesA: number[],
  seriesB: number[],
  maxLag?: number,
): Array<{ lag: number; r: number }> {
  const n = seriesA.length;

  if (n !== seriesB.length) {
    throw new Error(
      `두 시계열의 길이가 다릅니다: ${n} vs ${seriesB.length}`,
    );
  }

  const lag = maxLag ?? 7;
  const results: Array<{ lag: number; r: number }> = [];

  for (let k = -lag; k <= lag; k++) {
    // lag k: A[i] vs B[i+k] (겹치는 구간만)
    const aSlice: number[] = [];
    const bSlice: number[] = [];

    for (let i = 0; i < n; i++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        aSlice.push(seriesA[i]);
        bSlice.push(seriesB[j]);
      }
    }

    if (aSlice.length < 3) {
      results.push({ lag: k, r: 0 });
      continue;
    }

    // 간이 Pearson r (p-value 없이 r만)
    const meanA = aSlice.reduce((s, v) => s + v, 0) / aSlice.length;
    const meanB = bSlice.reduce((s, v) => s + v, 0) / bSlice.length;

    let sumAB = 0;
    let sumA2 = 0;
    let sumB2 = 0;

    for (let i = 0; i < aSlice.length; i++) {
      const dA = aSlice[i] - meanA;
      const dB = bSlice[i] - meanB;
      sumAB += dA * dB;
      sumA2 += dA * dA;
      sumB2 += dB * dB;
    }

    const denom = Math.sqrt(sumA2 * sumB2);
    const r = denom > 0 ? sumAB / denom : 0;

    results.push({ lag: k, r });
  }

  return results;
}

// ─── 내부 유틸 ───

/**
 * t-분포의 양측 p-value 근사 계산.
 * Abramowitz & Stegun의 정규분포 근사 + 자유도 보정 사용.
 * 정확한 불완전 베타 함수 대신 실용적 근사를 사용한다.
 */
function tTestTwoTailed(tAbs: number, df: number): number {
  // df가 충분히 크면(>30) 정규분포 근사 사용
  // 그렇지 않으면 df 보정된 근사 사용

  if (df <= 0) return 1;

  // t → z 변환 (Fisher의 근사)
  // z ≈ t * (1 - 1/(4*df)) / sqrt(1 + t^2/(2*df))
  const z =
    tAbs * (1 - 1 / (4 * df)) / Math.sqrt(1 + (tAbs * tAbs) / (2 * df));

  // 정규분포 CDF 근사 (Abramowitz & Stegun 26.2.17)
  const p2 = 2 * normalCDFComplement(z);

  return Math.max(0, Math.min(1, p2));
}

/**
 * 표준 정규분포의 상보 CDF: P(Z > z)
 * Abramowitz & Stegun 26.2.17 근사 (오차 < 7.5e-8)
 */
function normalCDFComplement(z: number): number {
  if (z < 0) return 1 - normalCDFComplement(-z);

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;

  const t = 1 / (1 + p * z);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

  return phi * (b1 * t + b2 * t2 + b3 * t3 + b4 * t4 + b5 * t5);
}

/**
 * 상관계수를 사람이 이해할 수 있는 한국어로 해석한다.
 */
function interpretCorrelation(r: number, pValue: number): string {
  const absR = Math.abs(r);
  const sign = r >= 0 ? "양의" : "음의";

  let strength: string;
  if (absR >= 0.9) strength = "매우 강한";
  else if (absR >= 0.7) strength = "강한";
  else if (absR >= 0.5) strength = "보통 수준의";
  else if (absR >= 0.3) strength = "약한";
  else strength = "거의 없는";

  const sigText = pValue < 0.01
    ? "통계적으로 매우 유의함 (p<0.01)"
    : pValue < 0.05
      ? "통계적으로 유의함 (p<0.05)"
      : "통계적으로 유의하지 않음 (p>=0.05)";

  if (absR < 0.1) {
    return `상관관계 거의 없음 (r=${r.toFixed(3)}). ${sigText}`;
  }

  return `${strength} ${sign} 상관관계 (r=${r.toFixed(3)}). ${sigText}`;
}

// 수동 테스트용
// // 1. pearsonCorrelation 테스트 — 강한 양의 상관
// const a1 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// const b1 = [12, 18, 33, 38, 52, 57, 73, 78, 88, 102];
// const r1 = pearsonCorrelation(a1, b1);
// console.log("Pearson:", r1);
//
// // 2. correlationMatrix 테스트
// const matrix = correlationMatrix({
//   "삼겹살": [50, 55, 60, 48, 52, 58, 62, 65, 70, 55],
//   "소주":   [45, 50, 55, 44, 48, 54, 58, 60, 65, 50],
//   "맥주":   [30, 35, 70, 32, 68, 72, 40, 38, 75, 45],
// });
// Object.entries(matrix).forEach(([a, row]) => {
//   Object.entries(row).forEach(([b, res]) => {
//     if (a < b) console.log(`${a}↔${b}: r=${res.r.toFixed(3)}, p=${res.pValue.toFixed(4)}, ${res.interpretation}`);
//   });
// });
//
// // 3. crossCorrelation 테스트 — A가 B보다 3일 선행
// const ccA = [10, 10, 80, 10, 10, 10, 10, 10, 10, 10];
// const ccB = [10, 10, 10, 10, 10, 80, 10, 10, 10, 10];
// const cc = crossCorrelation(ccA, ccB, 5);
// const best = cc.reduce((max, c) => c.r > max.r ? c : max);
// console.log(`Cross-correlation 최대: lag=${best.lag}, r=${best.r.toFixed(3)}`);
// console.log("전체:", cc.map(c => `lag=${c.lag}: ${c.r.toFixed(3)}`).join(", "));
