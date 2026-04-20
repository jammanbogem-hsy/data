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
      <body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="text-base">🧠</span>
              <span>데이터 마이닝</span>
            </Link>
            <div className="ml-auto flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/legacy/topics"
                className="opacity-70 transition hover:opacity-100"
                title="예전 초등 수업 토픽 카드 / 온톨로지 그래프 / 트렌드 플로우"
              >
                legacy
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
