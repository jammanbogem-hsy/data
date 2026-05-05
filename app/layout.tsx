import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "데이터 마이닝 · 왜 이 키워드가 뜨고 있을까",
  description: "네이버·YouTube·DataLab으로 키워드 급등의 원인을 가설 + 근거 기반으로 마이닝",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen" style={{ background: "var(--md-surface)" }}>
        {/* M3 Top App Bar */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "var(--md-surface-container)",
            borderBottom: "1px solid var(--md-outline-variant)",
            boxShadow: "var(--md-elevation-1)",
          }}
        >
          <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <span className="m3-icon" style={{ fontSize: 24, color: "var(--md-primary)" }}>
                query_stats
              </span>
              <span className="text-base font-semibold tracking-tight" style={{ color: "var(--md-on-surface)" }}>
                데이터 마이닝
              </span>
            </Link>

            {/* 탭 네비 */}
            <div className="ml-6 flex items-center gap-1">
              <NavTab href="/" icon="search_insights" label="키워드 분석" />
              <NavTab href="/youtube" icon="smart_display" label="YouTube 분석" />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Link
                href="/legacy/topics"
                className="m3-body-sm opacity-50 transition hover:opacity-100 no-underline"
              >
                legacy
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}

function NavTab({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-m3-md px-3 py-2 text-sm font-medium no-underline transition"
      style={{ color: "var(--md-on-surface-variant)" }}
    >
      <span className="m3-icon-sm">{icon}</span>
      {label}
    </Link>
  );
}
