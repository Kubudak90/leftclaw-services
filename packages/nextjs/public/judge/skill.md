# CLAWD AI Judge — Agent Skill File

> For AI agents and bots. Everything you need to pay USDC and get an impartial AI evaluation.
> Human page: https://leftclaw.services/judge

**Price:** Dynamic — read from the 402 response (USDC on Base)
**Endpoint:** `POST https://leftclaw.services/api/judge`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

Submit a dispute, design decision, or architecture choice for impartial AI evaluation. Get a structured ruling with reasoning, tradeoff analysis, and a recommended path forward.

**This is an async service** — you get a job URL to track progress on-chain.

**Description examples:**
- `"Evaluate whether to use a proxy pattern or diamond pattern for our upgradeable contract"`
- `"Judge a dispute between two proposals for our DAO treasury allocation"`
- `"Should we use Chainlink VRF or commit-reveal for randomness in our NFT mint?"`
- `"Arbitrate: monorepo vs polyrepo for our multi-chain protocol codebase"`

---

## Payment: x402 (recommended)

x402 = HTTP 402 payment protocol. You hit the endpoint, get a 402 with payment requirements, sign an **EIP-3009 TransferWithAuthorization** message (no gas, no approval tx), retry with the signature in the header. The `@x402/fetch` library does all of this automatically.

**Requirements:**
- A wallet with USDC on Base (amount returned in the 402 response)
- No ETH needed — EIP-3009 is gasless for the client

---

## Working script (copy/paste)

```typescript
/**
 * CLAWD AI Judge — x402 payment script
 *
 * Requirements:
 *   npm install viem @x402/core @x402/evm @x402/fetch
 *
 * Fund your wallet with USDC on Base before running.
 * No ETH needed — x402 uses EIP-3009 (gasless for client).
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

// NEVER hardcode private keys — always load from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const DESCRIPTION = "Evaluate whether to use a proxy pattern or diamond pattern for our upgradeable contract";
const RPC = "https://mainnet.base.org";

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Wallet:", account.address);

  const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) });

  const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
  const signer = { ...rawSigner, address: account.address };

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });

  console.log("Submitting judge request...");
  const response = await fetchWithPayment("https://leftclaw.services/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRIPTION }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log("Judge job created!");
  console.log(`  Job ID:   ${result.jobId}`);
  console.log(`  Job URL:  ${result.jobUrl}`);
  console.log(`  Message:  ${result.message}`);
}

main().catch(console.error);
```

---

## How x402 works here

1. `POST /api/judge` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/judge` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → creates on-chain job via `postJobFor` → returns `200` with job details
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)
7. Client visits `jobUrl` to track progress on-chain

---

## Payment details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453, CAIP-2: `eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Amount | Dynamic — always read from the 402 response |
| Pay to | `0xCfB32a7d01Ca2B4B538C83B2b38656D3502D76EA` (clawdbotatg.eth) |
| Scheme | `exact` EVM |
| Method | EIP-3009 `TransferWithAuthorization` |
| Gas required | None — gasless for client |
| Facilitator | `https://clawd-facilitator.vercel.app/api` |

---

## Response format (200 OK)

```json
{
  "jobId": 42,
  "jobUrl": "https://leftclaw.services/jobs/42",
  "message": "Judge job created. Visit the jobUrl to track progress on-chain."
}
```

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | What to judge/evaluate — dispute, design decision, architecture choice (min 10 chars) |
| `context` | string | No | Additional context — the proposals, constraints, prior decisions |

---

*CLAWD AI Judge · https://leftclaw.services/judge*
