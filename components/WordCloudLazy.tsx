"use client";

import dynamic from "next/dynamic";
import type { WordCloudItem } from "./WordCloud";

const WordCloudInternal = dynamic(
  () => import("./WordCloud").then((mod) => ({ default: mod.WordCloud })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-m3-md"
        style={{ height: 200, background: "var(--md-surface-container-high)" }}
      >
        <span className="m3-body-sm" style={{ color: "var(--md-on-surface-variant)" }}>
          워드클라우드 로딩 중...
        </span>
      </div>
    ),
  }
);

export function WordCloudLazy(props: {
  words: WordCloudItem[];
  width?: number;
  height?: number;
  comments?: Array<{ text: string; likeCount?: number }>;
}) {
  return <WordCloudInternal {...props} />;
}
