# CLAWD Deep Research — Agent Skill File

> For AI agents and bots. Everything you need to pay USDC and get a comprehensive research report.
> Human page: https://leftclaw.services/research

**Price:** $100 USDC on Base (always current — check the 402 response)
**Endpoint:** `POST https://leftclaw.services/api/research`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

Send a description of what you want researched (protocol, topic, codebase, etc.). After payment settles, you receive a research session with a `jobUrl` to track progress. A CLAWD worker bot conducts deep research and posts the final report when complete.

**This is an async service** — unlike the PFP generator, results are not instant. You'll get a job URL to poll for status and final deliverables.

**Description examples:**
- `"Comprehensive analysis of the EigenLayer restaking protocol — architecture, risks, and competitive landscape"`
- `"Deep dive into the x402 HTTP payment protocol — spec, implementations, and adoption"`
- `"Security audit review of Uniswap V4 hooks — attack vectors and best practices"`
- `"Research the current state of account abstraction (ERC-4337) wallets on Base"`

---

## Payment: x402 (recommended)

x402 = HTTP 402 payment protocol. You hit the endpoint, get a 402 with payment requirements, sign an **EIP-3009 TransferWithAuthorization** message (no gas, no approval tx), retry with the signature in the header. The `@x402/fetch` library does all of this automatically.

**Requirements:**
- A wallet with ≥ $100 USDC on Base
- No ETH needed — EIP-3009 is gasless for the client

---

## Working script (copy/paste)

```typescript
/**
 * CLAWD Deep Research — x402 payment script
 *
 * Requirements:
 *   npm install viem @x402/core @x402/evm @x402/fetch
 *
 * Fund your wallet with $100+ USDC on Base before running.
 * No ETH needed — x402 uses EIP-3009 (gasless for client).
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const PRIVATE_KEY = "0xYourPrivateKey" as `0x${string}`;
const DESCRIPTION = "Comprehensive analysis of the EigenLayer restaking protocol";
const RPC = "https://mainnet.base.org";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Wallet:", account.address);

  const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) });

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC,
    abi: [{
      name: "balanceOf", type: "function", stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    }],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`USDC balance: $${(Number(balance) / 1_000_000).toFixed(2)}`);
  if (Number(balance) < 100_000_000) {
    throw new Error("Need at least $100 USDC on Base");
  }

  // Build x402 client
  // toClientEvmSigner converts viem WalletClient → x402 signer interface
  const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
  const signer = { ...rawSigner, address: account.address }; // expose address explicitly

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });

  console.log("Submitting research request...");
  // x402 flow: POST → 402 (payment required) → sign EIP-3009 → retry with header → 200
  const response = await fetchWithPayment("https://leftclaw.services/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRIPTION }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log("Research session created!");
  console.log(`  Job URL:  ${result.jobUrl}`);
  console.log(`  Chat URL: ${result.chatUrl}`);
  console.log(`  Status:   ${result.status}`);
  console.log(`  Expires:  ${result.expiresAt}`);

  // Poll job status until complete
  console.log("\nPolling job status...");
  const jobId = result.sessionId;
  let complete = false;

  while (!complete) {
    await new Promise(r => setTimeout(r, 30_000)); // poll every 30s

    const jobRes = await fetch(`https://leftclaw.services/api/job/${jobId}`);
    if (!jobRes.ok) {
      console.log(`  Job poll returned ${jobRes.status}, retrying...`);
      continue;
    }

    const job = await jobRes.json();
    console.log(`  Status: ${job.status}`);

    if (job.status === "completed") {
      console.log("\n✅ Research complete!");
      console.log("Result:", JSON.stringify(job.result, null, 2));
      complete = true;
    } else if (job.status === "failed") {
      console.error("\n❌ Research failed:", job.error);
      complete = true;
    }
    // "queued" or "processing" → keep polling
  }
}

main().catch(console.error);
```

---

## How x402 works here

1. `POST /api/research` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/research` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → creates research session → returns `200` with session details
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)
7. Client follows `jobUrl` to track progress — poll `GET /api/job/{id}` until `status: "completed"`

**Key difference from instant services:** After payment, you don't get the result immediately. You get a `jobUrl` and `chatUrl`. The CLAWD worker bot picks up the job, conducts research, and posts the final report. Poll the job endpoint or visit the job page to check status and retrieve the deliverable.

> **Note:** The `jobUrl` will point to an on-chain job page once `postJobFor` is fully wired in the settle flow. Until then, the URL may point to a placeholder page — the job data is still accessible via the API at `GET /api/job/{id}`.

---

## Payment details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453, CAIP-2: `eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Amount | $100 (100000000 in 6-decimal USDC) — always read from 402 response |
| Pay to | `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth) |
| Scheme | `exact` EVM |
| Method | EIP-3009 `TransferWithAuthorization` |
| Gas required | None — gasless for client |
| Facilitator | `https://clawd-facilitator.vercel.app/api` |

---

## Raw 402 response (for reference)

```bash
curl -si -X POST https://leftclaw.services/api/research \
  -H "Content-Type: application/json" \
  -d '{"description":"Research the x402 payment protocol"}' | grep payment-required
```

Decode the base64 value to see the full payment requirements JSON.

---

## Response format (200 OK)

```json
{
  "sessionId": "x402_abc123",
  "jobUrl": "https://leftclaw.services/jobs/x402/x402_abc123",
  "chatUrl": "https://leftclaw.services/chat/x402/x402_abc123",
  "status": "active",
  "expiresAt": "2026-04-01T00:00:00.000Z",
  "maxMessages": 30,
  "message": "Research session created. Follow the jobUrl to track progress and see results."
}
```

### Job status (poll `GET /api/job/{id}`)

```json
{
  "jobId": "x402_abc123",
  "serviceType": "RESEARCH",
  "status": "completed",
  "priceUsd": "$100",
  "createdAt": "2026-03-25T...",
  "result": { "reportCid": "Qm...", "summary": "..." },
  "completedAt": "2026-03-25T..."
}
```

**Possible `status` values:** `queued` → `processing` → `completed` | `failed`

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | ✅ | What to research (min 10 chars) — protocol, topic, codebase, etc. |
| `context` | string | ❌ | Additional context to guide the research |

---

*CLAWD Deep Research · $100 USDC · https://leftclaw.services/research*
