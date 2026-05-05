"use client";

import { useState } from "react";
import type { RelatedKeyword } from "@/lib/providers/claude";

const CAT_COLOR: Record<string, string> = {
  인물: "#1565C0", 제품: "#F57F17", 장소: "#2E7D32", 이벤트: "#7B1FA2",
  감정: "#C62828", 브랜드: "#E65100", 기타: "#546E7A",
};

const STRENGTH_SCALE: Record<string, number> = { strong: 1.4, medium: 1.0, weak: 0.75 };

export function RelatedKeywordsCard({ keyword, relatedKeywords }: { keyword: string; relatedKeywords: RelatedKeyword[] }) {
  const [view, setView] = useState<"bubble" | "table">("bubble");
  if (!relatedKeywords || relatedKeywords.length === 0) return null;

  const byCategory = new Map<string, RelatedKeyword[]>();
  for (const rk of relatedKeywords) (byCategory.get(rk.category) ?? (byCategory.set(rk.category, []), byCategory.get(rk.category)!)).push(rk);
  const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1].length - a[1].length);
  const strongCount = relatedKeywords.filter((k) => k.strength === "strong").length;

  return (
    <section className="m3-section">
      <div className="flex items-center justify-between">
        <h3 className="m3-section-title">
          <span className="m3-icon" style={{ color: "var(--md-primary)" }}>hub</span>
          연관어 분석
        </h3>
        {/* 뷰 토글 */}
        <div className="flex rounded-m3-md border overflow-hidden" style={{ borderColor: "var(--md-outline)" }}>
          <button onClick={() => setView("bubble")} className="px-3 py-1.5 text-xs font-medium transition" style={{ background: view === "bubble" ? "var(--md-primary)" : "var(--md-surface-container)", color: view === "bubble" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>워드맵</button>
          <button onClick={() => setView("table")} className="px-3 py-1.5 text-xs font-medium transition" style={{ background: view === "table" ? "var(--md-primary)" : "var(--md-surface-container)", color: view === "table" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>테이블</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
            <span className="m3-icon">category</span>
          </div>
          <div>
            <div className="m3-label-sm">가장 많은 카테고리</div>
            <div className="text-lg font-bold" style={{ color: CAT_COLOR[sorted[0]?.[0] ?? "기타"] }}>{sorted[0]?.[0] ?? "—"}</div>
            <div className="m3-body-sm">{sorted[0]?.[1]?.length ?? 0}개 연관어</div>
          </div>
        </div>
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-primary-dark)", color: "var(--md-on-primary)" }}>
            <span className="m3-icon">star</span>
          </div>
          <div>
            <div className="m3-label-sm">핵심 연관어</div>
            <div className="text-sm font-bold" style={{ color: "var(--md-on-surface)" }}>{relatedKeywords.filter(k => k.strength === "strong").slice(0, 3).map(k => k.keyword).join(", ") || "—"}</div>
            <div className="m3-body-sm">{strongCount}개 (강한 연관)</div>
          </div>
        </div>
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-primary-light)", color: "var(--md-on-primary)" }}>
            <span className="m3-icon">donut_small</span>
          </div>
          <div>
            <div className="m3-label-sm">카테고리 수</div>
            <div className="text-lg font-bold" style={{ color: "var(--md-on-surface)" }}>{sorted.length}개</div>
            <div className="m3-body-sm">총 {relatedKeywords.length}개 연관어</div>
          </div>
        </div>
      </div>

      {view === "bubble" ? (
        /* 버블 워드맵 */
        <div className="m3-card" style={{ minHeight: 280 }}>
          <div className="flex flex-wrap items-center justify-center gap-2 py-4">
            {/* 중앙 키워드 */}
            <span className="rounded-full px-5 py-2.5 text-lg font-bold" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>{keyword}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {relatedKeywords.map((rk) => {
              const scale = STRENGTH_SCALE[rk.strength] ?? 1;
              const catColor = CAT_COLOR[rk.category] ?? CAT_COLOR["기타"];
              const size = Math.max(12, Math.min(20, 13 * scale));
              return (
                <span key={rk.keyword} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 transition hover:shadow-m3-1" style={{
                  fontSize: `${size}px`,
                  fontWeight: scale >= 1.2 ? 700 : 500,
                  borderColor: catColor,
                  color: catColor,
                  background: `color-mix(in srgb, ${catColor} ${scale >= 1.2 ? 12 : 5}%, var(--md-surface-container))`,
                }} title={`${rk.category} · ${rk.strength} · ${rk.context}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: rk.sentiment === "positive" ? "var(--md-primary)" : rk.sentiment === "negative" ? "var(--md-error)" : "var(--md-outline)" }} />
                  {rk.keyword}
                </span>
              );
            })}
          </div>
          {/* 카테고리 범례 */}
          <div className="mt-4 flex flex-wrap justify-center gap-3 m3-body-sm">
            {sorted.map(([cat]) => (
              <span key={cat} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[cat] }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* 테이블 뷰 */
        <div className="m3-card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <th className="p-2.5 text-left m3-label-sm">연관어</th>
                <th className="p-2.5 text-left m3-label-sm">카테고리</th>
                <th className="p-2.5 text-center m3-label-sm">강도</th>
                <th className="p-2.5 text-center m3-label-sm">감정</th>
                <th className="p-2.5 text-left m3-label-sm">맥락</th>
              </tr>
            </thead>
            <tbody>
              {relatedKeywords.map((rk, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                  <td className="p-2.5 font-medium" style={{ color: "var(--md-on-surface)" }}>{rk.keyword}</td>
                  <td className="p-2.5"><span className="m3-chip text-[11px]" style={{ borderColor: CAT_COLOR[rk.category], color: CAT_COLOR[rk.category] }}>{rk.category}</span></td>
                  <td className="p-2.5 text-center"><span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ background: rk.strength === "strong" ? "var(--md-primary)" : rk.strength === "medium" ? "var(--md-primary-light)" : "var(--md-outline)", color: rk.strength === "weak" ? "var(--md-on-surface)" : "var(--md-on-primary)" }}>{rk.strength === "strong" ? "강" : rk.strength === "medium" ? "중" : "약"}</span></td>
                  <td className="p-2.5 text-center"><span className="h-3 w-3 inline-block rounded-full" style={{ background: rk.sentiment === "positive" ? "var(--md-primary)" : rk.sentiment === "negative" ? "var(--md-error)" : "var(--md-outline)" }} /></td>
                  <td className="p-2.5 m3-body-sm">{rk.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
