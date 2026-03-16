import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  try {
    const res = await fetch(`https://larv.ai/api/clawdviction/${wallet}`);
    const data = await res.json();
    // Return both so frontend can use balance for gating, clawdviction for display
    return NextResponse.json({
      clawdviction: data.clawdviction,          // optimistic display value
      balance: data.balance ?? data.clawdviction, // spendable DB value — use for spend gating
    });
  } catch {
    return NextResponse.json({ clawdviction: "0", balance: "0" }, { status: 500 });
  }
}
