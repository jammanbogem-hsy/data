import { describe, it, expect } from "vitest";
import {
  detectSpikes,
  detectNaturalPeak,
  detectCommonSpikes,
  type TrendPoint,
  type SpikeRange,
} from "@/lib/spike";

// --- 헬퍼 ---
function makeSeries(days: number, base = 30): TrendPoint[] {
  const pts: TrendPoint[] = [];
  const start = new Date("2025-01-01");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    pts.push({
      period: d.toISOString().slice(0, 10),
      ratio: base + Math.sin(i * 0.3) * 5,
    });
  }
  return pts;
}

function makeSeriesWithSpike(days: number, spikeAt: number, spikeValue: number): TrendPoint[] {
  const pts = makeSeries(days, 30);
  if (spikeAt < pts.length) {
    pts[spikeAt] = { ...pts[spikeAt], ratio: spikeValue };
  }
  return pts;
}

describe("detectSpikes", () => {
  it("빈 배열 → 빈 배열", () => {
    expect(detectSpikes([])).toEqual([]);
  });

  it("8일 미만 데이터 → 빈 배열 (데이터 부족)", () => {
    const short = makeSeries(5);
    expect(detectSpikes(short)).toEqual([]);
  });

  it("8일 이상 데이터 → 크래시 없음", () => {
    const series = makeSeries(20);
    const result = detectSpikes(series);
    expect(Array.isArray(result)).toBe(true);
    // 결과가 있으면 구조 검증
    for (const spike of result) {
      expect(typeof spike.startIdx).toBe("number");
      expect(typeof spike.endIdx).toBe("number");
      expect(typeof spike.peakPeriod).toBe("string");
      expect(spike.multiplier).toBeGreaterThan(0);
    }
  });

  it("급등 데이터 → 스파이크 감지", () => {
    // 15일째에 큰 급등 삽입
    const series = makeSeriesWithSpike(30, 15, 95);
    const result = detectSpikes(series, { multiplierThreshold: 1.5, minAbs: 20 });
    expect(result.length).toBeGreaterThanOrEqual(1);
    // 가장 강한 스파이크의 peakRatio가 95여야 함
    expect(result[0].peakRatio).toBe(95);
  });
});

describe("detectNaturalPeak", () => {
  it("피크가 있는 데이터 → peakPeriod 반환", () => {
    // 벨커브 형태: 가운데가 높은 시계열
    const pts: TrendPoint[] = [];
    const start = new Date("2025-01-01");
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      // 가운데(15일)에 피크가 오는 벨커브
      const ratio = 20 + 60 * Math.exp(-((i - 15) ** 2) / 20);
      pts.push({ period: d.toISOString().slice(0, 10), ratio });
    }

    const result = detectNaturalPeak(pts);
    expect(result).not.toBeNull();
    expect(result!.peakPeriod).toBeTruthy();
    expect(result!.peakRatio).toBeGreaterThan(50);
    expect(result!.multiplier).toBeGreaterThan(1);
  });

  it("8일 미만 데이터 → null", () => {
    expect(detectNaturalPeak(makeSeries(5))).toBeNull();
  });
});

describe("detectCommonSpikes", () => {
  it("빈 입력 → 빈 배열", () => {
    expect(detectCommonSpikes([])).toEqual([]);
  });

  it("단일 키워드만 → 빈 배열 (공통 급등 없음)", () => {
    const spike: SpikeRange = {
      startIdx: 10,
      endIdx: 12,
      startPeriod: "2025-01-11",
      endPeriod: "2025-01-13",
      peakIdx: 11,
      peakPeriod: "2025-01-12",
      peakRatio: 90,
      baselineAvg: 30,
      multiplier: 3.0,
    };
    const result = detectCommonSpikes([{ keyword: "A", spikes: [spike] }]);
    expect(result).toEqual([]);
  });

  it("두 키워드가 같은 시기에 급등 → 클러스터 반환", () => {
    const spikeA: SpikeRange = {
      startIdx: 10, endIdx: 12, startPeriod: "2025-01-11", endPeriod: "2025-01-13",
      peakIdx: 11, peakPeriod: "2025-01-12", peakRatio: 90, baselineAvg: 30, multiplier: 3.0,
    };
    const spikeB: SpikeRange = {
      startIdx: 10, endIdx: 13, startPeriod: "2025-01-11", endPeriod: "2025-01-14",
      peakIdx: 12, peakPeriod: "2025-01-13", peakRatio: 85, baselineAvg: 28, multiplier: 3.0,
    };
    const result = detectCommonSpikes([
      { keyword: "냉면", spikes: [spikeA] },
      { keyword: "물냉면", spikes: [spikeB] },
    ]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].uniqueKeywords).toContain("냉면");
    expect(result[0].uniqueKeywords).toContain("물냉면");
  });
});
