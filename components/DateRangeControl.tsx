"use client";

import { useState } from "react";

export type RangePreset = "1w" | "1m" | "3m" | "6m" | "1y" | "year" | "custom";

export interface DateRange {
  preset: RangePreset;
  startDate: string;
  endDate: string;
}

export interface AdvancedOptions {
  gender: "" | "m" | "f";
  ages: string[]; // "1"~"11"
  device: "" | "pc" | "mo";
  compareGender: boolean; // 남녀 비교 모드
}

const PRESETS: Array<{ key: RangePreset; label: string; days?: number }> = [
  { key: "1w", label: "1주", days: 7 },
  { key: "1m", label: "1개월", days: 30 },
  { key: "3m", label: "3개월", days: 90 },
  { key: "6m", label: "6개월", days: 180 },
  { key: "1y", label: "1년", days: 365 },
];

const YEAR_OPTIONS = (() => {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now; y >= 2016; y--) years.push(y);
  return years;
})();

const AGE_LABELS: Record<string, string> = {
  "1": "0-12세", "2": "13-18세", "3": "19-24세", "4": "25-29세",
  "5": "30-34세", "6": "35-39세", "7": "40-44세", "8": "45-49세",
  "9": "50-54세", "10": "55-59세", "11": "60세+",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function presetRange(preset: RangePreset, today = new Date()): DateRange {
  if (preset === "custom" || preset === "year") {
    return { preset, startDate: isoDate(new Date(today.getTime() - 90 * 86400000)), endDate: isoDate(today) };
  }
  const p = PRESETS.find((p) => p.key === preset)!;
  return { preset, startDate: isoDate(new Date(today.getTime() - (p.days ?? 90) * 86400000)), endDate: isoDate(today) };
}

export function autoTimeUnit(range: DateRange): "date" | "week" | "month" {
  const span = (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86400000;
  if (span <= 1100) return "date";
  if (span <= 2200) return "week";
  return "month";
}

export const DEFAULT_ADVANCED: AdvancedOptions = {
  gender: "", ages: [], device: "", compareGender: false,
};

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  disabled?: boolean;
  advanced?: AdvancedOptions;
  onAdvancedChange?: (next: AdvancedOptions) => void;
}

export function DateRangeControl({ value, onChange, disabled, advanced, onAdvancedChange }: Props) {
  const [showCustom, setShowCustom] = useState(value.preset === "custom");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const adv = advanced ?? DEFAULT_ADVANCED;

  function selectPreset(p: RangePreset) {
    if (p === "custom") { setShowCustom(true); onChange({ ...value, preset: "custom" }); return; }
    setShowCustom(false);
    onChange(presetRange(p));
  }

  function selectYear(year: number) {
    setShowCustom(false);
    onChange({ preset: "year", startDate: `${year}-01-01`, endDate: `${year}-12-31` });
  }

  function setAdv(patch: Partial<AdvancedOptions>) {
    onAdvancedChange?.({ ...adv, ...patch });
  }

  function toggleAge(a: string) {
    const next = adv.ages.includes(a) ? adv.ages.filter((x) => x !== a) : [...adv.ages, a];
    setAdv({ ages: next });
  }

  return (
    <div className="space-y-2">
      {/* 기간 선택 — 모바일에서 줄바꿈 허용 */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="분석 기간 선택">
        <span className="m3-body-sm font-medium" style={{ color: "var(--md-on-surface-variant)" }}>기간</span>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" disabled={disabled} onClick={() => selectPreset(p.key)}
            className="h-8 rounded-m3-md px-3 text-xs font-medium transition"
            style={{
              background: value.preset === p.key ? "var(--md-primary)" : "var(--md-surface-container-high)",
              color: value.preset === p.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
            }}>
            {p.label}
          </button>
        ))}

        {/* 연도 드롭다운 */}
        <select
          disabled={disabled}
          value={value.preset === "year" ? value.startDate.slice(0, 4) : ""}
          onChange={(e) => { if (e.target.value) selectYear(Number(e.target.value)); }}
          className="h-8 rounded-m3-md border px-2 text-xs font-medium"
          style={{ borderColor: "var(--md-outline)", background: value.preset === "year" ? "var(--md-primary)" : "var(--md-surface-container)", color: value.preset === "year" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}
        >
          <option value="">연도별</option>
          {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>

        <button type="button" disabled={disabled} onClick={() => selectPreset("custom")}
          className="h-8 rounded-m3-md px-3 text-xs font-medium transition"
          style={{ background: value.preset === "custom" ? "var(--md-primary)" : "var(--md-surface-container-high)", color: value.preset === "custom" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>
          직접 선택
        </button>

        {showCustom && (
          <div className="flex items-center gap-1.5">
            <input type="date" disabled={disabled} value={value.startDate} max={value.endDate}
              onChange={(e) => onChange({ ...value, preset: "custom", startDate: e.target.value })}
              className="h-8 rounded-m3-sm border px-2 text-xs" style={{ borderColor: "var(--md-outline)", background: "var(--md-surface-container)" }} />
            <span className="m3-body-sm">~</span>
            <input type="date" disabled={disabled} value={value.endDate} min={value.startDate} max={isoDate(new Date())}
              onChange={(e) => onChange({ ...value, preset: "custom", endDate: e.target.value })}
              className="h-8 rounded-m3-sm border px-2 text-xs" style={{ borderColor: "var(--md-outline)", background: "var(--md-surface-container)" }} />
          </div>
        )}

        {/* 고급 옵션 토글 */}
        {onAdvancedChange && (
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="h-8 rounded-m3-md border px-3 text-xs font-medium transition flex items-center gap-1"
            style={{ borderColor: showAdvanced ? "var(--md-primary)" : "var(--md-outline)", color: showAdvanced ? "var(--md-primary)" : "var(--md-on-surface-variant)" }}>
            <span className="m3-icon-sm" style={{ fontSize: 14 }}>tune</span>
            고급
          </button>
        )}
      </div>

      {/* 고급 옵션 패널 — 모바일에서 풀폭 */}
      {showAdvanced && onAdvancedChange && (
        <div className="m3-card-outlined flex flex-wrap gap-4 max-md:w-full max-md:flex-col" style={{ borderRadius: "var(--md-radius-md)" }}>
          {/* 성별 */}
          <div className="space-y-1">
            <div className="m3-label-sm">성별</div>
            <div className="flex gap-1">
              {([["", "전체"], ["m", "남성"], ["f", "여성"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setAdv({ gender: v })}
                  className="h-7 rounded-m3-sm px-2.5 text-xs font-medium"
                  style={{ background: adv.gender === v ? "var(--md-primary)" : "var(--md-surface-container-high)", color: adv.gender === v ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>
                  {l}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 m3-body-sm cursor-pointer mt-1">
              <input type="checkbox" checked={adv.compareGender} onChange={(e) => setAdv({ compareGender: e.target.checked })} className="h-3.5 w-3.5 accent-current" style={{ accentColor: "var(--md-primary)" }} />
              남녀 비교 차트
            </label>
          </div>

          {/* 연령 */}
          <div className="space-y-1">
            <div className="m3-label-sm">연령대</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(AGE_LABELS).map(([k, l]) => (
                <button key={k} type="button" onClick={() => toggleAge(k)}
                  className="h-7 rounded-m3-sm px-2 text-[11px] font-medium"
                  style={{ background: adv.ages.includes(k) ? "var(--md-primary)" : "var(--md-surface-container-high)", color: adv.ages.includes(k) ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAdv({ ages: adv.ages.length > 0 ? [] : Object.keys(AGE_LABELS) })} className="m3-body-sm" style={{ color: "var(--md-primary)" }}>
              {adv.ages.length > 0 ? "초기화" : "전체 선택"}
            </button>
          </div>

          {/* 기기 */}
          <div className="space-y-1">
            <div className="m3-label-sm">기기</div>
            <div className="flex gap-1">
              {([["", "전체"], ["pc", "PC"], ["mo", "모바일"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setAdv({ device: v })}
                  className="h-7 rounded-m3-sm px-2.5 text-xs font-medium"
                  style={{ background: adv.device === v ? "var(--md-primary)" : "var(--md-surface-container-high)", color: adv.device === v ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
