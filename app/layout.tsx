import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "데이터 마이닝 · 왜 이 키워드가 뜨고 있을까",
  description: "네이버·YouTube·DataLab으로 키워드 급등의 원인을 가설 + 근거 기반으로 마이닝합니다. AI가 데이터를 읽고 검색 트렌드 변화 원인을 찾아줍니다.",
  keywords: ["데이터 마이닝", "키워드 분석", "네이버 트렌드", "YouTube 분석", "검색 트렌드"],
  openGraph: {
    title: "데이터 마이닝 · 왜 이 키워드가 뜨고 있을까",
    description: "네이버·YouTube·DataLab으로 키워드 급등의 원인을 가설 + 근거 기반으로 마이닝합니다.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen" style={{ background: "var(--md-surface)" }}>
        {/* Skip to content (a11y) */}
        <a href="#main-content" className="skip-to-content">
          본문으로 건너뛰기
        </a>

        {/* M3 Top App Bar */}
        <header
          className="sticky top-0 z-50"
          role="banner"
          style={{
            background: "var(--md-surface-container)",
            borderBottom: "1px solid var(--md-outline-variant)",
            boxShadow: "var(--md-elevation-1)",
          }}
        >
          <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 md:gap-4 md:px-5 md:py-3" aria-label="메인 네비게이션">
            <Link href="/" className="flex items-center gap-1.5 no-underline shrink-0 md:gap-2.5" aria-label="데이터 마이닝 홈">
              <span className="m3-icon" aria-hidden="true" style={{ fontSize: 22, color: "var(--md-primary)" }}>
                query_stats
              </span>
              <span className="text-sm font-semibold tracking-tight max-[480px]:hidden md:text-base" style={{ color: "var(--md-on-surface)" }}>
                데이터 마이닝
              </span>
            </Link>

            {/* 탭 네비 — 모바일에서 아이콘만, 데스크탑에서 아이콘+텍스트 */}
            <div className="ml-auto flex items-center gap-0.5 md:ml-6 md:gap-1" role="tablist" aria-label="분석 메뉴">
              <NavTab href="/" icon="search_insights" label="키워드 분석" />
              <NavTab href="/youtube" icon="smart_display" label="YouTube 분석" />
              <NavTab href="/lab" icon="psychology" label="실험실" />
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/legacy/topics"
                className="m3-body-sm opacity-50 transition hover:opacity-100 no-underline"
                aria-label="레거시 토픽 페이지"
              >
                legacy
              </Link>
            </div>
          </nav>
        </header>

        <main id="main-content" className="mx-auto max-w-6xl px-5 py-8 max-md:px-4 max-md:py-5" role="main">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavTab({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      title={label}
      className="flex items-center gap-1 rounded-m3-md px-2 py-2 text-xs font-medium no-underline transition md:gap-1.5 md:px-3 md:text-sm"
      style={{ color: "var(--md-on-surface-variant)" }}
    >
      <span className="m3-icon-sm" aria-hidden="true">{icon}</span>
      <span className="max-[480px]:hidden">{label}</span>
    </Link>
  );
}
