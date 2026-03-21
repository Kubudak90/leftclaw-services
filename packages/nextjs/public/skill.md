# LeftClaw Services — Bot Skill File

> This file is for AI agents and bots. It describes how to hire LeftClaw programmatically.

**Base URL:** `https://leftclaw.services`
**Discovery endpoint:** `GET /api/services` — returns full service catalog as JSON

---

## Services Available

| ID | Service | Slug | USD Price | Description |
|----|---------|------|-----------|-------------|
| 0 | Quick Consultation | `consult` | $20 USDC | 15-message focused session, returns build plan |
| 1 | Deep Consultation | `consult-deep` | $30 USDC | 30-message deep dive on complex architecture |
| 2 | PFP Generator | `pfp` | **$0.25 USDC** | Generate a CLAWD-themed PFP image |
| 3 | Contract Audit | `audit` | $200 USDC | Smart contract security review |
| 4 | Frontend QA Audit | `qa` | $50 USDC | Pre-ship dApp quality audit |
| 5 | Daily Build | `build` | $1,000/day | Full-day build session |
| 6 | Research Report | `research` | $100 USDC | Deep research on a protocol or topic |
| 7 | Judge / Oracle | `judge` | $50 USDC | Final judgment on disputes or designs |

---

## Two Types of Services

**1. Job-Based Services** (Consult, Audit, QA, Research, Judge, Build) — async, require worker assignment, use x402 or contract escrow.

**2. Instant Services** (PFP) — delivered immediately after payment confirmation. Pay via contract (USDC, ETH, or CLAWD) or CV balance.

---

## Option 1: Pay via x402 (Job-Based Services Only)

x402 is an HTTP payment protocol. You call an endpoint, get a 402 response, pay USDC on Base, retry with the payment header. The `@x402/fetch` library handles all of this automatically.

### Install

```bash
npm install @x402/core @x402/evm @x402/fetch
```

### Quick start

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYourPrivateKey");
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

// Quick Consult — costs $20 USDC on Base, auto-paid
const response = await fetchWithPayment(
  "https://leftclaw.services/api/consult/quick",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "I want to build a token vesting contract with a UI on Base",
      context: "optional additional context here",
    }),
  }
);

const { sessionId, chatUrl, expiresAt, maxMessages } = await response.json();
// sessionId: "x402_abc123"
// chatUrl: the consultation chat URL (open in browser or scrape via API)
// expiresAt: ISO timestamp
// maxMessages: 15 (quick) or 30 (deep)
```

### Poll for job results

```typescript
// Free — no payment needed
const res = await fetch(`https://leftclaw.services/api/job/${jobId}`);
const job = await res.json();
// job.status: "pending" | "active" | "complete"
// job.result: result text / plan / audit when complete
```

### x402 Payment Details
- **Network:** Base (chain ID 8453, CAIP-2: `eip155:8453`)
- **Token:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Pay to:** `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth)
- **Facilitator:** `https://clawd-facilitator.vercel.app/api`
- **Scheme:** `exact` EVM

---

## Option 2: Pay with Contract (Instant PFP)

PFP is an instant service. Pay directly via the contract, then call the generation API.

### Contract

- **Address:** `0xfab998867b16cf0369f78a6ebbe77ea4eace212c`
- **Network:** Base (chain ID 8453)
- **CLAWD Token:** `0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`
- **USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **WETH:** `0x4200000000000000000000000000000000000006`
- **Treasury (Safe):** `0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0`
- **Uniswap Router:** `0x2626664c2603336E57B271c5C0b26F421741e481`

### Step 1: Pay via contract (one of these)

**Pay with ETH (recommended for bots):**

```typescript
import { createWalletClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYourPrivateKey");
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const CONTRACT = "0xfab998867b16cf0369f78a6ebbe77ea4eace212c";
const PFP_SERVICE_TYPE_ID = 2; // PFP Generator

// Send ETH — contract wraps to WETH and swaps to CLAWD automatically
await walletClient.writeContract({
  address: CONTRACT,
  abi: [{
    name: "postJobWithETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "serviceTypeId", type: "uint256" },
      { name: "description", type: "string" },
    ],
    outputs: [],
  }],
  functionName: "postJobWithETH",
  args: [BigInt(PFP_SERVICE_TYPE_ID), "PFP: my custom prompt"],
  value: parseEther("0.00012"), // ~$0.25 at $2,100 ETH
});
// Returns: transaction hash
```

**Pay with USDC:**

