import { YouTubeAnalyzer } from "@/components/YouTubeAnalyzer";

export const metadata = { title: "YouTube 영상 분석 · 데이터 마이닝" };

export default function YouTubePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="m3-headline-sm flex items-center gap-2">
          <span className="m3-icon" style={{ fontSize: 28 }}>smart_display</span>
          YouTube 영상 분석
        </h1>
        <p className="m3-body-md max-w-2xl">
          유튜브 링크를 넣으면 영상 내용을 요약하고, 댓글을 수집해
          <b style={{ color: "var(--md-primary)" }}> 감정 분석 + 핵심 키워드 워드맵</b>을 보여줍니다.
        </p>
      </header>
      <YouTubeAnalyzer />
    </div>
  );
}
