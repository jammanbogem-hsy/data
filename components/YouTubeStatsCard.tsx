"use client";

interface Video {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
}

interface Comment {
  text: string;
  likeCount: number;
}

export function YouTubeStatsCard({
  videos,
  comments,
}: {
  videos: Video[];
  comments: Comment[];
}) {
  if (!videos || videos.length === 0) return null;

  const totalViews = videos.reduce((s, v) => s + (v.viewCount || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likeCount || 0), 0);

  const channelMap = new Map<string, { channel: string; views: number; count: number; firstVideoId: string }>();
  for (const v of videos) {
    const ch = v.channelTitle || "(알 수 없음)";
    const prev = channelMap.get(ch) ?? { channel: ch, views: 0, count: 0, firstVideoId: v.videoId };
    prev.views += v.viewCount || 0;
    prev.count += 1;
    channelMap.set(ch, prev);
  }
  const topChannels = Array.from(channelMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  function formatK(n: number): string {
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
    return String(n);
  }

  return (
    <section className="m3-section">
      <h3 className="m3-section-title">
        <span className="m3-icon">smart_display</span>
        유튜브 반응
      </h3>

      {/* 반응 수치 4개 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBubble icon="videocam" value={formatK(videos.length)} label="동영상 수" />
        <StatBubble icon="visibility" value={formatK(totalViews)} label="조회 수" />
        <StatBubble icon="thumb_up" value={formatK(totalLikes)} label="좋아요 수" />
        <StatBubble icon="chat_bubble" value={formatK(comments.length)} label="댓글 수" />
      </div>

      {/* 채널 TOP 5 */}
      {topChannels.length > 0 && (
        <div className="m3-card">
          <h4 className="m3-title-sm mb-3 flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)" }}>leaderboard</span>
            영향력이 큰 채널
          </h4>
          <div className="space-y-2.5">
            {topChannels.map((ch, i) => (
              <a
                key={ch.channel}
                href={`https://youtu.be/${ch.firstVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm rounded-m3-sm px-1 py-1.5 -mx-1 transition hover:shadow-m3-1"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: i === 0 ? "#F57F17" : i === 1 ? "#78909C" : i === 2 ? "#A1887F" : "var(--md-surface-high)",
                    color: i < 3 ? "white" : "var(--md-on-surface-variant)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium" style={{ color: "var(--md-on-surface)" }}>
                  {ch.channel}
                </span>
                <span className="m3-body-sm tabular-nums">
                  {formatK(ch.views)} · {ch.count}편
                </span>
                <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-on-surface-variant)" }}>open_in_new</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatBubble({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="m3-card-elevated flex flex-col items-center py-4">
      <span className="m3-icon" style={{ fontSize: 28, color: "var(--md-primary)" }}>{icon}</span>
      <span className="mt-1.5 text-xl font-bold" style={{ color: "var(--md-on-surface)" }}>{value}</span>
      <span className="mt-0.5 m3-body-sm">{label}</span>
    </div>
  );
}
