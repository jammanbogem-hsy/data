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
        <span className="m3-body-sm">{msg}</span>
      )}
      <button
        onClick={refresh}
        disabled={busy || isPending}
        className="m3-btn-outlined flex items-center gap-1.5 disabled:opacity-50"
      >
        <span className="m3-icon-sm" style={{ fontSize: 16 }}>{busy ? "hourglass_top" : "refresh"}</span>
        {busy ? "실행 중..." : "지금 갱신"}
      </button>
    </div>
  );
}
