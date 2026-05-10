"use client";

import { useState } from "react";

interface Props {
  onSubmit: (keyword: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function LabKeywordInput({ onSubmit, loading = false, placeholder = "키워드를 입력하세요" }: Props) {
  const [keyword, setKeyword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw || loading) return;
    onSubmit(kw);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative flex-1">
        <span
          className="m3-icon-sm absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--md-on-surface-variant)", fontSize: 18 }}
        >
          search
        </span>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition disabled:opacity-50"
          style={{
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface)",
            border: "1px solid var(--md-outline-variant)",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !keyword.trim()}
        className="m3-btn-filled flex items-center gap-1.5 text-sm disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="m3-icon-sm animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
            분석 중...
          </>
        ) : (
          <>
            <span className="m3-icon-sm" style={{ fontSize: 16 }}>science</span>
            실험 시작
          </>
        )}
      </button>
    </form>
  );
}
