export function parseContractError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);

  // ── Wallet / network ──────────────────────────────────────────────────────
  if (/user rejected|user denied|rejected the request/i.test(msg)) return "Transaction cancelled";
  if (/insufficient funds for gas/i.test(msg)) return "Not enough ETH for gas fees";
  if (/nonce too low|nonce has already been used/i.test(msg)) return "Transaction already processed — try refreshing";
  if (/transaction underpriced/i.test(msg)) return "Gas price too low — try again";

  // ── ERC-20 (OpenZeppelin v5 selectors + name fallback) ────────────────────
  if (/e450d38c|InsufficientBalance/i.test(msg))    return "Insufficient CLAWD balance";
  if (/fb8f41b2|InsufficientAllowance/i.test(msg))  return "Allowance too low — try approving again";
  if (/96c6fd1e|ERC20InvalidSender/i.test(msg))     return "Invalid token sender address";
  if (/ec442f05|ERC20InvalidReceiver/i.test(msg))   return "Invalid token receiver address";
  if (/e602df05|ERC20InvalidApprover/i.test(msg))   return "Invalid token approver address";
  if (/5274afe7|SafeERC20FailedOperation/i.test(msg)) return "Token transfer failed";

  // ── Access control ────────────────────────────────────────────────────────
  if (/118cdaa7|OwnableUnauthorizedAccount/i.test(msg)) return "Not authorized — owner only";
  if (/1e4fbdf7|OwnableInvalidOwner/i.test(msg))        return "Invalid owner address";
  if (/3ee5aeb5|ReentrancyGuardReentrantCall|ReentrantCall/i.test(msg)) return "Reentrant call — please try again";
  if (/Not an executor/i.test(msg))                     return "Only the assigned executor can do this";

  // ── Job state ─────────────────────────────────────────────────────────────
  if (/Job does not exist/i.test(msg))           return "Job not found";
  if (/Job not OPEN/i.test(msg))                 return "This job is no longer open";
  if (/Job not IN_PROGRESS/i.test(msg))          return "This job is not currently in progress";
  if (/Job not COMPLETED/i.test(msg))            return "This job has not been completed yet";
  if (/Job not DISPUTED/i.test(msg))             return "This job is not in dispute";
  if (/Job not claimable/i.test(msg))            return "Payment cannot be claimed yet";
  if (/Not the assigned executor/i.test(msg))    return "Only the assigned executor can do this";
  if (/Not the executor/i.test(msg))             return "Only the executor can claim payment";
  if (/Not the client/i.test(msg))               return "Only the job client can do this";
  if (/Already claimed|Payment already claimed/i.test(msg)) return "Payment has already been claimed";
  if (/Can only cancel OPEN jobs/i.test(msg))    return "You can only cancel jobs that are still open";
  if (/Dispute window active/i.test(msg))        return "Dispute window is still open — executor must wait to claim";
  if (/Dispute timeout not reached/i.test(msg))  return "30-day dispute timeout hasn't passed yet";
  if (/Dispute window expired/i.test(msg))       return "Dispute window has expired — you can no longer dispute this job";

  // ── Validation ────────────────────────────────────────────────────────────
  if (/Description required/i.test(msg))                return "A description is required";
  if (/Service price not set/i.test(msg))                return "This service type has no price configured";
  if (/Use postJobCustom for CUSTOM/i.test(msg))         return "Use the Custom Amount option for custom jobs";
  if (/Min 1 CLAWD/i.test(msg))                          return "Minimum custom amount is 1 CLAWD";
  if (/USDC amount must be > 0/i.test(msg))              return "USDC amount must be greater than zero";
  if (/Not a consultation job/i.test(msg))                return "This function is only for consultation jobs";
  if (/Gist URL required/i.test(msg))                    return "A gist URL is required to complete the consultation";
  if (/Result CID required/i.test(msg))                  return "A result reference is required";
  if (/Fee too high/i.test(msg))                         return "Fee exceeds maximum allowed";
  if (/No tokens to withdraw/i.test(msg))                return "No tokens available to withdraw";
  if (/No surplus CLAWD to withdraw/i.test(msg))         return "No surplus CLAWD — all tokens are locked in active jobs";
  if (/No fees to withdraw/i.test(msg))                  return "No accumulated fees to withdraw";
  if (/Zero address/i.test(msg))                         return "Invalid address";

  // ── Fallback: extract quoted revert reason if present ────────────────────
  const revertMatch = msg.match(/reverted[^"']*["']([^"']{3,80})["']/i);
  if (revertMatch) return revertMatch[1];

  return "Transaction failed — please try again";
}
