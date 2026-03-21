import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { x402ResourceServer } from "~~/lib/x402-next-adapter";

// clawdbotatg.eth receives USDC payments on Base
export const PAYMENT_ADDRESS = "0x11ce532845cE0eAcdA41f72FDc1C88c335981442";
export const BASE_NETWORK = "eip155:8453";

// Self-hosted facilitator — Base mainnet (eip155:8453)
const facilitatorClient = new HTTPFacilitatorClient({ url: "https://clawd-facilitator.vercel.app/api" });

export const x402Server = new x402ResourceServer(facilitatorClient)
  .register(BASE_NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

// Dynamic price resolution from contract
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const SERVICE_TYPE_ABI = parseAbi([
  "function getServiceType(uint256 id) view returns ((uint256 id, string name, string slug, uint256 priceUsd, uint256 cvDivisor, string status))",
]);

const SERVICE_TYPE_CONTRACT = "0xfab998867b16cf0369f78a6ebbe77ea4eace212c" as const;

const priceCache = new Map<number, { price: string; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function getContractPriceUsd(serviceTypeId: number): Promise<string> {
  const cached = priceCache.get(serviceTypeId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.price;

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });

  const result = await client.readContract({
    address: SERVICE_TYPE_CONTRACT,
    abi: SERVICE_TYPE_ABI,
    functionName: "getServiceType",
    args: [BigInt(serviceTypeId)],
  });

  const rawPrice = Number(result.priceUsd) / 1_000_000;
  const price = `$${rawPrice.toFixed(2)}`;
  priceCache.set(serviceTypeId, { price, ts: Date.now() });
  return price;
}
