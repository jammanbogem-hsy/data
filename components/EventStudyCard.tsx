"use client";

import type { EventImpact } from "@/lib/event-study";

const CONF_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  insufficient: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const CONF_LABEL: Record<string, string> = {
  high: "확신↑",
  medium: "보통",
  low: "낮음",
  insufficient: "샘플부족",
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
    <section className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 dark:border-violet-800 dark:from-violet-950 dark:to-indigo-950">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
          🎯 이벤트 영향 분석 {impacts.length}
        </span>
        <span className="text-xs text-violet-800 dark:text-violet-300">
          한국 명절·절기·기념일이 &ldquo;{keyword}&rdquo; 검색에 얼마나 영향을 줬는지 (event study)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-violet-200 dark:border-violet-800">
              <th className="p-2 text-left text-slate-600 dark:text-slate-400">이벤트</th>
              <th className="p-2 text-left text-slate-600 dark:text-slate-400">날짜</th>
              <th className="p-2 text-right text-slate-600 dark:text-slate-400">평시</th>
              <th className="p-2 text-right text-slate-600 dark:text-slate-400">이벤트</th>
              <th className="p-2 text-right text-slate-600 dark:text-slate-400">영향</th>
              <th className="p-2 text-right text-slate-600 dark:text-slate-400">여진</th>
              <th className="p-2 text-center text-slate-600 dark:text-slate-400">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {impacts.map((ei, i) => {
              const liftColor =
                ei.lift >= 30
                  ? "text-orange-600 dark:text-orange-400 font-bold"
                  : ei.lift >= 10
                    ? "text-emerald-600 dark:text-emerald-400"
                    : ei.lift <= -10
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-500";
              return (
                <tr
                  key={i}
                  className="border-b border-violet-100 dark:border-violet-900"
                >
                  <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                    {ei.event.name}
                  </td>
                  <td className="p-2 font-mono text-slate-500">
                    {ei.event.date.slice(5)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                    {ei.beforeAvg.toFixed(1)}
                  </td>
                  <td className="p-2 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {ei.duringAvg.toFixed(1)}
                  </td>
                  <td className={`p-2 text-right tabular-nums ${liftColor}`}>
                    {ei.lift >= 0 ? "+" : ""}
                    {ei.lift.toFixed(0)}%
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-500">
                    {ei.rebound >= 0 ? "+" : ""}
                    {ei.rebound.toFixed(0)}%
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONF_STYLE[ei.confidence]}`}
                    >
                      {CONF_LABEL[ei.confidence]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-violet-700 dark:text-violet-300">
        💡 <b>영향(lift)</b> = (이벤트 ±2일 평균 ÷ 평시 -14~-3일 평균 - 1) × 100%. <b>여진(rebound)</b> = 이벤트 +3~+10일 대비 평시.
        샘플 크기와 변화량 기반으로 신뢰도 자동 산정.
      </p>
    </section>
  );
}
