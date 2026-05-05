"use client";

interface KeywordResult {
  relKeyword: string;
  totalQcCnt: number;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  compIdx: string;
}

interface KeywordInsight {
  keyword: string;
  totalMonthly: number;
  pcMonthly: number;
  mobileMonthly: number;
  mobileRatio: number;
  compIdx: string;
  relatedKeywords: KeywordResult[];
  autoCompleteKeywords?: string[];
}

function formatN(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return n.toLocaleString();
}

const COMP_STYLE: Record<string, { label: string; color: string }> = {
  높음: { label: "경쟁 높음", color: "var(--md-error)" },
  보통: { label: "경쟁 보통", color: "#F57F17" },
  낮음: { label: "경쟁 낮음", color: "var(--md-primary)" },
};

export function SearchVolumeCard({ data }: { data: KeywordInsight }) {
  const comp = COMP_STYLE[data.compIdx] ?? COMP_STYLE["보통"];
  const hasVolume = data.totalMonthly > 0;

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon" style={{ color: "var(--md-primary)" }}>query_stats</span>
        실제 검색량 (네이버 검색광고)
      </h3>

      {/* 검색량 카드 */}
      {hasVolume ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="m3-card flex flex-col items-center py-4">
            <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>search</span>
            <span className="mt-1 text-2xl font-bold" style={{ color: "var(--md-on-surface)" }}>{formatN(data.totalMonthly)}</span>
            <span className="m3-body-sm">월간 총 검색량</span>
          </div>
          <div className="m3-card flex flex-col items-center py-4">
            <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>computer</span>
            <span className="mt-1 text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>{formatN(data.pcMonthly)}</span>
            <span className="m3-body-sm">PC 검색량</span>
          </div>
          <div className="m3-card flex flex-col items-center py-4">
            <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>smartphone</span>
            <span className="mt-1 text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>{formatN(data.mobileMonthly)}</span>
            <span className="m3-body-sm">모바일 검색량</span>
          </div>
          <div className="m3-card flex flex-col items-center py-4">
            <div className="flex items-center gap-1">
              <span className="m3-icon" style={{ fontSize: 28, color: comp.color }}>speed</span>
            </div>
            <span className="mt-1 text-xl font-bold" style={{ color: comp.color }}>{data.mobileRatio}%</span>
            <span className="m3-body-sm">모바일 비율 · {comp.label}</span>
          </div>
        </div>
      ) : (
        <div className="m3-card flex items-center gap-2 p-3" style={{ background: "var(--md-surface-container-low)" }}>
          <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-on-surface-variant)" }}>info</span>
          <span className="m3-body-sm">이 키워드의 월간 검색량 데이터를 가져올 수 없습니다. 아래 연관 검색어는 확인할 수 있습니다.</span>
        </div>
      )}

      {/* 연관 키워드 테이블 */}
      {data.relatedKeywords.length > 0 && (
        <div className="m3-card overflow-x-auto">
          <h4 className="m3-title-sm mb-3 flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)" }}>link</span>
            연관 검색어 (검색량 기준)
          </h4>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <th className="p-2 text-left m3-label-sm">키워드</th>
                <th className="p-2 text-right m3-label-sm">총 검색량</th>
                <th className="p-2 text-right m3-label-sm">PC</th>
                <th className="p-2 text-right m3-label-sm">모바일</th>
                <th className="p-2 text-center m3-label-sm">경쟁도</th>
              </tr>
            </thead>
            <tbody>
              {data.relatedKeywords.slice(0, 15).map((k, i) => {
                const c = COMP_STYLE[k.compIdx] ?? COMP_STYLE["보통"];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                    <td className="p-2 font-medium" style={{ color: "var(--md-on-surface)" }}>{k.relKeyword}</td>
                    <td className="p-2 text-right tabular-nums font-semibold" style={{ color: "var(--md-on-surface)" }}>{formatN(k.totalQcCnt)}</td>
                    <td className="p-2 text-right tabular-nums m3-body-sm">{formatN(k.monthlyPcQcCnt)}</td>
                    <td className="p-2 text-right tabular-nums m3-body-sm">{formatN(k.monthlyMobileQcCnt)}</td>
                    <td className="p-2 text-center">
                      <span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 10%, var(--md-surface-container))` }}>
                        {k.compIdx}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 m3-body-sm">네이버 검색광고 키워드 도구 기준 월간 검색량</p>
        </div>
      )}

      {/* 자동완성 연관 검색어 (항상 표시) */}
      {data.autoCompleteKeywords && data.autoCompleteKeywords.length > 0 && (
        <div className="m3-card">
          <h4 className="m3-title-sm mb-3 flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)" }}>search</span>
            연관 검색어 (네이버 자동완성)
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.autoCompleteKeywords.map((kw, i) => (
              <span
                key={i}
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={{
                  background: "color-mix(in srgb, var(--md-primary) 8%, var(--md-surface-container))",
                  color: "var(--md-on-surface)",
                }}
              >
                {kw}
              </span>
            ))}
          </div>
          <p className="mt-2 m3-body-sm">사용자들이 이 키워드와 함께 검색하는 검색어입니다.</p>
        </div>
      )}
    </section>
  );
}
