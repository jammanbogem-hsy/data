// YouTube Data API v3 (서버 전용)

const BASE = "https://www.googleapis.com/youtube/v3";

function key() {
  return process.env.YOUTUBE_API_KEY!;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

export interface YouTubeComment {
  videoId: string;
  text: string;
  author: string;
  likeCount: number;
  publishedAt: string;
}

export async function searchYouTube(
  query: string,
  maxResults = 10
): Promise<YouTubeVideo[]> {
  const searchUrl = `${BASE}/search?part=snippet&q=${encodeURIComponent(
    query
  )}&type=video&maxResults=${maxResults}&regionCode=KR&relevanceLanguage=ko&order=relevance&key=${key()}`;

  const r = await fetch(searchUrl);
  if (!r.ok) throw new Error(`YouTube search ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const videoIds = (data.items || []).map((it: any) => it.id.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  // 조회수/좋아요 등 통계 확보
  const statsUrl = `${BASE}/videos?part=snippet,statistics&id=${videoIds.join(
    ","
  )}&key=${key()}`;
  const sr = await fetch(statsUrl);
  const sdata = await sr.json();
  return (sdata.items || []).map((v: any) => ({
    videoId: v.id,
    title: v.snippet?.title ?? "",
    description: v.snippet?.description ?? "",
    channelTitle: v.snippet?.channelTitle ?? "",
    publishedAt: v.snippet?.publishedAt ?? "",
    viewCount: Number(v.statistics?.viewCount ?? 0),
    likeCount: Number(v.statistics?.likeCount ?? 0),
  }));
}

export async function searchYouTubeByDate(
  query: string,
  publishedAfter: string, // ISO "2025-06-15T00:00:00Z"
  publishedBefore: string,
  maxResults = 10
): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    regionCode: "KR",
    relevanceLanguage: "ko",
    order: "relevance",
    publishedAfter,
    publishedBefore,
    key: key(),
  });
  const r = await fetch(`${BASE}/search?${params}`);
  if (!r.ok) {
    console.error(`[youtube-search-by-date] HTTP ${r.status} for query="${query}"`);
    return [];
  }
  const data = await r.json();
  const videoIds = (data.items || []).map((it: any) => it.id?.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const statsUrl = `${BASE}/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${key()}`;
  const sr = await fetch(statsUrl);
  if (!sr.ok) return [];
  const sdata = await sr.json();
  return (sdata.items || []).map((v: any) => ({
    videoId: v.id,
    title: v.snippet?.title ?? "",
    description: v.snippet?.description ?? "",
    channelTitle: v.snippet?.channelTitle ?? "",
    publishedAt: v.snippet?.publishedAt ?? "",
    viewCount: Number(v.statistics?.viewCount ?? 0),
    likeCount: Number(v.statistics?.likeCount ?? 0),
  }));
}

export async function fetchComments(
  videoId: string,
  maxResults = 20
): Promise<YouTubeComment[]> {
  const url = `${BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&textFormat=plainText&key=${key()}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.items || []).map((t: any) => {
    const sn = t.snippet?.topLevelComment?.snippet;
    return {
      videoId,
      text: sn?.textDisplay ?? "",
      author: sn?.authorDisplayName ?? "",
      likeCount: Number(sn?.likeCount ?? 0),
      publishedAt: sn?.publishedAt ?? "",
    };
  });
}

export async function collectVideosAndComments(
  query: string,
  videoLimit = 8,
  commentsPerVideo = 15
): Promise<{ videos: YouTubeVideo[]; comments: YouTubeComment[] }> {
  const videos = await searchYouTube(query, videoLimit);
  const commentArrays = await Promise.all(
    videos.slice(0, videoLimit).map((v) => fetchComments(v.videoId, commentsPerVideo))
  );
  const comments = commentArrays.flat();
  return { videos, comments };
}
