// 반복 사회 패턴 (Sequential Pattern Mining)
// 2~3년치 주간 DataLab 트렌드에서 매년 반복되는 계절 패턴을 탐지

export interface YearlyPeak {
  year: number;
  month: number;
  weekPeriod: string;
  ratio: number;
}

export interface RecurringPattern {
  months: number[]; // 반복되는 월
  years: number[]; // 해당 패턴이 나타난 연도
  avgIntensity: number;
  consistency: number; // 0-1, 몇 퍼센트의 연도에서 동일 패턴
  seasonLabel: string; // 봄/여름/가을/겨울
}

export interface SequentialResult {
  yearlyPeaks: YearlyPeak[];
  patterns: RecurringPattern[];
  yearSeries: Array<{ year: number; data: Array<{ month: number; avg: number }> }>;
}

function getSeasonLabel(month: number): string {
  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울"; // 12, 1, 2
}

export function analyzeSequentialPatterns(
  trend: Array<{ period: string; ratio: number }>
): SequentialResult {
  if (trend.length === 0) {
    return { yearlyPeaks: [], patterns: [], yearSeries: [] };
  }

  // 1. period(YYYY-MM-DD)를 파싱하여 year, month로 그룹화
  interface DataPoint {
    year: number;
    month: number;
    period: string;
    ratio: number;
  }

  const points: DataPoint[] = trend.map((t) => {
    const parts = t.period.split("-");
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      period: t.period,
      ratio: t.ratio,
    };
  });

  // 2. 연도별 그룹
  const yearMap = new Map<number, DataPoint[]>();
  for (const p of points) {
    if (!yearMap.has(p.year)) yearMap.set(p.year, []);
    yearMap.get(p.year)!.push(p);
  }

  const years = Array.from(yearMap.keys()).sort();

  // 3. 연도별 월 평균 계산
  const yearSeries: SequentialResult["yearSeries"] = [];

  for (const year of years) {
    const pts = yearMap.get(year)!;
    const monthMap = new Map<number, number[]>();
    for (const p of pts) {
      if (!monthMap.has(p.month)) monthMap.set(p.month, []);
      monthMap.get(p.month)!.push(p.ratio);
    }
    const data: Array<{ month: number; avg: number }> = [];
    for (let m = 1; m <= 12; m++) {
      const values = monthMap.get(m);
      if (values && values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        data.push({ month: m, avg: Math.round(avg * 100) / 100 });
      }
    }
    yearSeries.push({ year, data });
  }

  // 4. 연도별 피크 월 찾기 (월 평균이 해당 연도 전체 평균 × 1.3 이상)
  const yearlyPeaks: YearlyPeak[] = [];

  for (const ys of yearSeries) {
    if (ys.data.length === 0) continue;
    const allAvgs = ys.data.map((d) => d.avg);
    const overallMean = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
    const threshold = overallMean * 1.3;

    for (const md of ys.data) {
      if (md.avg >= threshold) {
        // 해당 월에서 가장 높은 주간 데이터 찾기
        const monthPts = yearMap.get(ys.year)!.filter((p) => p.month === md.month);
        const best = monthPts.reduce((a, b) => (a.ratio > b.ratio ? a : b), monthPts[0]);

        yearlyPeaks.push({
          year: ys.year,
          month: md.month,
          weekPeriod: best.period,
          ratio: md.avg,
        });
      }
    }
  }

  // 5. 연도 간 교차 비교 → 반복 패턴 탐지
  // 각 월이 몇 개 연도에서 피크로 나타나는지 카운트
  const monthPeakYears = new Map<number, number[]>();
  for (const peak of yearlyPeaks) {
    if (!monthPeakYears.has(peak.month)) monthPeakYears.set(peak.month, []);
    monthPeakYears.get(peak.month)!.push(peak.year);
  }

  // 2개 연도 이상에서 반복되는 월만 패턴으로
  const recurringMonths: Array<{ month: number; years: number[]; intensities: number[] }> = [];

  for (const [month, peakYears] of monthPeakYears.entries()) {
    if (peakYears.length >= 2) {
      const intensities = yearlyPeaks
        .filter((p) => p.month === month && peakYears.includes(p.year))
        .map((p) => p.ratio);
      recurringMonths.push({ month, years: peakYears.sort(), intensities });
    }
  }

  // 인접 월을 같은 패턴으로 묶기 (예: 7월, 8월 → 여름 패턴)
  const patterns: RecurringPattern[] = [];

  if (recurringMonths.length > 0) {
    // 월 순서대로 정렬
    recurringMonths.sort((a, b) => a.month - b.month);

    let currentGroup = [recurringMonths[0]];

    for (let i = 1; i < recurringMonths.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const curr = recurringMonths[i];
      // 인접 월이고, 겹치는 연도가 있으면 같은 패턴
      const sharedYears = curr.years.filter((y) => prev.years.includes(y));
      if (curr.month - prev.month <= 2 && sharedYears.length >= 2) {
        currentGroup.push(curr);
      } else {
        // 이전 그룹 패턴 생성
        patterns.push(buildPattern(currentGroup, years.length));
        currentGroup = [curr];
      }
    }
    // 마지막 그룹
    patterns.push(buildPattern(currentGroup, years.length));
  }

  return { yearlyPeaks, patterns, yearSeries };
}

function buildPattern(
  group: Array<{ month: number; years: number[]; intensities: number[] }>,
  totalYears: number
): RecurringPattern {
  const months = group.map((g) => g.month);
  const allYears = Array.from(new Set(group.flatMap((g) => g.years))).sort();
  const allIntensities = group.flatMap((g) => g.intensities);
  const avgIntensity =
    allIntensities.length > 0
      ? Math.round((allIntensities.reduce((a, b) => a + b, 0) / allIntensities.length) * 100) / 100
      : 0;

  // consistency = 반복 연도 수 / 전체 연도 수
  const consistency = totalYears > 0 ? Math.round((allYears.length / totalYears) * 100) / 100 : 0;

  // 대표 계절은 가장 많은 월의 계절
  const seasonLabel = getSeasonLabel(months[Math.floor(months.length / 2)]);

  return { months, years: allYears, avgIntensity, consistency, seasonLabel };
}
