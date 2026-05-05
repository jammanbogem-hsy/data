"use client";

import type { SummaryMetrics } from "@/lib/correction";

function IconCircle({ icon, variant = "default" }: { icon: string; variant?: "default" | "warning" | "info" }) {
  const styles = {
    default: { bg: "color-mix(in srgb, var(--md-primary) 15%, white)", color: "var(--md-primary)" },
    warning: { bg: "color-mix(in srgb, #F57F17 15%, white)", color: "#F57F17" },
    info: { bg: "color-mix(in srgb, #1565C0 15%, white)", color: "#1565C0" },
  };
  const s = styles[variant];
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: s.bg }}>
      <span className="m3-icon" style={{ fontSize: 28, color: s.color }}>{icon}</span>
    </div>
  );
}

export function SummaryCards({ metrics, keyword }: { metrics: SummaryMetrics; keyword: string }) {
  const isUp = metrics.recentChangePercent >= 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="m3-card flex items-center gap-4">
        <IconCircle icon="newspaper" />
        <div>
          <div className="m3-label-sm">언급 가장 많은 채널</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: "var(--md-primary)" }}>
            {metrics.dominantSource}
          </div>
          <div className="m3-body-sm">{metrics.dominantSourceCount}건 수집</div>
        </div>
      </div>

      <div className="m3-card flex items-center gap-4">
        <IconCircle icon="calendar_today" variant="warning" />
        <div>
          <div className="m3-label-sm">검색 가장 많았던 날</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: "#F57F17" }}>
            {metrics.peakDate}
          </div>
          <div className="m3-body-sm">
            {metrics.peakWeekday}요일이 평균 높음 ({metrics.peakWeekdayAvg.toFixed(1)})
          </div>
        </div>
      </div>

      <div className="m3-card flex items-center gap-4">
        <IconCircle icon={isUp ? "trending_up" : "trending_down"} variant={isUp ? "default" : "info"} />
        <div>
          <div className="m3-label-sm">최근 30일 vs 직전 30일</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: isUp ? "var(--md-primary)" : "#1565C0" }}>
            {isUp ? "+" : ""}{Math.abs(metrics.recentChangePercent).toFixed(1)}%
          </div>
          <div className="m3-body-sm">
            평균 {metrics.avgRatio} · 보정 {metrics.recentCorrectedAvg}
          </div>
        </div>
      </div>
    </div>
  );
}
