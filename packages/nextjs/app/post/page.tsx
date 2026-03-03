"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const SERVICE_NAMES: Record<number, string> = {
  0: "Quick Consult (15 messages)",
  1: "Deep Consult (30 messages)",
  2: "Simple Build (~$500)",
  3: "Standard Build (~$1000)",
  4: "Complex Build (~$1500)",
  5: "Enterprise Build (~$2500)",
  6: "QA Report (~$200)",
  7: "Contract Audit (~$300)",
  8: "Multi-Contract Audit (~$600)",
};

export default function PostJobPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg"></span></div>}>
      <PostJobPage />
    </Suspense>
  );
}

function PostJobPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const isCustom = typeParam === "custom";
  const initialType = isCustom ? 9 : (typeParam ? parseInt(typeParam) : 0);

  const { address } = useAccount();
  const chainId = useChainId();
  const { targetNetwork } = useTargetNetwork();
  const isWrongNetwork = chainId !== targetNetwork.id;

  const [serviceType, setServiceType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [step, setStep] = useState<"form" | "approve" | "approving" | "post" | "posting" | "done">("form");
  const [approveCooldown, setApproveCooldown] = useState(false);

  const selectedStandard = serviceType < 9;

  const contractAddress = deployedContracts[8453]?.LeftClawServices?.address as `0x${string}` | undefined;

  const { data: priceRaw } = useScaffoldReadContract({
    contractName: "LeftClawServices",
    functionName: "servicePriceInClawd",
    args: [serviceType],
  });

  const price = selectedStandard
    ? (priceRaw ? formatUnits(priceRaw, 18) : "0")
    : customAmount;

  const priceWei = selectedStandard
    ? (priceRaw || BigInt(0))
    : (customAmount ? parseUnits(customAmount, 18) : BigInt(0));

  // Read CLAWD allowance
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CLAWD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const needsApproval = !!address && !isWrongNetwork && priceWei > BigInt(0)
    && (allowanceRaw === undefined || allowanceRaw < priceWei);

  // Approve tx
  const { writeContractAsync: approveAsync, isPending: isApproving } = useWriteContract();

  // Post tx
  const { writeContractAsync: postAsync, isPending: isPosting } = useScaffoldWriteContract("LeftClawServices");

  // Mobile deep link helper
  const openWallet = useCallback(() => {
    if (typeof window === "undefined") return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile || window.ethereum) return;

    let wcWallet = "";
    try {
      const wcKey = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
      if (wcKey) wcWallet = (localStorage.getItem(wcKey) || "").toLowerCase();
    } catch {}
    const search = wcWallet;

    const schemes: [string[], string][] = [
      [["rainbow"], "rainbow://"],
      [["metamask"], "metamask://"],
      [["coinbase", "cbwallet"], "cbwallet://"],
      [["trust"], "trust://"],
      [["phantom"], "phantom://"],
    ];
    for (const [keywords, scheme] of schemes) {
      if (keywords.some(k => search.includes(k))) {
        window.location.href = scheme;
        return;
      }
    }
  }, []);

  const writeAndOpen = useCallback(<T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn();
    setTimeout(openWallet, 2000);
    return promise;
  }, [openWallet]);

  const handleApprove = async () => {
    if (!contractAddress) return;
    try {
      setStep("approving");
      await writeAndOpen(() => approveAsync({
        address: CLAWD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, priceWei],
      }));
      setApproveCooldown(true);
      setTimeout(async () => {
        await refetchAllowance();
        setApproveCooldown(false);
        setStep("form");
      }, 4000);
    } catch (e) {
      console.error(e);
      setStep("form");
    }
  };

  const handlePost = async () => {
    if (!description.trim()) return;
    try {
      setStep("posting");
      if (selectedStandard) {
        await writeAndOpen(() => postAsync({
          functionName: "postJob",
          args: [serviceType, description],
        }));
      } else {
        await writeAndOpen(() => postAsync({
          functionName: "postJobCustom",
          args: [priceWei, description],
        }));
      }
      setStep("done");
    } catch (e) {
      console.error(e);
      setStep("form");
    }
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-4">Job Posted!</h1>
        <p className="opacity-70 mb-8">Your job has been posted on-chain. LeftClaw will review and accept it shortly.</p>
        <Link href="/jobs" className="btn btn-primary">View Job Board →</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <h1 className="text-3xl font-bold mb-2">🦞 Post a Job</h1>
      <p className="opacity-70 mb-8">Describe what you need built, audited, or consulted on.</p>

      <div className="w-full max-w-lg">
        {/* Service Type */}
        <div className="form-control mb-4">
          <label className="label"><span className="label-text font-bold">Service Type</span></label>
          <select
            className="select select-bordered w-full"
            value={serviceType}
            onChange={e => setServiceType(parseInt(e.target.value))}
          >
            {Object.entries(SERVICE_NAMES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
            <option value={9}>Custom Amount</option>
          </select>
        </div>

        {/* Custom Amount */}
        {serviceType === 9 && (
          <div className="form-control mb-4">
            <label className="label"><span className="label-text font-bold">CLAWD Amount</span></label>
            <input
              type="number"
              placeholder="e.g. 1000000"
              className="input input-bordered w-full"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
            />
          </div>
        )}

        {/* Price Display */}
        <div className="bg-base-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between">
            <span className="opacity-70">Price:</span>
            <span className="font-mono font-bold">{Number(price).toLocaleString()} CLAWD</span>
          </div>
        </div>

        {/* Description */}
        <div className="form-control mb-6">
          <label className="label"><span className="label-text font-bold">Job Description</span></label>
          <textarea
            className="textarea textarea-bordered w-full h-32"
            placeholder="Describe what you need. Be specific about requirements, timeline, and deliverables..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <label className="label">
            <span className="label-text-alt opacity-50">This will be stored as the description CID on-chain</span>
          </label>
        </div>

        {/* Four-state button flow */}
        {!address ? (
          /* State 1: Not connected */
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        ) : isWrongNetwork ? (
          /* State 2: Wrong network */
          <button
            className="btn btn-warning w-full"
            onClick={() => {
              // trigger network switch via wagmi
              const el = document.querySelector("[data-rk]") as HTMLElement;
              if (el) el.click();
            }}
          >
            Switch to {targetNetwork.name}
          </button>
        ) : needsApproval ? (
          /* State 3: Needs approval */
          <button
            className="btn btn-secondary w-full"
            onClick={handleApprove}
            disabled={isApproving || approveCooldown || !description.trim() || (serviceType === 9 && !customAmount)}
          >
            {(isApproving || approveCooldown) && <span className="loading loading-spinner loading-sm mr-2" />}
            {isApproving ? "Approving..." : approveCooldown ? "Confirming..." : "Approve CLAWD 🦞"}
          </button>
        ) : (
          /* State 4: Ready to post */
          <button
            className="btn btn-primary w-full"
            onClick={handlePost}
            disabled={step === "posting" || isPosting || !description.trim() || (serviceType === 9 && !customAmount)}
          >
            {(step === "posting" || isPosting) && <span className="loading loading-spinner loading-sm mr-2" />}
            {(step === "posting" || isPosting) ? "Posting..." : "Post Job 🦞"}
          </button>
        )}
      </div>
    </div>
  );
}
