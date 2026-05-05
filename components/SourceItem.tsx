const SOURCE_ICON: Record<string, string> = {
  "naver-news": "newspaper",
  "youtube-video": "smart_display",
  "youtube-comment": "chat_bubble",
};

const SOURCE_BORDER: Record<string, string> = {
  "naver-news": "var(--md-primary)",
  "youtube-video": "var(--md-error)",
  "youtube-comment": "#F57F17",
};

export function SourceItem({ item }: { item: any }) {
  const icon = SOURCE_ICON[item.source] ?? "article";
  const borderLeft = SOURCE_BORDER[item.source] ?? "var(--md-outline)";
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
      className="m3-card-outlined"
      style={{ borderLeft: `4px solid ${borderLeft}` }}
    >
      <div className="flex items-start gap-3">
        <span className="m3-icon mt-0.5" style={{ color: borderLeft }}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline"
                style={{ color: "var(--md-on-surface)" }}
              >
                {title}
              </a>
            ) : (
              <span className="text-sm font-semibold" style={{ color: "var(--md-on-surface)" }}>
                {title}
              </span>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 m3-icon-sm"
                style={{ fontSize: 14, color: "var(--md-on-surface-variant)" }}
              >
                open_in_new
              </a>
            )}
          </div>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
            {preview}
          </p>
          <div className="mt-2 flex items-center gap-3 m3-body-sm">
            {date && <span>{date}</span>}
            {item.likeCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="m3-icon-sm" style={{ fontSize: 12 }}>thumb_up</span> {item.likeCount}
              </span>
            )}
            {item.viewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="m3-icon-sm" style={{ fontSize: 12 }}>visibility</span> {item.viewCount.toLocaleString()}
              </span>
            )}
            {item.kidSafeScore != null && (
              <span style={{ color: item.kidSafeScore >= 0.7 ? "var(--md-primary)" : "var(--md-on-surface-variant)" }}>
                적합도 {Math.round(item.kidSafeScore * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
