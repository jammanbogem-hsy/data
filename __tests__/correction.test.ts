import { describe, it, expect } from "vitest";
import {
  correctTimeSeries,
  computeSummaryMetrics,
  type TrendPoint,
} from "@/lib/correction";

// --- 헬퍼: N일짜리 더미 시계열 생성 ---
function makeSeries(days: number, base = 50): TrendPoint[] {
  const pts: TrendPoint[] = [];
  const start = new Date("2025-01-01");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const period = d.toISOString().slice(0, 10);
    // 약간의 변동을 주되 안정적인 값
    pts.push({ period, ratio: base + Math.sin(i) * 10 });
  }
  return pts;
}

describe("correctTimeSeries", () => {
  it("빈 배열 → 빈 배열 반환, 크래시 없음", () => {
    const result = correctTimeSeries([]);
    expect(result).toEqual([]);
  });

  it("7일 미만 데이터 → 원본 그대로 반환 (corrected === ratio)", () => {
    const input = makeSeries(5);
    const result = correctTimeSeries(input);

    expect(result).toHaveLength(5);
    for (const p of result) {
      expect(p.corrected).toBe(p.ratio);
      expect(p.ma7).toBe(p.ratio);
      expect(typeof p.weekday).toBe("number");
    }
  });

  it("정상 30일 데이터 → corrected 값이 존재하고 NaN 없음", () => {
    const input = makeSeries(30);
    const result = correctTimeSeries(input);

    expect(result).toHaveLength(30);
    for (const p of result) {
      expect(Number.isFinite(p.corrected)).toBe(true);
      expect(Number.isFinite(p.ma7)).toBe(true);
      expect(Number.isNaN(p.corrected)).toBe(false);
      expect(Number.isNaN(p.ma7)).toBe(false);
    }
  });
});

describe("computeSummaryMetrics", () => {
  it("빈 입력 → 크래시 없음", () => {
    const result = computeSummaryMetrics([], 0, 0, 0);
    expect(result).toBeDefined();
    expect(typeof result.peakDate).toBe("string");
    expect(typeof result.recentChangePercent).toBe("number");
    expect(typeof result.dominantSource).toBe("string");
  });

  it("정상 데이터 → 유의미한 메트릭 반환", () => {
    const series = makeSeries(30);
    const corrected = correctTimeSeries(series);
    const result = computeSummaryMetrics(corrected, 100, 50, 30);

    expect(result.peakDate).toBeTruthy();
    expect(result.peakRatio).toBeGreaterThan(0);
    expect(result.dominantSource).toBe("네이버 뉴스");
    expect(result.dominantSourceCount).toBe(100);
    expect(Number.isFinite(result.recentChangePercent)).toBe(true);
    expect(Number.isFinite(result.avgRatio)).toBe(true);
    expect(Number.isFinite(result.recentCorrectedAvg)).toBe(true);
    expect(typeof result.peakWeekday).toBe("string");
  });
});
