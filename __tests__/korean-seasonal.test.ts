import { describe, it, expect } from "vitest";
import { detectSeasonal, koreanWeekday } from "@/lib/korean-seasonal";

describe("detectSeasonal", () => {
  it("2025-10-06 → 추석 포함", () => {
    const result = detectSeasonal("2025-10-06");
    expect(result).toContain("추석");
  });

  it("2025-07-20 → 초복 포함", () => {
    const result = detectSeasonal("2025-07-20");
    expect(result).toContain("초복");
  });

  it("2025-11-13 → 수능 포함", () => {
    const result = detectSeasonal("2025-11-13");
    expect(result).toContain("수능");
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(detectSeasonal("")).toEqual([]);
  });

  it("잘못된 형식 → 빈 배열", () => {
    expect(detectSeasonal("not-a-date")).toEqual([]);
  });

  it("크리스마스(2025-12-25) → 크리스마스 포함", () => {
    const result = detectSeasonal("2025-12-25");
    expect(result).toContain("크리스마스");
  });

  it("설날(2025-01-29) → 설날 포함", () => {
    const result = detectSeasonal("2025-01-29");
    expect(result).toContain("설날");
  });

  it("최대 4개까지만 반환", () => {
    const result = detectSeasonal("2025-10-06");
    expect(result.length).toBeLessThanOrEqual(4);
  });
});

describe("koreanWeekday", () => {
  it("2025-10-06 → 월", () => {
    expect(koreanWeekday("2025-10-06")).toBe("월");
  });

  it("2025-10-05 → 일", () => {
    expect(koreanWeekday("2025-10-05")).toBe("일");
  });

  it("2025-10-11 → 토", () => {
    expect(koreanWeekday("2025-10-11")).toBe("토");
  });
});
