"use client";

import { useState, useCallback } from "react";

interface ShareToolbarProps {
  keyword: string;
  /** 분석 결과 영역을 감싸는 ref의 element를 반환하는 함수 */
  getExportElement?: () => HTMLElement | null;
}

export function ShareToolbar({ keyword, getExportElement }: ShareToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleShareLink = useCallback(async () => {
    // 현재 URL에 키워드 파라미터 반영 후 복사
    const url = new URL(window.location.href);
    url.searchParams.set("q", keyword);
    const shareUrl = url.toString();

    // URL도 브라우저 주소창에 반영 (히스토리 교체)
    window.history.replaceState(null, "", shareUrl);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 폴백: 옛 방식
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [keyword]);

  const handleExportImage = useCallback(async () => {
    const el = getExportElement?.();
    if (!el) return;

    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        backgroundColor: "#FAFAF5",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${keyword}-분석결과.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("이미지 저장 실패:", err);
    } finally {
      setExporting(false);
    }
  }, [keyword, getExportElement]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShareLink}
        className="m3-btn-tonal flex items-center gap-1.5 text-xs"
        title="결과 링크를 클립보드에 복사"
      >
        <span className="m3-icon-sm" style={{ fontSize: 16 }}>
          {copied ? "check" : "link"}
        </span>
        {copied ? "복사됨" : "결과 공유"}
      </button>

      {getExportElement && (
        <button
          onClick={handleExportImage}
          disabled={exporting}
          className="m3-btn-tonal flex items-center gap-1.5 text-xs disabled:opacity-50"
          title="분석 결과를 이미지로 저장"
        >
          <span className="m3-icon-sm" style={{ fontSize: 16 }}>
            {exporting ? "hourglass_top" : "image"}
          </span>
          {exporting ? "저장 중..." : "이미지로 저장"}
        </button>
      )}
    </div>
  );
}
