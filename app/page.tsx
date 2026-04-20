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
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">왜 이 키워드가 뜨고 있을까?</h1>
          <span className="text-xs text-slate-400">v2</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          키워드를 넣으면 <b>네이버·YouTube·DataLab</b>을 자동 수집하고 Claude가
          <b> 급등 원인 가설 + 근거 + 사람들의 마음</b>을 분석합니다.
          여러 키워드를 쉼표로 넣으면 <b>비교 분석</b>까지 자동.
        </p>
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <summary className="cursor-pointer font-medium">📋 어떤 데이터를 쓰나요?</summary>
          <ul className="mt-2 space-y-1 pl-4">
            <li>• <b>검색 트렌드</b>: 네이버 데이터랩 (PC+모바일, 0-100 정규화)</li>
            <li>• <b>뉴스·블로그</b>: 네이버 검색 API (최대 100+ 건, 정확도+최신순)</li>
            <li>• <b>영상·댓글</b>: YouTube Data API (피크 기간 publishedAfter/Before)</li>
            <li>• <b>분석</b>: Claude Haiku 4.5 · 2-step 체인 (가설 → 검증)</li>
            <li>• <b>시즌 감지</b>: 추석/설/어린이날/크리스마스 등 자동 인식</li>
          </ul>
        </details>
      </header>

      <InvestigateForm examples={EXAMPLES} />
    </div>
  );
}
