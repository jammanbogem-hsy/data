import { getTopicById, getItemsBySnapshot, getRelatedEdges, getKeywordDaily } from "@/lib/data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceItem } from "@/components/SourceItem";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  "naver-news": "네이버 뉴스",
  "youtube-video": "YouTube 영상",
  "youtube-comment": "YouTube 댓글",
};

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const topic = await getTopicById(decodedId);
  if (!topic) {
    console.warn(`[topic] not found: raw=${id} decoded=${decodedId}`);
    notFound();
  }

  const keyword = topic.keywords[0] ?? "";
  const date = topic.date;

  const [allItems, relatedEdges, keywordData] = await Promise.all([
    getItemsBySnapshot(date, 1000),
    getRelatedEdges(date, keyword, 20),
    getKeywordDaily(date, 500),
  ]);

  // 키워드가 포함된 원문 아이템 필터
  const matchingItems = allItems
    .filter((it: any) => {
      const text = ((it.title ?? "") + " " + (it.text ?? "") + " " + (it.textPreview ?? "")).toLowerCase();
      return topic.keywords.some((kw: string) => text.includes(kw.toLowerCase()));
    })
    .slice(0, 50);

  // 출처별 분류
  const bySource: Record<string, any[]> = {};
  for (const it of matchingItems) {
    const src = it.source ?? "other";
    (bySource[src] ??= []).push(it);
  }

  // 관련 키워드 (공기어)
  const related = relatedEdges.map((e) => ({
    keyword: e.a === keyword ? e.b : e.a,
    weight: e.weight,
    pmi: e.pmi,
  }));

  // 해당 키워드의 일별 통계
  const kwDaily = keywordData.find((k) => k.keyword === keyword);

  const { positive, negative, neutral } = topic.sentimentDist;
  const total = Math.max(positive + negative + neutral, 1);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          ← 토픽 목록
        </Link>
      </div>

      {/* 헤더 */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {topic.category}
          </span>
          <span className="text-xs text-slate-500">{topic.date}</span>
          {kwDaily && (
            <span className="text-xs text-slate-500">
              언급 {kwDaily.count}회
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          {topic.summary}
        </p>
        <div className="flex flex-wrap gap-2">
          {topic.keywords.map((kw: string) => (
            <span
              key={kw}
              className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              #{kw}
            </span>
          ))}
        </div>
      </header>

      {/* 감정 분석 요약 */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">감정 분석</h2>
        <p className="mt-1 text-sm text-slate-500">
          이 키워드와 관련된 뉴스·댓글의 감정 분포입니다.
        </p>
        <div className="mt-4 flex items-center gap-6">
          <div className="flex-1">
            <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="flex h-full">
                <div
                  style={{ width: `${(positive / total) * 100}%` }}
                  className="bg-emerald-400"
                  title={`긍정 ${positive}`}
                />
                <div
                  style={{ width: `${(neutral / total) * 100}%` }}
                  className="bg-slate-300 dark:bg-slate-600"
                  title={`중립 ${neutral}`}
                />
                <div
                  style={{ width: `${(negative / total) * 100}%` }}
                  className="bg-rose-400"
                  title={`부정 ${negative}`}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
              긍정 {positive}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
              중립 {neutral}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-rose-400" />
              부정 {negative}
            </span>
          </div>
        </div>
      </section>

      {/* 수업 아이디어 */}
      {topic.lessonIdeas?.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">💡 수업 아이디어</h2>
          <ul className="mt-3 space-y-3">
            {topic.lessonIdeas.map((idea: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{idea}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 관련 키워드 (공기어) */}
      {related.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">🔗 함께 언급된 키워드</h2>
          <p className="mt-1 text-sm text-slate-500">
            &ldquo;{keyword}&rdquo;와 같은 문서에서 자주 등장하는 단어들입니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <span
                key={r.keyword}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <span className="text-slate-800 dark:text-slate-200">{r.keyword}</span>
                <span className="text-xs text-slate-400">({r.weight})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 원문 데이터 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">📰 원문 데이터</h2>
        <p className="text-sm text-slate-500">
          &ldquo;{keyword}&rdquo; 키워드가 포함된 실제 뉴스 기사·YouTube 영상·댓글입니다.
          제목을 클릭하면 원본으로 이동합니다.
        </p>

        {Object.keys(bySource).length === 0 ? (
          <p className="text-sm text-slate-400">해당 키워드의 원문 아이템이 없습니다.</p>
        ) : (
          Object.entries(bySource).map(([source, items]) => (
            <div key={source} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {SOURCE_LABEL[source] ?? source} ({items.length}건)
              </h3>
              <div className="space-y-2">
                {items.slice(0, 15).map((item: any, i: number) => (
                  <SourceItem key={i} item={item} />
                ))}
                {items.length > 15 && (
                  <p className="text-xs text-slate-400">
                    ...외 {items.length - 15}건 더
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
