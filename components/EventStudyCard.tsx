"use client";

import type { EventImpact } from "@/lib/event-study";

const CONF = {
  high: { text: "높음", bg: "var(--md-primary)", color: "var(--md-on-primary)" },
  medium: { text: "보통", bg: "#1565C0", color: "white" },
  low: { text: "낮음", bg: "var(--md-outline)", color: "var(--md-on-surface)" },
  insufficient: { text: "부족", bg: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" },
};

export function EventStudyCard({
  keyword,
  impacts,
}: {
  keyword: string;
  impacts: EventImpact[];
}) {
  if (!impacts || impacts.length === 0) return null;

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon" style={{ color: "var(--md-primary)" }}>event_available</span>
        이벤트가 검색에 준 영향
      </h3>
      <p className="m3-body-sm -mt-2">
        명절, 절기, 기념일이 &ldquo;{keyword}&rdquo; 검색량에 얼마나 영향을 줬는지 자동으로 계산한 결과입니다.
      </p>

      <div className="m3-card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
              <th className="p-2.5 text-left m3-label-sm">이벤트</th>
              <th className="p-2.5 text-left m3-label-sm">날짜</th>
              <th className="p-2.5 text-right m3-label-sm">평시</th>
              <th className="p-2.5 text-right m3-label-sm">이벤트일</th>
              <th className="p-2.5 text-right m3-label-sm">변화</th>
              <th className="p-2.5 text-right m3-label-sm">여진</th>
              <th className="p-2.5 text-center m3-label-sm">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {impacts.map((ei, i) => {
              const liftColor =
                ei.lift >= 30 ? "var(--md-error)" :
                ei.lift >= 10 ? "var(--md-primary)" :
                ei.lift <= -10 ? "#1565C0" :
                "var(--md-on-surface-variant)";
              const conf = CONF[ei.confidence] ?? CONF.medium;
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                  <td className="p-2.5 font-medium" style={{ color: "var(--md-on-surface)" }}>
                    {ei.event.name}
                  </td>
                  <td className="p-2.5 font-mono m3-body-sm">{ei.event.date.slice(5)}</td>
                  <td className="p-2.5 text-right tabular-nums m3-body-sm">{ei.beforeAvg.toFixed(1)}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--md-on-surface)" }}>
                    {ei.duringAvg.toFixed(1)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums font-semibold" style={{ color: liftColor }}>
                    {ei.lift >= 0 ? "+" : ""}{ei.lift.toFixed(0)}%
                  </td>
                  <td className="p-2.5 text-right tabular-nums m3-body-sm">
                    {ei.rebound >= 0 ? "+" : ""}{ei.rebound.toFixed(0)}%
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ background: conf.bg, color: conf.color }}>
                      {conf.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="m3-body-sm mt-1">
        <b>변화</b> = 이벤트일 전후 평균이 평시보다 얼마나 달라졌는지. <b>여진</b> = 이벤트 이후에도 영향이 남아있는지.
      </p>
    </section>
  );
}
