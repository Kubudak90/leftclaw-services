import { NextRequest, NextResponse } from "next/server";
import { getJobPlanCount } from "~~/lib/sessionStore";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const count = await getJobPlanCount(jobId);
  return NextResponse.json({ planGenerations: count });
}
