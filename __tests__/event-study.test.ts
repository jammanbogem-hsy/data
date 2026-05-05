import { describe, it, expect } from "vitest";
import {
  runEventStudy,
  autoDiscoverEvents,
  analyzeEventImpact,
  type TrendPoint,
  type EventDef,
} from "@/lib/event-study";

// --- 헬퍼 ---
function makeSeries(days: number, startDate = "2025-01-01", base = 40): TrendPoint[] {
  const pts: TrendPoint[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    pts.push({
      period: d.toISOString().slice(0, 10),
      ratio: base + Math.sin(i * 0.2) * 10,
    });
  }
  return pts;
}

function makeSeriesWithBump(
  days: number,
  startDate: string,
  bumpCenter: number,
  bumpHeight: number,
): TrendPoint[] {
  const pts = makeSeries(days, startDate, 30);
  // bumpCenter 부근에 급등 삽입
  for (let i = Math.max(0, bumpCenter - 2); i <= Math.min(days - 1, bumpCenter + 2); i++) {
    pts[i] = { ...pts[i], ratio: bumpHeight };
  }
  return pts;
}

describe("runEventStudy", () => {
  it("빈 배열 → 빈 배열", () => {
    expect(runEventStudy([])).toEqual([]);
  });

  it("30일 데이터 + 이벤트 없음 → 크래시 없음", () => {
    const series = makeSeries(30);
    const result = runEventStudy(series, []);
    expect(Array.isArray(result)).toBe(true);
  });

  it("이벤트 포함 데이터 → 결과에 lift 존재", () => {
    // 추석 부근에 급등이 있는 시계열 (2025-10-01 ~ 2025-10-30)
    const series = makeSeriesWithBump(30, "2025-10-01", 5, 90);
    const events: EventDef[] = [{ name: "추석", date: "2025-10-06" }];
    const result = runEventStudy(series, events);
    // 급등이 충분히 크면 결과에 포함
    for (const impact of result) {
      expect(typeof impact.lift).toBe("number");
      expect(Number.isFinite(impact.lift)).toBe(true);
    }
  });
});

describe("autoDiscoverEvents", () => {
  it("30일 데이터 → 크래시 없음", () => {
    const series = makeSeries(30);
    const result = autoDiscoverEvents(series);
    expect(Array.isArray(result)).toBe(true);
    for (const ev of result) {
      expect(ev.name).toBeTruthy();
      expect(ev.date).toBeTruthy();
    }
  });

  it("추석 포함 기간 → 추석 이벤트 발굴", () => {
    // 2025-10-01 ~ 2025-10-30 (추석 10/6 포함)
    const series = makeSeries(30, "2025-10-01");
    const result = autoDiscoverEvents(series);
    const names = result.map((e) => e.name);
    expect(names).toContain("추석");
  });

  it("빈 시계열 → 빈 배열", () => {
    expect(autoDiscoverEvents([])).toEqual([]);
  });
});

describe("analyzeEventImpact", () => {
  it("30일 데이터 + 이벤트 → lift 값 존재", () => {
    const series = makeSeriesWithBump(30, "2025-10-01", 15, 85);
    const event: EventDef = { name: "테스트이벤트", date: "2025-10-16" };
    const result = analyzeEventImpact(series, event);

    expect(result).not.toBeNull();
    expect(typeof result!.lift).toBe("number");
    expect(Number.isFinite(result!.lift)).toBe(true);
    expect(typeof result!.rebound).toBe("number");
    expect(result!.sampleSize).toBeGreaterThan(0);
    expect(["high", "medium", "low", "insufficient"]).toContain(result!.confidence);
  });

  it("빈 시계열 → null", () => {
    const event: EventDef = { name: "추석", date: "2025-10-06" };
    const result = analyzeEventImpact([], event);
    expect(result).toBeNull();
  });

  it("시계열이 너무 짧으면 → null (before 구간 부족)", () => {
    const series = makeSeries(3, "2025-10-05");
    const event: EventDef = { name: "추석", date: "2025-10-06" };
    const result = analyzeEventImpact(series, event);
    expect(result).toBeNull();
  });
});
