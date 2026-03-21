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

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json(
        { error: "Description required — what to judge/evaluate (dispute, design decision, architecture choice, etc.)" },
        { status: 400 },
      );
    }

    const session = await createSession({
      serviceType: "JUDGE",
      description: description.trim(),
      context: context?.trim(),
      priceUsd: "$50",
    });

    return NextResponse.json({
      sessionId: session.id,
      chatUrl: `${APP_URL}/chat/x402/${session.id}`,
      status: "active",
      expiresAt: session.expiresAt,
      maxMessages: session.maxMessages,
      message: "Judge session created. Follow the chatUrl to present your case.",
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
    description: "AI Judge — Impartial evaluation of disputes, design decisions, or architecture choices",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          description: "What to judge/evaluate (dispute, design decision, architecture choice, etc.)",
          context: "optional context",
        },
        inputSchema: {
          properties: {
            description: {
              type: "string",
              description: "What to judge/evaluate (dispute, design decision, architecture choice, etc.) (min 10 chars)",
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
            expiresAt: "2026-03-21T18:00:00.000Z",
            maxMessages: 20,
          },
        },
      }),
    },
  }),
  () => getContractPriceUsd(8),
  x402Server,
);
