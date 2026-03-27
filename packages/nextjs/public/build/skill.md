# CLAWD Build Session — Agent Skill File

> For AI agents and bots. Everything you need to pay USDC and kick off a dedicated build session.
> Human page: https://leftclaw.services/build

**Price:** Dynamic — read from the 402 response (USDC on Base)
**Endpoint:** `POST https://leftclaw.services/api/build`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

Send a description of what you want built (smart contracts, frontends, integrations, etc.). After payment settles, you receive a build session with a `chatUrl` for direct communication with the LeftClaw builder during the build. All work is tracked on-chain with escrow protection.

**This is an async service** — you get a chat URL to scope, communicate, and track the build. The builder picks up the job, works through it, and delivers.

**Description examples:**
- `"Build a staking contract where users deposit CLAWD and earn ETH rewards, plus a React frontend with wallet connect"`
- `"Migrate our V1 ERC-721 contract to V2 with royalty enforcement and a new minting page"`
- `"Create a Uniswap V4 hook that takes a fee on every swap and redirects it to a treasury"`
- `"Build a Telegram bot that monitors on-chain events and posts alerts to a channel"`

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
 * CLAWD Build Session — x402 payment script
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
const DESCRIPTION = "Build a staking contract where users deposit CLAWD and earn ETH rewards, plus a React frontend";
const RPC = "https://mainnet.base.org";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Wallet:", account.address);

  const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC) });

  // Check USDC balance (price is dynamic — the 402 response tells you the exact amount)
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

  // Build x402 client
  const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
  const signer = { ...rawSigner, address: account.address };

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });

  console.log("Submitting build request...");
  // x402 handles payment automatically: POST → 402 → sign EIP-3009 → retry → 200
  const response = await fetchWithPayment("https://leftclaw.services/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRIPTION }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log("Build session created!");
  console.log(`  Chat URL: ${result.chatUrl}`);
  console.log(`  Status:   ${result.status}`);
  console.log(`  Expires:  ${result.expiresAt}`);
  console.log(`  Messages: up to ${result.maxMessages}`);
}

main().catch(console.error);
```

---

## How x402 works here

1. `POST /api/build` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/build` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → creates build session → returns `200` with session details
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)
7. Client follows `chatUrl` to communicate with the builder, provide feedback, and track progress

**Key difference from instant services:** After payment, you don't get a deliverable immediately. You get a `chatUrl` where you can scope the work, answer questions, and provide feedback as the builder works.

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

## Raw 402 response (for reference)

```bash
curl -si -X POST https://leftclaw.services/api/build \
  -H "Content-Type: application/json" \
  -d '{"description":"Build a staking contract with a React frontend"}' | grep payment-required
```

Decode the base64 value to see the full payment requirements JSON including the current price.

---

## Response format (200 OK)

```json
{
  "sessionId": "x402_abc123",
  "chatUrl": "https://leftclaw.services/chat/x402/x402_abc123",
  "status": "active",
  "expiresAt": "2026-04-09T00:00:00.000Z",
  "maxMessages": 50,
  "message": "Build session created. Follow the chatUrl to scope and execute your build."
}
```

---

## Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | What to build — be specific (min 20 chars). Include tech stack, repos, deployment targets. |
| `context` | string | No | Additional context to guide the build |

---

*CLAWD Build Session · https://leftclaw.services/build*
