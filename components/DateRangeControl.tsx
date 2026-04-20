"use client";

import { useState } from "react";

export type RangePreset = "1w" | "1m" | "3m" | "1y" | "custom";

export interface DateRange {
  preset: RangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

const PRESETS: Array<{ key: RangePreset; label: string; days: number | null }> = [
  { key: "1w", label: "1주", days: 7 },
  { key: "1m", label: "1개월", days: 30 },
  { key: "3m", label: "3개월", days: 90 },
  { key: "1y", label: "1년", days: 365 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function presetRange(preset: RangePreset, today = new Date()): DateRange {
  if (preset === "custom") {
    return {
      preset,
      startDate: isoDate(new Date(today.getTime() - 30 * 86400000)),
      endDate: isoDate(today),
    };
  }
  const p = PRESETS.find((p) => p.key === preset)!;
  const days = p.days ?? 30;
  return {
    preset,
    startDate: isoDate(new Date(today.getTime() - days * 86400000)),
    endDate: isoDate(today),
  };
}

/** 기간 길이에 따라 자동으로 timeUnit 결정 (DataLab 공식과 일관되게 가능한 한 일간 유지) */
export function autoTimeUnit(range: DateRange): "date" | "week" | "month" {
  const span =
    (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) /
    86400000;
  // 최대 3년까지 일간 유지 → DataLab 원본 그래프 형태 재현 가능
  if (span <= 1100) return "date";
  if (span <= 2200) return "week";
  return "month";
}

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  disabled?: boolean;
}

export function DateRangeControl({ value, onChange, disabled }: Props) {
  const [showCustom, setShowCustom] = useState(value.preset === "custom");

  function selectPreset(p: RangePreset) {
    if (p === "custom") {
      setShowCustom(true);
      onChange({ ...value, preset: "custom" });
      return;
    }
    setShowCustom(false);
    onChange(presetRange(p));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">기간</span>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          disabled={disabled}
          onClick={() => selectPreset(p.key)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            value.preset === p.key
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          } disabled:opacity-50`}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => selectPreset("custom")}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          value.preset === "custom"
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        } disabled:opacity-50`}
      >
        직접 선택
      </button>

      {showCustom && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            disabled={disabled}
            value={value.startDate}
            max={value.endDate}
            onChange={(e) => onChange({ ...value, preset: "custom", startDate: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <span className="text-xs text-slate-400">~</span>
          <input
            type="date"
            disabled={disabled}
            value={value.endDate}
            min={value.startDate}
            max={isoDate(new Date())}
            onChange={(e) => onChange({ ...value, preset: "custom", endDate: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
      )}
    </div>
  );
}
