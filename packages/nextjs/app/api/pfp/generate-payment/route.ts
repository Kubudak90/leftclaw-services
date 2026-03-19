import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TREASURY_ADDRESS = "0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://leftclaw-services-nextjs.vercel.app";
const MIN_USDC = BigInt(3_800_000); // $3.80 minimum (allow slight slippage)
const MIN_ETH_USD_VALUE = 3.5; // $3.50 minimum

let baseImageCache: Buffer | null = null;
async function getBaseImage(): Promise<Buffer> {
  if (baseImageCache) return baseImageCache;
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    baseImageCache = readFileSync(join(process.cwd(), "public", "clawd-base.jpg"));
    return baseImageCache;
  } catch {
    const res = await fetch(`${APP_URL}/clawd-base.jpg`);
    if (!res.ok) throw new Error("Failed to fetch base image");
    baseImageCache = Buffer.from(await res.arrayBuffer());
    return baseImageCache;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, txHash, address: requesterAddress, paymentMethod } = await req.json();

    if (!prompt || prompt.trim().length < 3)
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash))
      return NextResponse.json({ error: "Valid txHash required" }, { status: 400 });
    if (!requesterAddress || !/^0x[0-9a-fA-F]{40}$/.test(requesterAddress))
      return NextResponse.json({ error: "Valid address required" }, { status: 400 });

    const rpcUrl = process.env.BASE_RPC_URL;
    if (!rpcUrl) return NextResponse.json({ error: "RPC not configured" }, { status: 500 });

    const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
    const [receipt, tx] = await Promise.all([
      client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
      client.getTransaction({ hash: txHash as `0x${string}` }),
    ]);

    if (!receipt || receipt.status !== "success")
      return NextResponse.json({ error: "Transaction failed or not found" }, { status: 400 });
    if (tx.from.toLowerCase() !== requesterAddress.toLowerCase())
      return NextResponse.json({ error: "Transaction sender does not match your address" }, { status: 403 });

    if (paymentMethod === "usdc") {
      const transferLog = receipt.logs.find(log => {
        if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) return false;
        if (log.topics.length < 3) return false;
        const toAddr = "0x" + log.topics[2]!.slice(26);
        return toAddr.toLowerCase() === TREASURY_ADDRESS.toLowerCase();
      });
      if (!transferLog)
        return NextResponse.json({ error: "No USDC transfer to treasury found in transaction" }, { status: 400 });
      const amount = BigInt(transferLog.data);
      if (amount < MIN_USDC)
        return NextResponse.json({ error: `Insufficient USDC. Minimum $3.80, sent ${Number(amount) / 1e6}` }, { status: 400 });
    } else if (paymentMethod === "eth") {
      if (tx.to?.toLowerCase() !== TREASURY_ADDRESS.toLowerCase())
        return NextResponse.json({ error: "ETH not sent to treasury" }, { status: 400 });
      const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const priceData = await priceRes.json();
      const ethPrice = priceData?.ethereum?.usd || 2000;
      const ethSentUsd = (Number(tx.value) / 1e18) * ethPrice;
      if (ethSentUsd < MIN_ETH_USD_VALUE)
        return NextResponse.json({ error: `Insufficient ETH. Minimum $${MIN_ETH_USD_VALUE}, sent $${ethSentUsd.toFixed(2)}` }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });

    const baseImageBuffer = await getBaseImage();
    const openai = new OpenAI({ apiKey });

    const fullPrompt = `Take this character — a red crystalline/geometric Pepe-style creature with an ethereum diamond-shaped head, wearing a black tuxedo with bow tie, holding a teacup — and modify it: ${prompt.trim()}. Keep the same art style (clean anime/cartoon illustration, white/light background, bold outlines). Keep the character recognizable but apply the requested changes. Square format, profile picture crop.`;

    const imageFile = await toFile(baseImageBuffer, "clawd-base.jpg", { type: "image/jpeg" });
    const result = await openai.images.edit({
      model: "gpt-image-1.5",
      image: imageFile,
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
    });

    const imageData = result.data?.[0];
    if (!imageData?.b64_json)
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });

    return NextResponse.json({
      image: `data:image/png;base64,${imageData.b64_json}`,
      prompt: prompt.trim(),
      txHash,
      message: "🦞 Your custom CLAWD PFP is ready!",
    });
  } catch (e: any) {
    console.error("PFP generate-payment error:", e);
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}
