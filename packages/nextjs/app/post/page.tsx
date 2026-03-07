"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatUnits, parseEther, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useCLAWDPrice } from "~~/hooks/scaffold-eth/useCLAWDPrice";
import { parseContractError } from "~~/utils/parseContractError";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServices?.address as `0x${string}`;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServices?.abi;

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_CHAIN_ID = 8453;
const CV_SIGN_MESSAGE = "ClawdViction CV Spend";

const ERC20_ABI = [
  {
    name: "approve", type: "function", stateMutability: "nonpayable" as const,
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance", type: "function", stateMutability: "view" as const,
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf", type: "function", stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

type PaymentMethod = "cv" | "contract" | "usdc" | "eth";

const SERVICE_NAMES: Record<number, string> = {
  6: "QA Report",
  7: "AI Audit",
};

// CV costs per service type
const CV_PRICES: Record<number, number> = { 6: 500_000, 7: 2_000_000, 9: 0 };

export default function PostJobPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      }
    >
      <PostJobPage />
    </Suspense>
  );
}

function PostJobPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeParam = searchParams.get("type");
  const gistParam = searchParams.get("gist");
  const isCustom = typeParam === "custom";
  const rawType = typeParam ? parseInt(typeParam) : 6;
  const initialType = isCustom ? 9 : rawType >= 2 && rawType <= 5 ? 6 : rawType;

  // Consult types have their own page — redirect
  useEffect(() => {
    if (initialType === 0 || initialType === 1) {
      router.replace(`/consult?type=${initialType}`);
    }
  }, [initialType, router]);

  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const isWrongNetwork = !!address && chainId !== BASE_CHAIN_ID;

  const [serviceType, setServiceType] = useState(initialType);
  const [description, setDescription] = useState(
    gistParam ? `Build plan: ${gistParam}\n\nSee consultation plan for full scope and requirements.` : "",
  );
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cv");
  const [step, setStep] = useState<"idle" | "signing" | "approving" | "paying" | "posting" | "done">("idle");
  const postedJobIdRef = useRef<number | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [cvBalance, setCvBalance] = useState<number | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  const selectedStandard = serviceType < 9;

  const contractAddress = deployedContracts[8453]?.LeftClawServices?.address as `0x${string}` | undefined;

  const { data: priceRaw } = useScaffoldReadContract({
    contractName: "LeftClawServices",
    functionName: "servicePriceUsd",
    args: [serviceType],
  });

  const { data: nextJobId } = useScaffoldReadContract({
    contractName: "LeftClawServices",
    functionName: "nextJobId",
  });

  const clawdPrice = useCLAWDPrice();
  const priceUsdRaw = selectedStandard && priceRaw ? priceRaw : BigInt(0);
  const priceUsdNum = Number(formatUnits(priceUsdRaw, 6));
  const priceDisplay = priceUsdNum ? `$${priceUsdNum.toLocaleString()}` : "...";

  // CLAWD needed
  const clawdNeeded = selectedStandard
    ? clawdPrice && priceUsdNum ? Math.ceil(priceUsdNum / clawdPrice) : 0
    : customAmount ? Number(customAmount) : 0;
  const priceWei = clawdNeeded > 0
    ? parseUnits(Math.ceil(clawdNeeded).toString(), 18)
    : customAmount ? parseUnits(customAmount || "0", 18) : BigInt(0);

  // USDC amount
  const usdcAmount = selectedStandard ? parseUnits(priceUsdNum.toString(), 6) : BigInt(0);

  // ETH needed
  const ethNeeded = ethPrice && priceUsdNum ? priceUsdNum / ethPrice : 0;

  // CV cost
  const cvCost = selectedStandard ? (CV_PRICES[serviceType] || 500_000) : 0;

  // Custom USD for custom jobs
  const customUsdForClawd = !selectedStandard && clawdPrice && Number(customAmount) > 0
    ? Number(customAmount) * clawdPrice : 0;

  // Balances
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CLAWD_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const { data: clawdBalance } = useReadContract({
    address: CLAWD_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const needsApproval = paymentMethod === "contract" && !!address && priceWei > BigInt(0) && (allowanceRaw === undefined || allowanceRaw < priceWei);

  // Fetch CV balance
  useEffect(() => {
    if (!address) { setCvBalance(null); return; }
    fetch(`/api/cv-balance/${address}`)
      .then(r => r.json())
      .then(data => setCvBalance(Number(data.clawdviction) || 0))
      .catch(() => setCvBalance(null));
  }, [address]);

  // Fetch ETH price
  useEffect(() => {
    fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006")
      .then(r => r.json())
      .then(data => setEthPrice(parseFloat(data.pairs?.[0]?.priceUsd || "0")))
      .catch(() => {});
  }, []);

  const isInsufficient = (() => {
    if (!address) return false;
    switch (paymentMethod) {
      case "cv": return cvBalance !== null && cvCost > 0 && cvBalance < cvCost;
      case "contract": return clawdBalance !== undefined && clawdBalance < priceWei;
      case "usdc": return usdcBalance !== undefined && usdcBalance < usdcAmount;
      case "eth": return false;
      default: return false;
    }
  })();

  // Mobile wallet deep-link
  const openWallet = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.ethereum) return;
    let wcWallet = "";
    try {
      const wcKey = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
      if (wcKey) wcWallet = (localStorage.getItem(wcKey) || "").toLowerCase();
    } catch {}
    const schemes: [string[], string][] = [
      [["rainbow"], "rainbow://"], [["metamask"], "metamask://"],
      [["coinbase", "cbwallet"], "cbwallet://"], [["trust"], "trust://"],
    ];
    for (const [kws, scheme] of schemes) {
      if (kws.some(k => wcWallet.includes(k))) { window.location.href = scheme; return; }
    }
  }, []);

  const writeAndOpen = useCallback(
    <T,>(fn: () => Promise<T>): Promise<T> => { const p = fn(); setTimeout(openWallet, 2000); return p; },
    [openWallet],
  );

  const handleSubmit = async () => {
    if (!description.trim() || !contractAddress || !address) return;
    setTxError(null);

    try {
      const jobDesc = description.trim();

      if (paymentMethod === "cv") {
        // CV: sign + spend off-chain, then post on-chain (gas only)
        if (!walletClient) throw new Error("Wallet not connected");
        if (!selectedStandard) throw new Error("CV not available for custom jobs");
        setStep("signing");

        const sigKey = `cv-sig-${address.toLowerCase()}`;
        let signature = localStorage.getItem(sigKey);
        if (!signature) {
          signature = await walletClient.signMessage({ message: CV_SIGN_MESSAGE });
          localStorage.setItem(sigKey, signature);
        }

        const spendRes = await fetch("/api/cv-spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: address, signature, amount: cvCost }),
        });
        const spendData = await spendRes.json();
        if (!spendRes.ok) throw new Error(spendData.error || "CV spend failed");

        postedJobIdRef.current = nextJobId ? Number(nextJobId) : null;
        setStep("posting");
        const txHash = await writeAndOpen(() => writeContractAsync({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
          functionName: "postJobWithCV", args: [serviceType, BigInt(cvCost), jobDesc],
        }));
        if (!txHash) { setTxError("Transaction failed"); setStep("idle"); return; }
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
        setStep("done");

      } else if (paymentMethod === "contract") {
        // CLAWD: approve + postJob / postJobCustom
        if (needsApproval) {
          setStep("approving");
          await writeAndOpen(() => writeContractAsync({
            address: CLAWD_ADDRESS, abi: ERC20_ABI, functionName: "approve",
            args: [contractAddress, priceWei],
          }));
          let ok = false;
          for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 1500));
            const { data } = await refetchAllowance();
            if (data !== undefined && data >= priceWei) { ok = true; break; }
          }
          if (!ok) { setTxError("Approval didn't confirm — try again"); setStep("idle"); return; }
        }

        postedJobIdRef.current = nextJobId ? Number(nextJobId) : null;
        setStep("posting");
        let txHash;
        if (selectedStandard) {
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJob", args: [serviceType, priceWei, jobDesc],
          }));
        } else {
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJobCustom", args: [priceWei, BigInt(0), jobDesc],
          }));
        }
        if (!txHash) { setTxError("Transaction failed"); setStep("idle"); return; }
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
        setStep("done");

      } else if (paymentMethod === "eth") {
        // ETH: wraps → WETH → CLAWD on-chain
        if (!ethPrice || ethNeeded <= 0) throw new Error("ETH price not loaded");
        postedJobIdRef.current = nextJobId ? Number(nextJobId) : null;
        setStep("paying");
        const ethWei = parseEther((ethNeeded * 1.05).toFixed(18));

        let txHash;
        if (selectedStandard) {
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJobWithETH", args: [serviceType, jobDesc],
            value: ethWei,
          }));
        } else {
          const customPriceUsd = parseUnits(Math.ceil(customUsdForClawd).toString(), 6);
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJobCustomETH", args: [customPriceUsd, jobDesc],
            value: ethWei,
          }));
        }
        if (!txHash) { setTxError("Transaction failed"); setStep("idle"); return; }
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
        setStep("done");

      } else if (paymentMethod === "usdc") {
        // USDC: approve + postJobWithUsdc / postJobCustomUsdc
        postedJobIdRef.current = nextJobId ? Number(nextJobId) : null;
        setStep("approving");

        const usdcAmt = selectedStandard ? usdcAmount : parseUnits(customAmount || "0", 6);
        await writeAndOpen(() => writeContractAsync({
          address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
          args: [contractAddress, usdcAmt],
        }));
        let approveOk = false;
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const bal = await publicClient?.readContract({
            address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
            args: [address, contractAddress],
          });
          if (bal !== undefined && (bal as bigint) >= usdcAmt) { approveOk = true; break; }
        }
        if (!approveOk) { setTxError("USDC approval didn't confirm"); setStep("idle"); return; }

        setStep("posting");
        let txHash;
        if (selectedStandard) {
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJobWithUsdc", args: [serviceType, jobDesc, BigInt(1)],
          }));
        } else {
          txHash = await writeAndOpen(() => writeContractAsync({
            address: CONTRACT_ADDRESS, abi: CONTRACT_ABI as any,
            functionName: "postJobCustomUsdc", args: [usdcAmt, jobDesc, BigInt(1)],
          }));
        }
        if (!txHash) { setTxError("Transaction failed"); setStep("idle"); return; }
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
        setStep("done");
      }
    } catch (e: any) {
      console.error(e);
      setTxError(parseContractError(e) || e?.message || "Something went wrong");
      setStep("idle");
    }
  };

  const busy = step === "approving" || step === "posting" || step === "signing" || step === "paying";

  const costDisplay = () => {
    if (!selectedStandard && paymentMethod === "cv") return "N/A";
    switch (paymentMethod) {
      case "cv": return `${cvCost.toLocaleString()} CV`;
      case "contract": return clawdNeeded > 0 ? `~${clawdNeeded.toLocaleString()} CLAWD` : "...";
      case "usdc": return selectedStandard ? `$${priceUsdNum.toFixed(2)} USDC` : customAmount ? `$${customAmount} USDC` : "...";
      case "eth": return ethNeeded > 0 ? `~${ethNeeded.toFixed(6)} ETH` : "...";
    }
  };

  const balanceDisplay = () => {
    switch (paymentMethod) {
      case "cv": return cvBalance !== null ? `${cvBalance.toLocaleString()} CV` : "—";
      case "contract": return clawdBalance !== undefined ? `${Number(clawdBalance / BigInt(10) ** BigInt(18)).toLocaleString()} CLAWD` : "—";
      case "usdc": return usdcBalance !== undefined ? `$${(Number(usdcBalance) / 1e6).toFixed(2)} USDC` : "—";
      case "eth": return "Check wallet";
    }
  };

  const buttonLabel = () => {
    if (step === "signing") return "Sign message in wallet...";
    if (step === "approving") return paymentMethod === "usdc" ? "Approving USDC..." : "Approving CLAWD...";
    if (step === "paying") return "Confirm payment...";
    if (step === "posting") return "Posting job...";
    if (needsApproval) return "Approve & Post Job 🦞";
    const labels: Record<PaymentMethod, string> = {
      cv: `⚡ Spend ${cvCost.toLocaleString()} CV & Post`,
      contract: `🔥 Lock ${costDisplay()} & Post`,
      usdc: `💵 Pay ${costDisplay()} & Post`,
      eth: `⟠ Pay ${costDisplay()} & Post`,
    };
    return labels[paymentMethod];
  };

  // Custom jobs can't use CV
  const cvDisabled = !selectedStandard;

  if (step === "done") {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-4">Job Posted!</h1>
        <p className="opacity-70 mb-8">
          Your job has been posted on-chain. LeftClaw will review and accept it shortly.
        </p>
        <Link
          href={postedJobIdRef.current !== null ? `/jobs/${postedJobIdRef.current}` : "/jobs"}
          className="btn btn-primary btn-lg"
        >
          View My Job →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <h1 className="text-3xl font-bold mb-2">🦞 Post a Job</h1>
      <p className="opacity-70 mb-8">Describe what you need built, audited, or consulted on.</p>

      <div className="w-full max-w-lg">
        {/* Consultation badge */}
        {gistParam && (
          <div className="alert alert-info mb-4">
            <span>
              📋 Based on your consultation —{" "}
              <a href={gistParam} target="_blank" rel="noopener noreferrer" className="link">
                view plan
              </a>
            </span>
          </div>
        )}

        {/* Service Type */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-bold">Service Type</span>
          </label>
          <select
            className="select select-bordered w-full rounded-md"
            value={serviceType}
            onChange={e => {
              const v = parseInt(e.target.value);
              setServiceType(v);
              if (v === 9 && paymentMethod === "cv") setPaymentMethod("contract");
            }}
            disabled={!!gistParam || busy}
          >
            {Object.entries(SERVICE_NAMES)
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            <option value={9}>Custom Amount</option>
          </select>
        </div>

        {/* Custom Amount (CLAWD) — only for CLAWD/ETH custom */}
        {serviceType === 9 && (paymentMethod === "contract" || paymentMethod === "eth") && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-bold">CLAWD Amount</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 1000000"
              className="input input-bordered w-full rounded-md"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              disabled={busy}
            />
          </div>
        )}

        {/* Custom Amount (USDC) — for USDC custom */}
        {serviceType === 9 && paymentMethod === "usdc" && (
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-bold">USDC Amount</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              className="input input-bordered w-full rounded-md"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              disabled={busy}
            />
          </div>
        )}

        {/* Payment method */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Pay with</label>
          <div className="grid grid-cols-4 gap-1">
            <button
              className={`btn btn-xs text-xs ${paymentMethod === "cv" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setPaymentMethod("cv")}
              disabled={busy || cvDisabled}
              title={cvDisabled ? "CV not available for custom jobs" : undefined}
            >⚡ CV</button>
            <button className={`btn btn-xs text-xs ${paymentMethod === "contract" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("contract")} disabled={busy}>🔥 CLAWD</button>
            <button className={`btn btn-xs text-xs ${paymentMethod === "usdc" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("usdc")} disabled={busy}>💵 USDC</button>
            <button className={`btn btn-xs text-xs ${paymentMethod === "eth" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("eth")} disabled={busy}>⟠ ETH</button>
          </div>
        </div>

        {/* Price & Balance */}
        <div className="flex items-center justify-between bg-base-200 rounded-xl px-5 py-4 mb-6">
          <div>
            <p className="text-sm opacity-60">Total cost</p>
            <p className="text-2xl font-mono font-bold">{costDisplay()}</p>
            {address && <p className="text-sm opacity-50">Balance: {balanceDisplay()}</p>}
          </div>
          <div className="text-right text-sm opacity-60">
            <p>{SERVICE_NAMES[serviceType] || "Custom"}</p>
            {selectedStandard && <p className="text-xs">{priceDisplay}</p>}
            {!selectedStandard && customUsdForClawd > 0 && (
              <p className="text-xs">~${customUsdForClawd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-bold">Job Description</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-32 rounded-md"
            placeholder="Describe what you need. Be specific about requirements, timeline, and deliverables..."
            value={description}
            onChange={e => { setDescription(e.target.value); setTxError(null); }}
            disabled={busy}
          />
          <label className="label">
            <span className="label-text-alt opacity-50">This will be stored as the description CID on-chain</span>
          </label>
        </div>

        {/* Submit button */}
        {!address ? (
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        ) : isWrongNetwork ? (
          <div className="alert alert-error mb-4"><span>Switch to Base network to continue</span></div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handleSubmit}
              disabled={
                busy ||
                !description.trim() ||
                isInsufficient ||
                (serviceType === 9 && !customAmount) ||
                priceWei === BigInt(0) && paymentMethod === "contract"
              }
            >
              {busy && <span className="loading loading-spinner loading-sm mr-2" />}
              {buttonLabel()}
            </button>
            {isInsufficient && (
              <p className="text-center text-xs text-error">Insufficient balance for selected payment method</p>
            )}
          </div>
        )}

        {/* Error display */}
        {txError && (
          <div className="mt-4 alert alert-error">
            <span>{txError}</span>
          </div>
        )}

        <p className="text-center text-xs opacity-40 mt-6">
          {paymentMethod === "contract" ? "CLAWD locked on-chain. Refunded if job rejected."
            : paymentMethod === "cv" ? "ClawdViction spent off-chain. Gas only on-chain."
            : paymentMethod === "eth" ? "ETH auto-swapped to CLAWD on-chain. Refunded in CLAWD if rejected."
            : "USDC auto-swapped to CLAWD on-chain. Refunded in CLAWD if rejected."}
        </p>
      </div>
    </div>
  );
}
