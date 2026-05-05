import type { Topic } from "@shared/schema";
import clsx from "clsx";
import Link from "next/link";

const CATEGORY_ICON: Record<string, string> = {
  food: "restaurant",
  game: "sports_esports",
  culture: "movie",
  sports: "sports_soccer",
  science: "science",
  animal: "pets",
  travel: "flight",
  education: "school",
  other: "category",
};

const CATEGORY_LABEL: Record<string, string> = {
  food: "음식",
  game: "게임",
  culture: "문화",
  sports: "스포츠",
  science: "과학",
  animal: "동물",
  travel: "여행",
  education: "교육",
  other: "기타",
};

export function TopicCard({ topic }: { topic: Topic }) {
  const surge = Math.round(topic.surgeScore * 10) / 10;
  const { positive, negative, neutral } = topic.sentimentDist;
  const total = Math.max(positive + negative + neutral, 1);

  return (
    <Link href={`/topic/${encodeURIComponent(topic.id)}`} className="block h-full">
      <article className="m3-card group flex h-full flex-col transition hover:shadow-md" style={{ borderColor: "var(--md-outline-variant)" }}>
        <header className="flex items-start justify-between gap-2">
          <span className="m3-body-sm flex items-center gap-1">
            <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>{CATEGORY_ICON[topic.category] ?? "category"}</span>
            {CATEGORY_LABEL[topic.category] ?? topic.category}
          </span>
          <SurgeBadge value={surge} />
        </header>

        <h2 className="mt-2 text-lg font-semibold tracking-tight" style={{ color: "var(--md-on-surface)" }}>
          {topic.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
          {topic.summary}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {topic.keywords.slice(0, 6).map((k) => (
            <span
              key={k}
              className="m3-chip text-xs"
            >
              #{k}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--md-surface-container-high)" }}>
            <div className="flex h-full">
              <div style={{ width: `${(positive / total) * 100}%`, background: "var(--md-primary)" }} />
              <div style={{ width: `${(neutral / total) * 100}%`, background: "var(--md-outline)" }} />
              <div style={{ width: `${(negative / total) * 100}%`, background: "var(--md-error)" }} />
            </div>
          </div>

          {topic.lessonIdeas?.length > 0 && (
            <div className="mt-3 m3-body-sm flex items-center gap-1">
              <span className="m3-icon-sm" style={{ fontSize: 14, color: "var(--md-primary)" }}>lightbulb</span>
              수업 아이디어 {topic.lessonIdeas.length}개 · 클릭하여 상세 보기
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
        className="rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}
        title="첫 수집이라 과거 비교 데이터가 없습니다. 내일부터 의미 있는 급등 지수가 표시됩니다."
      >
        첫 수집
      </span>
    );
  }

  const level = value >= 3 ? "high" : value >= 1.5 ? "mid" : "low";
  const badgeStyle =
    level === "high"
      ? { background: "color-mix(in srgb, var(--md-error) 12%, var(--md-surface-container))", color: "var(--md-error)" }
      : level === "mid"
        ? { background: "color-mix(in srgb, var(--md-primary) 12%, var(--md-surface-container))", color: "var(--md-primary)" }
        : { background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={badgeStyle}
      title="급등 지수 = 최근7일 평균 / 직전28일 평균. 3 이상이면 급등, 1.5 이상이면 상승"
    >
      x{value.toFixed(1)}
    </span>
  );
}
