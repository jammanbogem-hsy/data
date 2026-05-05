import { getLatestSnapshot, getTopics } from "@/lib/data";
import { TopicCard } from "@/components/TopicCard";
import { RefreshButton } from "@/components/RefreshButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LegacyTopicsPage() {
  const snapshot = await getLatestSnapshot().catch(() => null);
  const topics = snapshot ? await getTopics(snapshot.id, 30).catch(() => []) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border px-3 py-2 text-xs flex items-center gap-1.5" style={{ borderColor: "var(--md-outline-variant)", background: "var(--md-surface-container-low)", color: "var(--md-on-surface-variant)" }}>
        <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>inventory_2</span>
        <b>Legacy 뷰</b> — 예전 Python analyzer가 생성한 초등 수업 토픽 카드입니다.
        v2부터는 홈의 데이터 마이닝 도구를 쓰세요.{" "}
        <Link href="/legacy/graph" className="underline">온톨로지</Link> ·{" "}
        <Link href="/legacy/flow" className="underline">트렌드</Link>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="m3-headline-sm">오늘의 수업 토픽</h1>
          <p className="mt-1 m3-body-sm">
            {snapshot
              ? `${snapshot.id} · 수집 ${snapshot.itemCount.toLocaleString()}건 · 토픽 ${snapshot.topicCount}`
              : "아직 수집된 데이터가 없습니다."}
          </p>
        </div>
        <RefreshButton />
      </div>

      {topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm" style={{ borderColor: "var(--md-outline)", color: "var(--md-on-surface-variant)" }}>
          스냅샷 없음. (Python analyzer 파이프라인은 v2에서 은퇴)
        </p>
      ) : (
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
}
