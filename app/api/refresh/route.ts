import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cloud Functions trigger_refresh URL
// 배포 후 firebase functions:list 로 확인한 URL 을 여기에 넣거나 env 에서 읽기
const TRIGGER_URL =
  process.env.REFRESH_TRIGGER_URL ||
  "https://asia-northeast3-jiandaddy-735c9.cloudfunctions.net/trigger_refresh";

export async function POST() {
  try {
    const r = await fetch(TRIGGER_URL, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: r.ok, ...data }, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
