import { getLatestSnapshot, getKeywordDaily } from "@/lib/data";
import { FlowView } from "@/components/FlowView";
import { adminDb } from "@/lib/firebase-admin";
import type { KeywordDaily } from "@shared/schema";

export const dynamic = "force-dynamic";

export default async function FlowPage() {
  const snapshot = await getLatestSnapshot().catch(() => null);
  if (!snapshot) return <p className="m3-body-sm">스냅샷 없음</p>;

  const today = await getKeywordDaily(snapshot.id, 12);
  const topKeywords = today.map((k) => k.keyword);

  const series: Record<string, KeywordDaily[]> = {};
  for (const kw of topKeywords) {
    const snap = await adminDb()
      .collection("keyword_daily")
      .where("keyword", "==", kw)
      .orderBy("date", "desc")
      .limit(30)
      .get();
    series[kw] = snap.docs.map((d) => d.data() as KeywordDaily).reverse();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="m3-headline-sm">급등 키워드 플로우</h1>
        <p className="mt-1 m3-body-sm">
          {snapshot.id} · 상위 {topKeywords.length}개 · 최근 30일
        </p>
      </div>
      <FlowView series={series} />
    </div>
  );
}
