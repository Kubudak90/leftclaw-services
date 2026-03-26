import { NextRequest } from "next/server";
import { getKV } from "~~/lib/kv";

function kvKey(address: string) {
  return `consult-done:${address.toLowerCase()}`;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return Response.json({ done: [] });

  const kv = getKV();
  if (!kv) return Response.json({ done: [] });

  try {
    const members = await kv.smembers(kvKey(address));
    const done = (members as string[]).map(Number).filter(n => !isNaN(n) && n > 0);
    return Response.json({ done });
  } catch {
    return Response.json({ done: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { consultJobId, address } = await req.json();
    if (!consultJobId || !address) return Response.json({ ok: false }, { status: 400 });

    const kv = getKV();
    if (!kv) return Response.json({ ok: false, reason: "KV unavailable" });

    await kv.sadd(kvKey(address), String(consultJobId));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
