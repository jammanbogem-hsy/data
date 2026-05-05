import { getLatestSnapshot, getEdges, getKeywordDaily } from "@/lib/data";
import { GraphView } from "@/components/GraphView";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const snapshot = await getLatestSnapshot().catch(() => null);
  if (!snapshot) {
    return <p className="m3-body-sm">스냅샷 없음</p>;
  }

  const [edges, keywords] = await Promise.all([
    getEdges(snapshot.id, 500),
    getKeywordDaily(snapshot.id, 200),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="m3-headline-sm">키워드 온톨로지</h1>
        <p className="mt-1 m3-body-sm">
          {snapshot.id} · 노드 {keywords.length} · 엣지 {edges.length}
        </p>
      </div>
      <GraphView keywords={keywords} edges={edges} />
    </div>
  );
}