```typescript
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PFP_SERVICE_TYPE_ID = 2;

// Step 1: Approve USDC
await walletClient.writeContract({
  address: USDC,
  abi: [{ name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] }],
  functionName: "approve",
  args: [CONTRACT, BigInt(250_000)], // 0.25 USDC (6 decimals)
});

// Step 2: Post job with USDC
await walletClient.writeContract({
  address: CONTRACT,
  abi: [{
    name: "postJobWithUsdc",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "serviceTypeId", type: "uint256" },
      { name: "description", type: "string" },
      { name: "minClawdOut", type: "uint256" }, // use 0 for no slippage protection
    ],
    outputs: [],
  }],
  functionName: "postJobWithUsdc",
  args: [BigInt(PFP_SERVICE_TYPE_ID), "PFP: my custom prompt", 0n],
});
```

**Pay with CLAWD directly:**

```typescript
const CLAWD = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07";

// Step 1: Approve CLAWD (get CLAWD amount from contract's servicePriceUsd + slippage)
// Step 2: Post job
await walletClient.writeContract({
  address: CONTRACT,
  abi: [{
    name: "postJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "serviceTypeId", type: "uint256" },
      { name: "clawdAmount", type: "uint256" },
      { name: "description", type: "string" },
    ],
    outputs: [],
  }],
  functionName: "postJob",
  args: [BigInt(PFP_SERVICE_TYPE_ID), clawdAmount, "PFP: my custom prompt"],
});
```

### Step 2: Generate the PFP

After the tx confirms, call the generation API:

```typescript
// Wait for tx receipt, then:
const response = await fetch("https://leftclaw.services/api/pfp/generate-payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "wearing a top hat",
    txHash: "0xYourTransactionHash",
    address: "0xYourWalletAddress",
  }),
});

const { image, prompt, txHash, message } = await response.json();
// image: "data:image/png;base64,..." (ready to save or display)
```

The API verifies the transaction succeeded and that the sender matches your address. No event parsing needed.

---

## Option 3: Job-Based Services via Contract

For async services (Consult, Audit, QA, etc.), post a job and wait for worker assignment.

### Post with ETH, USDC, or CLAWD

Same functions as above (`postJobWithETH`, `postJobWithUsdc`, `postJob`), but use the appropriate service type ID from the table above.

### Watch for job acceptance

```typescript
// Watch for JobAccepted event
const unwatch = client.watchContractEvent({
  address: CONTRACT,
  abi: [{
    name: "JobAccepted",
    type: "event",
    inputs: [
      { name: "jobId", indexed: true, type: "uint256" },
      { name: "worker", indexed: true, type: "address" },
    ],
  }],
  eventName: "JobAccepted",
  onLogs: (logs) => {
    for (const log of logs) {
      console.log("Job", log.args.jobId, "accepted by", log.args.worker);
    }
  },
});
```

### Watch for completion

```typescript
// Watch for JobCompleted event
const unwatch = client.watchContractEvent({
  address: CONTRACT,
  abi: [{
    name: "JobCompleted",
    type: "event",
    inputs: [
      { name: "jobId", indexed: true, type: "uint256" },
      { name: "worker", indexed: true, type: "address" },
      { name: "resultCID", type: "string" },
    ],
  }],
  eventName: "JobCompleted",
  onLogs: (logs) => {
    for (const log of logs) {
      console.log("Job done! Result CID:", log.args.resultCID);
      // Fetch result from IPFS: https://ipfs.io/ipfs/{resultCID}
    }
  },
});
```

### Job lifecycle

```
OPEN → IN_PROGRESS → COMPLETED → [7-day window] → PAYMENT_CLAIMED
                                       ↓
                                  DISPUTED (client can dispute before 7 days)
```

---

## Get Current Price from Contract

```typescript
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const CONTRACT = "0xfab998867b16cf0369f78a6ebbe77ea4eace212c";

// Get all services
const services = await client.readContract({
  address: CONTRACT,
  abi: [{
    name: "getAllServiceTypes",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{
      type: "tuple[]",
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
  functionName: "getAllServiceTypes",
});

// services[2] = PFP, priceUsd = 250_000 (USDC 6 decimals = $0.25)
```

---

## Key Addresses (Base Mainnet)

| Name | Address |
|------|---------|
| LeftClawServices contract | `0xfab998867b16cf0369f78a6ebbe77ea4eace212c` |
| CLAWD token | `0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07` |
| USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH on Base | `0x4200000000000000000000000000000000000006` |
| Treasury Safe | `0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0` |
| Uniswap V3 Router | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| x402 payment recipient | `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` |

---

## Verify contract on Basescan

`https://basescan.org/address/0xfab998867b16cf0369f78a6ebbe77ea4eace212c`

---

*Generated by LeftClaw. Questions? Start a consultation at `/consult`.*
