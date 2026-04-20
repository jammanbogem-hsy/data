import type { Topic } from "@shared/schema";
import clsx from "clsx";
import Link from "next/link";

const CATEGORY_LABEL: Record<string, string> = {
  food: "🍱 음식",
  game: "🎮 게임",
  culture: "🎬 문화",
  sports: "⚽ 스포츠",
  science: "🔬 과학",
  animal: "🐾 동물",
  travel: "✈️ 여행",
  education: "📚 교육",
  other: "· 기타",
};

export function TopicCard({ topic }: { topic: Topic }) {
  const surge = Math.round(topic.surgeScore * 10) / 10;
  const { positive, negative, neutral } = topic.sentimentDist;
  const total = Math.max(positive + negative + neutral, 1);

  return (
    <Link href={`/topic/${encodeURIComponent(topic.id)}`} className="block h-full">
      <article className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
        <header className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {CATEGORY_LABEL[topic.category] ?? topic.category}
          </span>
          <SurgeBadge value={surge} />
        </header>

        <h2 className="mt-2 text-lg font-semibold tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {topic.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {topic.summary}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {topic.keywords.slice(0, 6).map((k) => (
            <span
              key={k}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              #{k}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="flex h-full">
              <div style={{ width: `${(positive / total) * 100}%` }} className="bg-emerald-400" />
              <div style={{ width: `${(neutral / total) * 100}%` }} className="bg-slate-300 dark:bg-slate-600" />
              <div style={{ width: `${(negative / total) * 100}%` }} className="bg-rose-400" />
            </div>
          </div>

          {topic.lessonIdeas?.length > 0 && (
            <div className="mt-3 text-xs text-slate-400">
              💡 수업 아이디어 {topic.lessonIdeas.length}개 · 클릭하여 상세 보기
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

function SurgeBadge({ value }: { value: number }) {
  // 첫 수집(history 없음)이면 surgeScore = 원문 횟수/1 이라 비현실적으로 높음
  const isFirstDay = value > 50;

  if (isFirstDay) {
    return (
      <span
        className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
        title="첫 수집이라 과거 비교 데이터가 없습니다. 내일부터 의미 있는 급등 지수가 표시됩니다."
      >
        첫 수집
      </span>
    );
  }

  const level = value >= 3 ? "high" : value >= 1.5 ? "mid" : "low";
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        level === "high" && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
        level === "mid" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        level === "low" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      )}
      title="급등 지수 = 최근7일 평균 / 직전28일 평균. 3 이상이면 급등, 1.5 이상이면 상승"
    >
      ×{value.toFixed(1)}
    </span>
  );
}
