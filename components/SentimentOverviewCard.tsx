"use client";

import { useMemo, useState } from "react";
import { WordCloudLazy as WordCloud } from "./WordCloudLazy";

interface NewsItem { title: string; description: string; pubDate: string; }

const POS_WORDS = [
  "좋","최고","인기","성공","흥행","대박","호평","사랑","추천","만족","감동","행복","축하",
  "달성","돌파","화제","열풍","맛있","편리","혁신","상승","증가","수상","매력","기대",
  "응원","선호","호응","환영","칭찬","뛰어나","우수","탁월","훌륭","완벽","놀라",
  "감사","고마","즐거","재미","신나","멋지","예쁘","귀엽","따뜻","든든","알차",
  "풍성","다양","편안","안정","쾌적","깔끔","신선","특별","유익","보람","활기",
  "도약","성장","발전","확대","개선","강화","호조","회복","반등","급등",
  "1위","기록","최다","역대","돌파","신기록","베스트","히트","화려","빛나",
];
const NEG_WORDS = [
  "논란","비판","문제","사고","피해","우려","위기","하락","감소","불만","실패",
  "취소","중단","처벌","위반","반발","분노","불안","비싼","부담","불편","위험",
  "경고","적발","의혹","폭락","급락","악화","침체","부진","적자","손실","손해",
  "갈등","충돌","혼란","파문","물의","비난","항의","소송","고소","고발",
  "사기","거짓","조작","왜곡","은폐","축소","과장","허위","기만",
  "아쉬","안타깝","슬프","우울","답답","짜증","화나","무서","두렵",
  "최악","형편없","실망","후회","지루","심각","긴급","비상","재난",
];

function classifyText(title: string): "positive" | "negative" | "neutral" {
  const t = title.toLowerCase();
  const p = POS_WORDS.filter((w) => t.includes(w)).length;
  const n = NEG_WORDS.filter((w) => t.includes(w)).length;
  return p > n ? "positive" : n > p ? "negative" : "neutral";
}

