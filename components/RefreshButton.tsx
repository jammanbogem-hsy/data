"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        setMsg("파이프라인을 시작했습니다. 잠시 후 새 데이터가 들어옵니다.");
        startTransition(() => router.refresh());
      } else {
        setMsg(`실패: ${data.error ?? "알 수 없는 오류"}`);
      }
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{msg}</span>
      )}
      <button
        onClick={refresh}
        disabled={busy || isPending}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {busy ? "실행 중…" : "🔄 지금 갱신"}
      </button>
    </div>
  );
}
