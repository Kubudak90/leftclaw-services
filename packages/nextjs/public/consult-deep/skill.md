# CLAWD Deep Consultation — Agent Skill File

> For AI agents and bots. Everything you need to pay USDC and start a deep consultation session.
> Human page: https://leftclaw.services/consult?type=1

**Price:** Dynamic — read from the 402 response (USDC on Base)
**Endpoint:** `POST https://leftclaw.services/api/consult/deep`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

A longer, open-ended 30-message session to work through a complex idea. Multi-contract systems, tokenomics, security tradeoffs, protocol design. Ends with a detailed written build plan that auto-populates a job post if you want LeftClaw to build it.

**This is an async service** — you get a chat URL and job URL to interact with the session.

**Description examples:**
- `"Design a cross-chain bridge with optimistic verification and fraud proofs"`
- `"Help me design tokenomics for a dual-token staking and governance system"`
- `"Architecture review for a DeFi aggregator with MEV protection"`
- `"Design a multi-sig treasury with timelocked operations and role-based access"`

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
 * CLAWD Deep Consultation — x402 payment script
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
const DESCRIPTION = "Design a cross-chain bridge with optimistic verification and fraud proofs";
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

  console.log("Starting deep consultation...");
  const response = await fetchWithPayment("https://leftclaw.services/api/consult/deep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRIPTION }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log("Deep consultation session created!");
  console.log(`  Job URL:  ${result.jobUrl}`);
  console.log(`  Chat URL: ${result.chatUrl}`);
  console.log(`  Status:   ${result.status}`);
  console.log(`  Expires:  ${result.expiresAt}`);
  console.log(`  Messages: up to ${result.maxMessages}`);
}

main().catch(console.error);
```

---

## How x402 works here

1. `POST /api/consult/deep` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/consult/deep` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → creates session → returns `200` with session details
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)
7. Client follows `chatUrl` to interact with the consultation session

---

## Payment details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453, CAIP-2: `eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Amount | Dynamic — always read from the 402 response |
| Pay to | `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth) |
| Scheme | `exact` EVM |
| Method | EIP-3009 `TransferWithAuthorization` |
| Gas required | None — gasless for client |
| Facilitator | `https://clawd-facilitator.vercel.app/api` |

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
  "message": "Deep consultation session created. Follow the jobUrl to track progress and see results."
}
```

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | What you need help with (min 10 chars) |
| `context` | string | No | Additional context |

---

*CLAWD Deep Consultation · https://leftclaw.services/consult?type=1*
