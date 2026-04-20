const SOURCE_ICON: Record<string, string> = {
  "naver-news": "📰",
  "youtube-video": "🎬",
  "youtube-comment": "💬",
};

const SOURCE_COLOR: Record<string, string> = {
  "naver-news": "border-l-green-400",
  "youtube-video": "border-l-red-400",
  "youtube-comment": "border-l-red-300",
};

export function SourceItem({ item }: { item: any }) {
  const icon = SOURCE_ICON[item.source] ?? "📄";
  const borderColor = SOURCE_COLOR[item.source] ?? "border-l-slate-300";
  const title = item.title || item.textPreview?.slice(0, 60) || "(제목 없음)";
  const preview = item.textPreview || item.text?.slice(0, 200) || "";
  const url = item.url || "";
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-4 ${borderColor} bg-white p-4 dark:border-slate-800 dark:bg-slate-900`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-100 dark:hover:text-blue-400"
              >
                {title}
              </a>
            ) : (
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </span>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-slate-400 hover:text-blue-500"
              >
                ↗
              </a>
            )}
          </div>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {preview}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
            {date && <span>{date}</span>}
            {item.likeCount > 0 && <span>👍 {item.likeCount}</span>}
            {item.viewCount > 0 && (
              <span>👀 {item.viewCount.toLocaleString()}</span>
            )}
            {item.kidSafeScore != null && (
              <span
                className={
                  item.kidSafeScore >= 0.7
                    ? "text-emerald-500"
                    : "text-slate-400"
                }
              >
                적합도 {Math.round(item.kidSafeScore * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
