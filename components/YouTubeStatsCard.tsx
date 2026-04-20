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

  // 채널 랭킹 (조회수 기준 상위 5)
  const channelMap = new Map<string, { channel: string; views: number; count: number }>();
  for (const v of videos) {
    const ch = v.channelTitle || "(알 수 없음)";
    const prev = channelMap.get(ch) ?? { channel: ch, views: 0, count: 0 };
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
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-xl">🎬</span>
        유튜브 반응
      </h3>

      {/* 반응 수치 카드 4개 (썸트렌드 스타일) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBubble icon="📹" value={formatK(videos.length)} label="동영상 수" color="bg-cyan-50 dark:bg-cyan-950" />
        <StatBubble icon="👀" value={formatK(totalViews)} label="조회 수" color="bg-purple-50 dark:bg-purple-950" />
        <StatBubble icon="👍" value={formatK(totalLikes)} label="좋아요 수" color="bg-pink-50 dark:bg-pink-950" />
        <StatBubble icon="💬" value={formatK(comments.length)} label="댓글 수" color="bg-amber-50 dark:bg-amber-950" />
      </div>

      {/* 영향력 큰 채널 TOP 5 */}
      {topChannels.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            영향력이 큰 채널
          </h4>
          <div className="space-y-2">
            {topChannels.map((ch, i) => (
              <div key={ch.channel} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-slate-100 text-slate-600" :
                  i === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-slate-50 text-slate-500"
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                  {ch.channel}
                </span>
                <span className="text-xs tabular-nums text-slate-500">
                  {formatK(ch.views)} · {ch.count}편
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatBubble({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-xl border border-slate-200 ${color} p-4 dark:border-slate-800`}>
      <span className="text-2xl">{icon}</span>
      <span className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="mt-0.5 text-xs text-slate-500">{label}</span>
    </div>
  );
}