export function SentimentOverviewCard({ keyword, news, mindset }: { keyword: string; news: NewsItem[]; mindset: string }) {
  const [wordView, setWordView] = useState<"map" | "table">("map");
  const a = useMemo(() => {
    if (!news || news.length === 0) return null;
    let pos = 0, neg = 0, neu = 0;
    const posW = new Map<string, number>(), negW = new Map<string, number>();
    let bestPosDate = "", bestNegDate = "", bestPosR = 0, worstNegR = 0;
    const byDate = new Map<string, { pos: number; neg: number; neu: number }>();

    for (const n of news) {
      // 제목 + 설명 합쳐서 분석 (제목만으로는 감정 단어가 너무 적음)
      const fullText = `${n.title} ${n.description ?? ""}`;
      const s = classifyText(fullText);
      if (s === "positive") pos++; else if (s === "negative") neg++; else neu++;
      const t = fullText.toLowerCase();
      for (const w of POS_WORDS) if (t.includes(w)) posW.set(w, (posW.get(w) ?? 0) + 1);
      for (const w of NEG_WORDS) if (t.includes(w)) negW.set(w, (negW.get(w) ?? 0) + 1);
      const d = n.pubDate?.slice(0, 10) ?? "";
      if (d) { const p = byDate.get(d) ?? { pos: 0, neg: 0, neu: 0 }; if (s === "positive") p.pos++; else if (s === "negative") p.neg++; else p.neu++; byDate.set(d, p); }
    }
    for (const [d, cnt] of byDate.entries()) {
      const total = cnt.pos + cnt.neg + cnt.neu;
      if (total < 2) continue;
      if (cnt.pos / total > bestPosR) { bestPosR = cnt.pos / total; bestPosDate = d; }
      if (cnt.neg / total > worstNegR) { worstNegR = cnt.neg / total; bestNegDate = d; }
    }
    const total = pos + neg + neu;
    return {
      pos, neg, neu, total,
      posP: total > 0 ? Math.round((pos / total) * 100) : 0,
      negP: total > 0 ? Math.round((neg / total) * 100) : 0,
      neuP: total > 0 ? Math.round((neu / total) * 100) : 0,
      topPos: Array.from(posW.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      topNeg: Array.from(negW.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      bestPosDate, bestNegDate,
    };
  }, [news]);

  if (!a) return null;

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon" style={{ color: "var(--md-primary)" }}>sentiment_satisfied</span>
        감정 분석
      </h3>

      {/* 요약 3카드 */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
            <span className="m3-icon">thumb_up</span>
          </div>
          <div>
            <div className="m3-label-sm">전체 감정</div>
            <div className="text-lg font-bold" style={{ color: a.posP >= 60 ? "var(--md-primary)" : a.negP >= 40 ? "var(--md-error)" : "var(--md-on-surface)" }}>
              {a.posP >= 60 ? `긍정 ${a.posP}%` : a.negP >= 40 ? `부정 ${a.negP}%` : `중립 ${a.neuP}%`}
            </div>
            <div className="m3-body-sm">긍정 {a.pos} · 부정 {a.neg} · 중립 {a.neu}</div>
          </div>
        </div>
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
            <span className="m3-icon">mood</span>
          </div>
          <div>
            <div className="m3-label-sm">긍정이 가장 높았던 날</div>
            <div className="text-base font-bold" style={{ color: "var(--md-primary)" }}>{a.bestPosDate || "—"}</div>
          </div>
        </div>
        <div className="m3-card flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--md-error)", color: "white" }}>
            <span className="m3-icon">sentiment_dissatisfied</span>
          </div>
          <div>
            <div className="m3-label-sm">부정이 가장 높았던 날</div>
            <div className="text-base font-bold" style={{ color: "var(--md-error)" }}>{a.bestNegDate || "—"}</div>
          </div>
        </div>
      </div>

      {/* 감정 바 */}
      <div className="m3-card">
        <div className="m3-title-sm mb-2">전체 감정 분포 ({a.total}건 분석)</div>
        <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
          <div className="flex h-full">
            <div style={{ width: `${a.posP}%`, background: "var(--md-primary)" }} />
            <div style={{ width: `${a.neuP}%`, background: "var(--md-outline)" }} />
            <div style={{ width: `${a.negP}%`, background: "var(--md-error)" }} />
          </div>
        </div>
        <div className="mt-2 flex gap-4 m3-body-sm">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-primary)" }} /> 긍정 {a.posP}%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-outline)" }} /> 중립 {a.neuP}%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-error)" }} /> 부정 {a.negP}%</span>
        </div>
      </div>

      {/* 감정 키워드 — 워드맵 / 테이블 토글 */}
      <div className="m3-card">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="m3-title-sm flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)" }}>cloud</span>
            감정 키워드
          </h4>
          <div className="flex rounded-m3-md border overflow-hidden" style={{ borderColor: "var(--md-outline)" }}>
            <button onClick={() => setWordView("map")} className="px-3 py-1.5 text-xs font-medium" style={{ background: wordView === "map" ? "var(--md-primary)" : "var(--md-surface-container)", color: wordView === "map" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>워드맵</button>
            <button onClick={() => setWordView("table")} className="px-3 py-1.5 text-xs font-medium" style={{ background: wordView === "table" ? "var(--md-primary)" : "var(--md-surface-container)", color: wordView === "table" ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>테이블</button>
          </div>
        </div>

        {wordView === "map" ? (
          <WordCloud
            words={[
              ...a.topPos.map(([w, c]) => ({ text: w, value: c, sentiment: "positive" as const })),
              ...a.topNeg.map(([w, c]) => ({ text: w, value: c, sentiment: "negative" as const })),
            ].sort((a, b) => b.value - a.value)}
            height={260}
          />
        ) : (
          /* 테이블 */
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <th className="p-2 text-left m3-label-sm">키워드</th>
                <th className="p-2 text-center m3-label-sm">감정</th>
                <th className="p-2 text-right m3-label-sm">빈도</th>
              </tr>
            </thead>
            <tbody>
              {[...a.topPos.map(([w, c]) => ({ w, c, s: "긍정" })), ...a.topNeg.map(([w, c]) => ({ w, c, s: "부정" }))]
                .sort((a, b) => b.c - a.c)
                .map(({ w, c, s }) => (
                  <tr key={w} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                    <td className="p-2 font-medium" style={{ color: "var(--md-on-surface)" }}>{w}</td>
                    <td className="p-2 text-center">
                      <span className="rounded-m3-sm px-2 py-0.5 text-[11px] font-semibold" style={{ background: s === "긍정" ? "var(--md-primary)" : "var(--md-error)", color: "white" }}>{s}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums m3-body-sm">{c}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {/* 범례 */}
        <div className="mt-3 flex justify-center gap-4 m3-body-sm">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-primary)" }} /> 긍정</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--md-error)" }} /> 부정</span>
        </div>
      </div>

      {mindset && (
        <div className="m3-card" style={{ background: "var(--md-surface-container-low)" }}>
          <div className="flex items-start gap-2 m3-body-md">
            <span className="m3-icon shrink-0" style={{ color: "var(--md-primary)" }}>psychology</span>
            <div>
              <b className="m3-title-sm">사람들의 마음</b>
              <p className="mt-1 m3-body-sm italic leading-relaxed">{mindset}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
