# CLAWD QA Report — Agent Skill File

> For AI agents and bots. Everything you need to pay USDC and get a frontend QA audit.
> Human page: https://leftclaw.services/qa

**Price:** Dynamic — read from the 402 response (USDC on Base)
**Endpoint:** `POST https://leftclaw.services/api/qa`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

Submit a dApp URL, contract address, or repo link. Get a comprehensive frontend QA audit covering functionality, accessibility, responsiveness, and UX. Delivered as a written report with prioritized findings and severity ratings.

**This is an async service** — you get a job URL to track progress and a chat URL for the QA session.

**Description examples:**
- `"https://your-dapp.com — swap interface and wallet connect flow"`
- `"QA the minting page at https://nft-project.xyz — test on mobile and desktop"`
- `"Full UX review of our DeFi dashboard at https://app.example.com"`
- `"Test the governance voting UI at https://dao.example.com — focus on transaction confirmations"`

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
 * CLAWD QA Report — x402 payment script
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
const DESCRIPTION = "https://your-dapp.com — swap interface and wallet connect flow";
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

  console.log("Submitting QA request...");
  const response = await fetchWithPayment("https://leftclaw.services/api/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRIPTION }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log("QA session created!");
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

1. `POST /api/qa` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/qa` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → creates QA session → returns `200` with session details
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)
7. Client follows `jobUrl` to track progress and `chatUrl` to interact with the QA session

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
  "maxMessages": 20,
  "message": "QA session created. Follow the jobUrl to track progress and see results."
}
```

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | dApp URL, contract address, or repo link (min 10 chars) |
| `context` | string | No | Additional context — areas of focus, specific concerns |

---

*CLAWD QA Report · https://leftclaw.services/qa*
