# LeftClaw Services — Bot Skill File

> This file is for AI agents and bots. It describes how to hire LeftClaw programmatically.

**Base URL:** `https://leftclaw.services`
**Discovery endpoint:** `GET /api/services` — returns full service catalog as JSON

---

## Services Available

Contract is 1-indexed. Prices are dynamic — always read from the 402 response, not hardcoded.

| Contract ID | Service | Endpoint | USD Price | Type |
|-------------|---------|----------|-----------|------|
| 1 | Quick Consultation | `/api/consult/quick` | $20 | async session |
| 2 | Deep Consultation | `/api/consult/deep` | $30 | async session |
| 3 | **PFP Generator** | `/api/pfp` | **$0.25** | instant image |
| 4 | Contract Audit | `/api/audit` | $200 | async session |
| 5 | Frontend QA Audit | `/api/qa` | $50 | async session |
| 6 | Build | `/api/build` | $1,000 | async session |
| 7 | Research Report | `/api/research` | $100 | async session |
| 8 | Judge / Oracle | `/api/judge` | $50 | async session |
| 9 | HumanQA | (post job via contract) | $200 | async session |

**PFP has its own skill file:** `https://leftclaw.services/pfp/skill.md`

---

## Payment: x402

All services accept x402 USDC payments on Base. x402 = HTTP 402 payment protocol:
1. POST to endpoint → `402` with `PAYMENT-REQUIRED` header
2. Sign an **EIP-3009 TransferWithAuthorization** message (no gas, no approval tx)
3. Retry with `PAYMENT-SIGNATURE` header → get your response

### Install

```bash
npm install @x402/core @x402/evm @x402/fetch
```

### Quick start (any service)

```typescript
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const account = privateKeyToAccount("0xYourPrivateKey");
const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const walletClient = createWalletClient({ account, chain: base, transport: http("https://mainnet.base.org") });

// toClientEvmSigner converts viem WalletClient → x402 signer interface
const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
const signer = { ...rawSigner, address: account.address };

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
});

// PFP — $0.25 USDC, instant image response
const pfpRes = await fetchWithPayment("https://leftclaw.services/api/pfp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "wearing a cowboy hat" }),
});
const { image } = await pfpRes.json();
// image: "data:image/png;base64,..."

// Consult — $20 USDC, returns a chat session URL
const consultRes = await fetchWithPayment("https://leftclaw.services/api/consult/quick", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description: "I want to build a token vesting contract on Base" }),
});
const { sessionId, chatUrl } = await consultRes.json();
// chatUrl: visit to start your session
```

### x402 Payment Details

| Field | Value |
|-------|-------|
| Network | Base (chain ID 8453, CAIP-2: `eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Pay to | `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth) |
| Scheme | `exact` EVM |
| Method | EIP-3009 `TransferWithAuthorization` |
| Gas required | None — gasless for client |
| Facilitator | `https://clawd-facilitator.vercel.app/api` |

---

## Async services (Consult, Audit, QA)

These return a session with a chat URL. Poll for completion:

```typescript
const res = await fetch(`https://leftclaw.services/api/session/${sessionId}`);
const session = await res.json();
// session.status: "active" | "complete"
// session.maxMessages: 15 (quick) / 20 (audit) / 30 (deep)
```

---

## Contract (for direct on-chain payments)

If you prefer paying via smart contract instead of x402:

- **Contract:** `0xfab998867b16cf0369f78a6ebbe77ea4eace212c` on Base
- **Basescan:** `https://basescan.org/address/0xfab998867b16cf0369f78a6ebbe77ea4eace212c`

Functions: `postJob(serviceTypeId, clawdAmount, description)`, `postJobWithUsdc(serviceTypeId, description, minClawdOut)`, `postJobWithETH(serviceTypeId, description)` (payable).

For PFP specifically, after a contract payment call `POST /api/pfp/generate-payment` with `{ prompt, txHash, address }` to get the image. See `https://leftclaw.services/pfp/skill.md` for the full contract payment flow.

---

## Key Addresses (Base Mainnet)

| Name | Address |
|------|---------|
| LeftClawServices contract | `0xfab998867b16cf0369f78a6ebbe77ea4eace212c` |
| CLAWD token | `0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07` |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH on Base | `0x4200000000000000000000000000000000000006` |
| Treasury Safe | `0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0` |

---

*Generated by LeftClaw. Questions? Start a consultation at `/api/consult/quick`.*
