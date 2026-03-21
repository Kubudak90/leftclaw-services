import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";

const { address, abi } = deployedContracts[8453].LeftClawServicesV2;

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

export async function GET() {
  try {
    const nextJobId = await client.readContract({ address, abi, functionName: "nextJobId" }) as bigint;

    const ready: any[] = [];

    for (let i = 1n; i < nextJobId; i++) {
      const job = await client.readContract({ address, abi, functionName: "getJob", args: [i] }) as any;

      // Status 0 = OPEN
      if (Number(job.status) !== 0) continue;

      ready.push({
        id: Number(job.id),
        client: job.client,
        serviceTypeId: Number(job.serviceTypeId),
        description: job.descriptionCID,
        priceUsd: Number(job.priceUsd),
        paymentClawd: job.paymentClawd.toString(),
        createdAt: Number(job.createdAt),
      });
    }

    return Response.json({ jobs: ready, count: ready.length });
  } catch (e) {
    console.error("Ready jobs error:", e);
    return Response.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
