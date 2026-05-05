import { InvestigateForm } from "@/components/InvestigateForm";

const EXAMPLES = [
  "스타벅스", "물냉면", "손흥민", "마인크래프트",
  "BTS", "치킨", "아이유", "경주 여행", "김밥",
  "물냉면, 비빔냉면",
  "치킨, 피자, 햄버거",
  "아메리카노, 라떼",
];

export default function Home() {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="m3-headline-sm flex items-center gap-2">
          <span className="m3-icon" style={{ fontSize: 28 }}>search_insights</span>
          왜 이 키워드가 뜨고 있을까?
        </h1>
        <p className="m3-body-md max-w-2xl">
          궁금한 키워드를 넣으면 <b style={{ color: "var(--md-primary)" }}>네이버와 YouTube</b>에서
          자료를 모아 <b>왜 검색이 늘었는지</b> 데이터로 알려줍니다.
        </p>
        <details className="m3-card-outlined" style={{ borderRadius: "var(--md-radius-md)" }}>
          <summary className="cursor-pointer m3-title-sm flex items-center gap-2">
            <span className="m3-icon-sm" style={{ color: "var(--md-primary)" }}>info</span>
            어떤 데이터를 쓰나요?
          </summary>
          <ul className="mt-3 space-y-2 pl-1 m3-body-sm">
            <li className="flex items-start gap-2">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>trending_up</span>
              <span><b>검색 트렌드</b> — 네이버 데이터랩에서 검색량 변화를 가져옵니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>newspaper</span>
              <span><b>뉴스와 블로그</b> — 네이버에서 관련 기사와 글을 모읍니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>smart_display</span>
              <span><b>YouTube 영상</b> — 관련 영상과 댓글 반응을 확인합니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>psychology</span>
              <span><b>AI 분석</b> — 모은 자료를 AI가 읽고 원인을 찾아줍니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="m3-icon-sm" style={{ fontSize: 16, color: "var(--md-primary)" }}>calendar_month</span>
              <span><b>시즌 감지</b> — 추석, 복날, 수능 등 특별한 날을 자동으로 인식합니다</span>
            </li>
          </ul>
        </details>
      </header>

      <InvestigateForm examples={EXAMPLES} />
    </div>
  );
}
