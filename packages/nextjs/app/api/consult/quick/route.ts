import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createJob } from "~~/lib/jobStore";
import { BASE_NETWORK, PAYMENT_ADDRESS, SERVICE_PRICES, x402Server } from "~~/lib/x402";

const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const body = await req.json();
    const { description, context } = body;

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json({ error: "Description required (minimum 10 characters)" }, { status: 400 });
    }

    const job = createJob({
      serviceType: "CONSULT_QUICK",
      description: description.trim(),
      context: context?.trim(),
      priceUsd: "$20",
    });

    return NextResponse.json({
      jobId: job.id,
      status: "queued",
      message: "Quick consultation queued. A worker bot will process it shortly.",
      poll: `/api/job/${job.id}`,
      estimatedTime: "5-15 minutes",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
};

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: SERVICE_PRICES.CONSULT_QUICK,
      network: BASE_NETWORK,
      payTo: PAYMENT_ADDRESS,
    },
    description: "Quick Consultation — 15-message focused session, returns a written build plan",
    extensions: {
      ...declareDiscoveryExtension({
        input: { description: "What you need help with", context: "optional context" },
        inputSchema: {
          properties: {
            description: { type: "string", description: "What you need help with (min 10 chars)" },
            context: { type: "string", description: "Additional context (optional)" },
          },
          required: ["description"],
        },
        bodyType: "json",
        output: {
          example: {
            jobId: "job_abc123",
            status: "queued",
            poll: "/api/job/job_abc123",
            estimatedTime: "5-15 minutes",
          },
        },
      }),
    },
  },
  x402Server,
);
