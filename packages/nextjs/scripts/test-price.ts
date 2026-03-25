import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const SERVICE_TYPE_CONTRACT = "0xfab998867b16cf0369f78a6ebbe77ea4eace212c";

const priceCache = new Map<number, { price: string; ts: number }>();
const CACHE_TTL_MS = 60_000;

async function getContractPriceUsd(serviceTypeId: number): Promise<string> {
  const cached = priceCache.get(serviceTypeId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.price;

  const client = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const result = await client.readContract({
    address: SERVICE_TYPE_CONTRACT,
    abi: [{
      name: "getServiceType",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "id", type: "uint256" }],
      outputs: [{
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "slug", type: "string" },
          { name: "priceUsd", type: "uint256" },
          { name: "cvDivisor", type: "uint256" },
          { name: "status", type: "string" },
        ],
      }],
    }],
    functionName: "getServiceType",
    args: [BigInt(serviceTypeId)],
  });

  const rawPrice = Number(result.priceUsd) / 1_000_000;
  const price = `$${rawPrice.toFixed(2)}`;
  console.log(`[DEBUG] serviceTypeId=${serviceTypeId}, rawPrice=${rawPrice}, price="${price}"`);
  priceCache.set(serviceTypeId, { price, ts: Date.now() });
  return price;
}

async function simulateX402Parse(price: string) {
  const cleanMoney = price.replace(/^\$/, "").trim();
  const amount = parseFloat(cleanMoney);
  const decimals = 6;
  const [intPart, decPart = ""] = String(amount).split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  const tokenAmount = (intPart + paddedDec).replace(/^0+/, "") || "0";
  console.log(`[X402] price="${price}" -> cleanMoney="${cleanMoney}" -> amount=${amount} -> tokenAmount=${tokenAmount} (=$${Number(tokenAmount)/1e6})`);
  return tokenAmount;
}

async function main() {
  console.log("=== Testing Research (service type 7) ===");
  const price = await getContractPriceUsd(7);
  await simulateX402Parse(price);

  console.log("\n=== Testing PFP (service type 3) ===");
  const pfpPrice = await getContractPriceUsd(3);
  await simulateX402Parse(pfpPrice);

  console.log("\n=== Testing Audit (service type 4) ===");
  const auditPrice = await getContractPriceUsd(4);
  await simulateX402Parse(auditPrice);
}

main().catch(console.error);
