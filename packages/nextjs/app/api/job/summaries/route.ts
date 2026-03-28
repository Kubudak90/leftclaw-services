import { NextRequest } from "next/server";
import { getSanitization } from "~~/lib/sanitize";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("jobIds");
  if (!raw) {
    return Response.json({ error: "jobIds query param required" }, { status: 400 });
  }

  const ids = raw.split(",").filter(Boolean).slice(0, 200);
  const summaries: Record<string, string> = {};

  await Promise.all(
    ids.map(async (id) => {
      try {
        const result = await getSanitization(id);
        if (result?.tldr) {
          summaries[id] = result.tldr;
        }
      } catch {}
    }),
  );

  return Response.json({ summaries });
}
