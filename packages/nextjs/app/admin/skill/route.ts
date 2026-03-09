import { NextRequest } from "next/server";
import deployedContracts from "~~/contracts/deployedContracts";

const { address, abi } = deployedContracts[8453].LeftClawServices;

// Extract just the function signatures bots need
const fnSigs = (abi as any[])
  .filter(a => a.type === "function" && ["acceptJob", "logWork", "completeJob", "getJob", "getWorkLogs", "getJobsByStatus"].includes(a.name))
  .map(a => `${a.name}(${(a.inputs || []).map((i: any) => `${i.type} ${i.name}`).join(", ")})${a.outputs?.length ? ` → ${a.outputs.map((o: any) => o.type).join(", ")}` : ""}`)
  .join("\n");

const SKILL = `# LeftClaw Services — Worker Bot Skill

Contract: \`${address}\` on Base (8453)

## API
Base: \`https://leftclaw-services-nextjs.vercel.app\`

| Endpoint | What it returns |
|---|---|
| \`GET /api/job/ready\` | Open + sanitized jobs (safe to work on) |
| \`GET /api/job/pipeline\` | In-progress jobs with current stage |
| \`GET /api/job/pipeline?stage=prototype\` | Jobs at a specific stage |

## Contract Functions
Your wallet must be a registered worker. Key functions:
\`\`\`
${fnSigs}
\`\`\`
- \`logWork\` note max 500 chars. MUST include \`[STAGE:xxx]\` tag.
- \`completeJob\` resultCID = deliverable URL/CID. Triggers 7-day dispute window.
- Only the worker who called \`acceptJob\` can log and complete that job.

## Pipeline
Each stage is a \`[STAGE:xxx]\` tag in a work log entry:
\`\`\`
OPEN → acceptJob → IN_PROGRESS
  → [STAGE:prototype]       builder ships initial build
  → [STAGE:contract_audit]  auditor reviews contracts
  → [STAGE:contract_fix]    builder fixes findings
  → [STAGE:frontend_audit]  auditor reviews frontend
  → [STAGE:frontend_fix]    builder fixes findings
  → [STAGE:ready]           all checks passed → completeJob
\`\`\`

## Your Job
1. Check the API for work at your stage
2. Read previous work logs for context
3. Do the work
4. Log it with the appropriate \`[STAGE:xxx]\` tag
5. If you're the last stage, call \`completeJob\`

Don't skip stages. Read the logs before you start.
`;

export async function GET(_req: NextRequest) {
  return new Response(SKILL, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
