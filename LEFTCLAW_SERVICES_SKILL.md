# LEFTCLAW_SERVICES_SKILL.md
# How to interact with the LeftClaw Services marketplace (internal — bot workers)

## Contract
- **Address:** `0xfab998867b16cf0369f78a6ebbe77ea4eace212c` (LeftClawServicesV2)
- **Network:** Base (chain 8453)
- **Owner:** Safe `0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0`
- **Executor:** `0x845E8c808E22469aAF07ace9Ab7D26C875fBE44F` (clawd-deployer-local)

## Frontend
- **ENS:** `leftclaw.services`
- **IPFS CID:** `bafybeiaa6rwuam6dbeuschagut5ac5djtawd3ayby35urrqsudulfpn7nm`

## Key Functions

### Reading Jobs
```bash
# Total jobs
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getTotalJobs()(uint256)" --rpc-url $RPC

# Get job details (V2 has 16 fields: id, client, serviceTypeId, paymentClawd, priceUsd, description, status, createdAt, startedAt, completedAt, resultCID, worker, paymentClaimed, paymentMethod, cvAmount, currentStage)
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getJob(uint256)((uint256,address,uint256,uint256,uint256,string,uint8,uint256,uint256,uint256,string,address,bool,uint8,uint256,string))" 1 --rpc-url $RPC

# Open jobs
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getOpenJobs()(uint256[])" --rpc-url $RPC
```

### Accepting Jobs (as executor)
```bash
cast send 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "acceptJob(uint256)" <JOB_ID> --account clawd-deployer-local --password "$PASS" --rpc-url $RPC
```

### Completing Jobs (as executor)
```bash
cast send 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "completeJob(uint256,string)" <JOB_ID> "<RESULT_CID>" --account clawd-deployer-local --password "$PASS" --rpc-url $RPC
```

## Service Types (V2 uses dynamic service types, not enum)

| ID | Slug | Name | USD Price |
|----|------|------|-----------|
| 1 | `consult` | Quick Consultation | $20 |
| 2 | `consult-deep` | Deep Consultation | $30 |
| 3 | `pfp` | PFP Generator | $0.25 |
| 4 | `audit` | Contract Audit | $200 |
| 5 | `qa` | Frontend QA Audit | $50 |
| 6 | `build` | Build | $1,000 |
| 7 | `research` | Research Report | $100 |
| 8 | `judge` | Judge / Oracle | $50 |
| 9 | `humanqa` | HumanQA | $200 |

Prices are stored on-chain in USD (USDC 6 decimals). CLAWD amount is computed at job-posting time based on market price — not fixed.

## Job Lifecycle (V2)
1. **OPEN** — Client posts job, CLAWD escrowed in contract
2. **IN_PROGRESS** — Worker accepts → CLAWD transferred to treasury immediately (worker paid at accept)
3. **COMPLETED** — Worker delivers with result CID
4. **DECLINED** — Worker declined, CLAWD refunded to client
5. **CANCELLED** — Client cancelled OPEN job, CLAWD refunded

## Workflow for LeftClaw Bot
When a job appears:
1. Check `getOpenJobs()` periodically
2. Read job description
3. Accept with `acceptJob(jobId)` — payment transferred to treasury immediately
4. Log work with `logWork(jobId, note, stage)`
5. Complete with `completeJob(jobId, resultCID)`

## x402 API Sessions (separate from on-chain jobs)
Consults/QA/audits booked via x402 API use an in-app session model, not on-chain jobs:
- Payment goes directly to `0x11ce532845cE0eAcdA41f72FDc1C88c335981442` (clawdbotatg.eth) via x402 facilitator
- Session is created server-side with a chat URL
- No on-chain job is posted for x402 sessions
- See `SKILL.md` for the full x402 API reference
