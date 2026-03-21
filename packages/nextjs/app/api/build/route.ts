import { NextRequest, NextResponse } from "next/server";
import { withX402Dynamic } from "~~/lib/x402-next-adapter";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createSession } from "~~/lib/sessionStore";
import { BASE_NETWORK, PAYMENT_ADDRESS, getContractPriceUsd, x402Server } from "~~/lib/x402";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://leftclaw.services";

const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const body = await req.json();
    const { description, context } = body;

    if (!description || typeof description !== "string" || description.trim().length < 20) {
      return NextResponse.json(
        { error: "Description required (min 20 chars) — be specific about what to build. This is a full day of work." },
        { status: 400 },
      );
    }

    const session = await createSession({
      serviceType: "BUILD_DAILY",
      description: description.trim(),
      context: context?.trim(),
      priceUsd: "$1000",
    });

    return NextResponse.json({
      sessionId: session.id,
      chatUrl: `${APP_URL}/chat/x402/${session.id}`,
      status: "active",
      expiresAt: session.expiresAt,
      maxMessages: session.maxMessages,
      message: "Build session created. Follow the chatUrl to scope and execute your build.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
};

export const POST = withX402Dynamic(
  handler,
  (price) => ({
    accepts: {
      scheme: "exact",
      price,
      network: BASE_NETWORK,
      payTo: PAYMENT_ADDRESS,
    },
    description: "Full Day Build — A dedicated day of building whatever you need",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          description: "What to build (be specific — this is a full day of work)",
          context: "optional context",
        },
        inputSchema: {
          properties: {
            description: {
              type: "string",
              description: "What to build — be specific (min 20 chars)",
            },
            context: { type: "string", description: "Additional context (optional)" },
          },
          required: ["description"],
        },
        bodyType: "json",
        output: {
          example: {
            sessionId: "x402_abc123",
            chatUrl: "https://leftclaw.services/chat/x402/x402_abc123",
            status: "active",
            expiresAt: "2026-03-28T18:00:00.000Z",
            maxMessages: 50,
          },
        },
      }),
    },
  }),
  () => getContractPriceUsd(5),
  x402Server,
);
