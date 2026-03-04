import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { plan, jobId } = await req.json();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "GitHub token not configured" }), { status: 500 });
  }

  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      description: `LeftClaw Build Plan - Job #${jobId}`,
      public: false,
      files: { "build-plan.md": { content: plan } },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.message || "Gist creation failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ url: data.html_url }), {
    headers: { "Content-Type": "application/json" },
  });
}
