import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, PaymentMethod, CV_PRICES } from "~~/lib/payments";
import { createSession } from "~~/lib/sessionStore";
import { getContractPriceUsd } from "~~/lib/x402";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://leftclaw.services";

const VALID_SERVICES = ["CONSULT_QUICK", "CONSULT_DEEP", "QA_REPORT", "AUDIT_QUICK"] as const;
type ServiceType = (typeof VALID_SERVICES)[number];

const SERVICE_CONTRACT_IDS: Record<string, number> = {
  CONSULT_QUICK: 1,
  CONSULT_DEEP: 2,
  QA_REPORT: 5,
  AUDIT_QUICK: 4,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceType, method, wallet, signature, txHash, description, context } = body;

    // Validate service type
    if (!serviceType || !VALID_SERVICES.includes(serviceType)) {
      return NextResponse.json(
        { error: `Invalid service type. Must be one of: ${VALID_SERVICES.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate payment method
    const validMethods: PaymentMethod[] = ["cv", "clawd", "usdc", "eth"];
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid payment method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 },
      );
    }

    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
    }

    // Verify payment
    const result = await verifyPayment(serviceType as ServiceType, {
      method: method as PaymentMethod,
      wallet,
      signature,
      txHash,
    });

    if (!result.success) {
      const status = result.error?.includes("insufficient") ? 402 : 400;
      return NextResponse.json({ error: result.error, ...result.details }, { status });
    }

    // Payment verified — create session
    const contractId = SERVICE_CONTRACT_IDS[serviceType];
    const session = await createSession({
      serviceType,
      description: description?.trim() || `${serviceType.replace("_", " ")} session`,
      context: context?.trim(),
      priceUsd: contractId ? await getContractPriceUsd(contractId) : "$0",
      payerAddress: wallet,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      chatUrl: `${APP_URL}/chat/x402/${session.id}`,
      status: "active",
      expiresAt: session.expiresAt,
      maxMessages: session.maxMessages,
      payment: {
        method,
        ...result.details,
      },
    });
  } catch (e: any) {
    console.error("Payment error:", e);
    return NextResponse.json({ error: e.message || "Payment verification failed" }, { status: 500 });
  }
}

// GET — return pricing info for all services (prices read from contract)
export async function GET() {
  const services = await Promise.all(
    VALID_SERVICES.map(async s => {
      const contractId = SERVICE_CONTRACT_IDS[s];
      return {
        type: s,
        usdPrice: contractId ? await getContractPriceUsd(contractId) : "$0",
        cvPrice: CV_PRICES[s],
        methods: ["cv", "clawd", "usdc", "eth"],
      };
    }),
  );

  return NextResponse.json({ services });
}
