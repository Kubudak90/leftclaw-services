# CLAWD PFP Generator — Agent Skill File

> For AI agents and bots. Everything you need to generate a custom CLAWD PFP.
> Human page: https://leftclaw.services/pfp

**Price:** $0.25 USDC on Base (always current — check the 402 response)
**Endpoint:** `POST https://leftclaw.services/api/pfp`
**Payment:** x402 — sign an EIP-3009 message, no approval tx, no gas required

---

## What you get

Send a prompt describing how to modify the CLAWD mascot. Get back a 1024×1024 PNG inline as a base64 data URL. Instant delivery — no waiting, no job queue.

The character: a red crystalline/geometric Pepe-style creature with an ethereum diamond-shaped head, wearing a black tuxedo with bow tie, holding a teacup.

**Prompt examples:**
- `"wearing a cowboy hat and holding a lasso"`
- `"as a pirate captain on a ship"`
- `"in a space suit floating in orbit"`
- `"wearing sunglasses at a beach"`

---

## Payment: x402 (recommended)

x402 = HTTP 402 payment protocol. You hit the endpoint, get a 402 with payment requirements, sign an **EIP-3009 TransferWithAuthorization** message (no gas, no approval tx), retry with the signature in the header. The `@x402/fetch` library does all of this automatically.

**Requirements:**
- A wallet with ≥ $0.25 USDC on Base
- No ETH needed — EIP-3009 is gasless for the client

---

## Working script (copy/paste)

```typescript
/**
 * CLAWD PFP Generator — x402 payment script
 * 
 * Requirements:
 *   npm install viem @x402/core @x402/evm @x402/fetch
 * 
 * Fund your wallet with $0.30+ USDC on Base before running.
 * No ETH needed — x402 uses EIP-3009 (gasless for client).
 */

import { writeFileSync } from "fs";
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const PRIVATE_KEY = "0xYourPrivateKey" as `0x${string}`;
const PROMPT = "wearing a cowboy hat and holding a lasso";
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
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`USDC balance: $${(Number(balance) / 1_000_000).toFixed(2)}`);
  if (Number(balance) < 250_000) {
    throw new Error("Need at least $0.25 USDC on Base");
  }

  // Build x402 client
  // toClientEvmSigner converts viem WalletClient → x402 signer interface
  const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
  const signer = { ...rawSigner, address: account.address }; // expose address explicitly
  
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });

  console.log("Generating PFP...");
  // x402 flow: POST → 402 (payment required) → sign EIP-3009 → retry with header → 200
  const response = await fetchWithPayment("https://leftclaw.services/api/pfp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: PROMPT }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed ${response.status}: ${err}`);
  }

  const { image, message } = await response.json();
  console.log(message);

  // Save to disk
  const path = `clawd-pfp-${Date.now()}.png`;
  writeFileSync(path, Buffer.from(image.replace("data:image/png;base64,", ""), "base64"));
  console.log(`Saved → ${path}`);

  // Payment: EIP-3009 TransferWithAuthorization signed off-chain
  // Facilitator submits transferWithAuthorization on-chain — $0.25 USDC deducted async
}

main().catch(console.error);
```

---

## How x402 works here

1. `POST /api/pfp` with no payment → `402` response with `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains: amount=`250000` (USDC 6 decimals), payTo address, maxTimeoutSeconds, EIP-712 domain info
3. Client signs `TransferWithAuthorization` typed message (EIP-3009) — offline, no gas
4. Retry `POST /api/pfp` with `PAYMENT-SIGNATURE` header containing the signed payload
5. Server verifies signature via facilitator → generates image → returns `200` with base64 PNG
6. Facilitator calls `transferWithAuthorization` on USDC contract on-chain (async after response)

---

## Payment details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453, CAIP-2: `eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Amount | $0.25 (250000 in 6-decimal USDC) — always read from 402 response |
| Pay to | `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth) |
| Scheme | `exact` EVM |
| Method | EIP-3009 `TransferWithAuthorization` |
| Gas required | None — gasless for client |
| Facilitator | `https://clawd-facilitator.vercel.app/api` |

---

## Raw 402 response (for reference)

```bash
curl -si -X POST https://leftclaw.services/api/pfp \
  -H "Content-Type: application/json" \
  -d '{"prompt":"cowboy hat"}' | grep payment-required
```

Decode the base64 value to see the full payment requirements JSON.

---

## Response format (200 OK)

```json
{
  "image": "data:image/png;base64,...",
  "prompt": "wearing a cowboy hat and holding a lasso",
  "message": "🦞 Your custom CLAWD PFP is ready!"
}
```

The `image` field is a complete data URL — write it to a `.png` file or render it directly.

---

*CLAWD PFP Generator · $0.25 USDC · https://leftclaw.services/pfp*
