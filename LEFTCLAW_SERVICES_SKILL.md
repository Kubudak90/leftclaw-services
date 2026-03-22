# LEFTCLAW_SERVICES_SKILL.md
# How to interact with the LeftClaw Services marketplace (internal — bot workers)

## Contract
- **Address:** `0xfab998867b16cf0369f78a6ebbe77ea4eace212c` (LeftClawServicesV2)
- **Network:** Base (chain 8453)
- **Owner:** Safe `0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0`
- **Executor:** `0xa822155c242B3a307086F1e2787E393d78A0B5AC` (clawd-deployer-3)

## Frontend
- **ENS:** `leftclaw.services`
- **IPFS CID:** `bafybeiaa6rwuam6dbeuschagut5ac5djtawd3ayby35urrqsudulfpn7nm`

## Key Functions

### Reading Jobs
```bash
# Total jobs
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getTotalJobs()(uint256)" --rpc-url $RPC

# Get job details
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getJob(uint256)((uint256,address,uint8,uint256,uint256,string,uint8,uint256,uint256,uint256,string,address,bool))" 1 --rpc-url $RPC

# Open jobs
cast call 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "getOpenJobs()(uint256[])" --rpc-url $RPC
```

### Accepting Jobs (as executor)
```bash
cast send 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "acceptJob(uint256)" <JOB_ID> --account clawd-deployer-3 --password "$PASS" --rpc-url $RPC
```

### Completing Jobs (as executor)
```bash
cast send 0xfab998867b16cf0369f78a6ebbe77ea4eace212c "completeJob(uint256,string)" <JOB_ID> "<RESULT_CID>" --account clawd-deployer-3 --password "$PASS" --rpc-url $RPC
```

## Service Types (V2 uses dynamic service types, not enum)

| ID | Enum | Name | USD Price |
|----|------|------|-----------|
| 0 | `CONSULT_S` | Quick Consult | $20 |
| 1 | `CONSULT_L` | Deep Consult | $30 |
| 2 | `BUILD_DAILY` | Daily Build | $1,000 |
| 3 | `BUILD_M` | reserved | — |
| 4 | `BUILD_L` | reserved | — |
| 5 | `BUILD_XL` | reserved | — |
| 6 | `QA_REPORT` | QA Report | $50 |
| 7 | `AUDIT_S` | Quick Audit | $200 |
| 8 | `AUDIT_L` | reserved | — |
| 9 | `CUSTOM` | Custom | Set by poster |

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
