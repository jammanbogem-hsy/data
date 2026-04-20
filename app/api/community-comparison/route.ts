import { NextResponse } from "next/server";
import { searchNaverNews, searchNaverBlog } from "@/lib/providers/naver";
import { collectVideosAndComments } from "@/lib/providers/youtube";
import { communityComparisonWithClaude } from "@/lib/providers/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { keyword, news, blogs, comments } = body as {
      keyword: string;
      news?: Array<{ title: string; description: string }>;
      blogs?: Array<{ title: string; description: string }>;
      comments?: Array<{ text: string; likeCount: number }>;
    };

    if (!keyword) {
      return NextResponse.json({ error: "keyword 필요" }, { status: 400 });
    }

    let resolvedNews = news ?? [];
    let resolvedBlogs = blogs ?? [];
    let resolvedComments = comments ?? [];

    const needsFetch =
      resolvedNews.length < 5 || resolvedBlogs.length < 5 || resolvedComments.length < 5;

    if (needsFetch) {
      const [fetchedNews, fetchedBlogs, ytResult] = await Promise.all([
        resolvedNews.length < 5
          ? searchNaverNews(keyword, 30).catch(() => [])
          : Promise.resolve([]),
        resolvedBlogs.length < 5
          ? searchNaverBlog(keyword, 25).catch(() => [])
          : Promise.resolve([]),
        resolvedComments.length < 5
          ? collectVideosAndComments(keyword, 4, 12).catch(() => ({ videos: [], comments: [] }))
          : Promise.resolve({ videos: [], comments: [] }),
      ]);
      if (resolvedNews.length < 5) resolvedNews = fetchedNews;
      if (resolvedBlogs.length < 5) resolvedBlogs = fetchedBlogs;
      if (resolvedComments.length < 5) resolvedComments = ytResult.comments;
    }

    const comparison = await communityComparisonWithClaude({
      keyword,
      news: resolvedNews,
      blogs: resolvedBlogs,
      comments: resolvedComments,
    });

    return NextResponse.json({
      comparison,
      sampleSizes: {
        news: resolvedNews.length,
        blogs: resolvedBlogs.length,
        comments: resolvedComments.length,
      },
    });
  } catch (e: unknown) {
    console.error("[community-comparison]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
