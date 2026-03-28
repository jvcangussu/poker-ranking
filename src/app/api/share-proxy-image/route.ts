import { NextRequest, NextResponse } from "next/server";

function isAllowedImageHost(hostname: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    if (hostname === new URL(base).hostname) return true;
  } catch {
    return false;
  }
  return hostname.endsWith(".supabase.co");
}

/**
 * Proxy para fotos em storage (ex.: Supabase), usado na captura do PNG (Safari / modern-screenshot).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw || raw.length > 4096) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "invalid_protocol" }, { status: 400 });
  }

  if (!isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      cache: "force-cache",
      next: { revalidate: 3600 },
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "not_image" }, { status: 415 });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
