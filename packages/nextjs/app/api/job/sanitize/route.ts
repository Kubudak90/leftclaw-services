import { NextRequest } from "next/server";
import { checkSanitization, deleteSanitization, getSanitization } from "~~/lib/sanitize";

export async function POST(req: NextRequest) {
  try {
    const { jobId, description, force } = await req.json();

    if (!jobId || !description) {
      return Response.json({ error: "jobId and description required" }, { status: 400 });
    }

    // Clear cached result if force re-check
    if (force) {
      await deleteSanitization(String(jobId));
    }

    // Check if already sanitized
    const existing = await getSanitization(String(jobId));
    if (existing) {
      return Response.json(existing);
    }

    const result = await checkSanitization(String(jobId), description);
    return Response.json(result);
  } catch (e) {
    console.error("Sanitize route error:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ error: "jobId required" }, { status: 400 });
  }

  const result = await getSanitization(jobId);
  if (!result) {
    return Response.json({ error: "Not yet sanitized", safe: false }, { status: 404 });
  }

  return Response.json(result);
}
