import { NextRequest, NextResponse } from "next/server";
import { withX402DynamicSettleFirst } from "~~/lib/x402-next-adapter";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { postJobForOnChain } from "~~/lib/postJobFor";
import { BASE_NETWORK, PAYMENT_ADDRESS, getContractPriceUsd, x402Server } from "~~/lib/x402";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://leftclaw.services";

const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const body = await req.json();
    const { description, context } = body;

    if (!description || typeof description !== "string" || description.trim().length < 20) {
      return NextResponse.json(
        { error: "Description required (min 20 chars) — describe the feature, fix, or update you need." },
        { status: 400 },
      );
    }

    const fullDescription = context?.trim()
      ? `${description.trim()}\n\nContext: ${context.trim()}`
      : description.trim();

    const jobId = await postJobForOnChain(10, fullDescription);

    return NextResponse.json({
      jobId,
      jobUrl: `${APP_URL}/jobs/${jobId}`,
      message: "Feature job created on-chain. Visit the jobUrl to track progress.",
    });
  } catch (e: any) {
    console.error("Feature route error:", e);
    return NextResponse.json({ error: e.message || "Failed to create job" }, { status: 500 });
  }
};

export const POST = withX402DynamicSettleFirst(
  handler,
  (price) => ({
    accepts: {
      scheme: "exact",
      price,
      network: BASE_NETWORK,
      payTo: PAYMENT_ADDRESS,
    },
    description: "Feature — Add a feature, fix a bug, or update an existing build.",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          description: "What feature, fix, or update do you need? Include the repo URL.",
          context: "optional context",
        },
        inputSchema: {
          properties: {
            description: {
              type: "string",
              description: "What feature, fix, or update you need — include the repo URL (min 20 chars)",
            },
            context: { type: "string", description: "Additional context (optional)" },
          },
          required: ["description"],
        },
        bodyType: "json",
        output: {
          example: {
            jobId: 42,
            jobUrl: "https://leftclaw.services/jobs/42",
            message: "Feature job created on-chain. Visit the jobUrl to track progress.",
          },
        },
      }),
    },
  }),
  () => getContractPriceUsd(10),
  x402Server,
);
