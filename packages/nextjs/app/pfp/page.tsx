"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";
import { useCLAWDPrice } from "~~/hooks/scaffold-eth/useCLAWDPrice";

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;
const BASE_CHAIN_ID = 8453;
const PFP_PRICE_USD = 0.5;
const PFP_CV_COST = 500_000;
const CV_SIGN_MESSAGE = "ClawdViction CV Spend";

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const EXAMPLE_PROMPTS = [
  "wearing a cowboy hat and boots",
  "as a pirate captain with an eyepatch",
  "in a space suit floating in zero gravity",
  "as a medieval knight with a sword",
  "wearing a chef hat, cooking in a kitchen",
  "as a DJ with headphones and turntables",
  "in a Hawaiian shirt on the beach",
  "as a ninja with throwing stars",
  "wearing a lab coat with safety goggles",
  "as a wizard casting a spell",
];

type PaymentMethod = "burn" | "cv";

export default function PfpPage() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const clawdPrice = useCLAWDPrice();
  const { writeContractAsync } = useWriteContract();

  const [prompt, setPrompt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cv");
  const [step, setStep] = useState<"idle" | "signing" | "burning" | "spending" | "generating" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [burnInfo, setBurnInfo] = useState<{ clawdAmount: number; txHash: string } | null>(null);
  const [cvInfo, setCvInfo] = useState<{ cvSpent: number; newBalance: number } | null>(null);
  const [cvBalance, setCvBalance] = useState<number | null>(null);
  const [cvLoading, setCvLoading] = useState(false);

  const isWrongNetwork = !!address && chainId !== BASE_CHAIN_ID;
  const clawdNeeded = clawdPrice ? Math.ceil(PFP_PRICE_USD / clawdPrice) : 0;
  const priceWei = BigInt(clawdNeeded) * BigInt(10) ** BigInt(18);

  const { data: balanceRaw } = useReadContract({
    address: CLAWD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const insufficientClawd = !!address && balanceRaw !== undefined && balanceRaw < priceWei;
  const insufficientCv = cvBalance !== null && cvBalance < PFP_CV_COST;

  // Fetch CV balance when wallet connects
  useEffect(() => {
    if (!address) {
      setCvBalance(null);
      return;
    }
    setCvLoading(true);
    fetch(`https://clawdviction.vercel.app/api/clawdviction/${address}`)
      .then(r => r.json())
      .then(data => {
        setCvBalance(Number(data.clawdviction) || 0);
      })
      .catch(() => setCvBalance(null))
      .finally(() => setCvLoading(false));
  }, [address]);

  // CLAWD burn flow
  const handleBurnGenerate = async () => {
    if (!address || !publicClient || !prompt.trim() || priceWei === BigInt(0)) return;
    setError(null);
    setGeneratedImage(null);
    setBurnInfo(null);

    try {
      setStep("burning");
      const txHash = await writeContractAsync({
        address: CLAWD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [DEAD_ADDRESS, priceWei],
      });
      if (!txHash) throw new Error("Transaction failed");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setBurnInfo({ clawdAmount: clawdNeeded, txHash });

      setStep("generating");
      const res = await fetch("/api/pfp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), txHash, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setGeneratedImage(data.image);
      setStep("done");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
    }
  };

  // ClawdViction flow
  const handleCvGenerate = async () => {
    if (!address || !walletClient || !prompt.trim()) return;
    setError(null);
    setGeneratedImage(null);
    setCvInfo(null);

    try {
      // Sign the static message
      setStep("signing");
      const signature = await walletClient.signMessage({ message: CV_SIGN_MESSAGE });

      // Spend CV + generate
      setStep("spending");
      const res = await fetch("/api/pfp/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), wallet: address, signature }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(`Not enough ClawdViction. You have ${(data.currentBalance || 0).toLocaleString()} CV, need ${PFP_CV_COST.toLocaleString()}.`);
        }
        throw new Error(data.error || "Generation failed");
      }

      // Update local CV balance
      setCvInfo({ cvSpent: data.cvSpent, newBalance: data.newBalance });
      setCvBalance(data.newBalance);
      setGeneratedImage(data.image);
      setStep("done");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
    }
  };

  const handleGenerate = () => {
    if (paymentMethod === "cv") {
      handleCvGenerate();
    } else {
      handleBurnGenerate();
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `clawd-pfp-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setStep("idle");
    setError(null);
    setGeneratedImage(null);
    setBurnInfo(null);
    setCvInfo(null);
    setPrompt("");
  };

  const randomPrompt = () => {
    const p = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
    setPrompt(p);
  };

  const busy = step === "burning" || step === "generating" || step === "signing" || step === "spending";
  const isInsufficient = paymentMethod === "burn" ? insufficientClawd : insufficientCv;

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🎨</div>
          <h1 className="text-3xl font-bold">CLAWD PFP Generator</h1>
          <p className="text-base opacity-60 mt-2">Custom profile pictures of the CLAWD mascot</p>
        </div>

        {/* Preview / Result */}
        <div className="flex justify-center mb-6">
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-base-300 bg-base-200">
            {generatedImage ? (
              <Image src={generatedImage} alt="Generated CLAWD PFP" fill className="object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Image
                  src="/clawd-base.jpg"
                  alt="CLAWD base"
                  width={180}
                  height={180}
                  className="rounded-xl opacity-40"
                />
                <p className="text-xs opacity-40 mt-2">Your custom PFP will appear here</p>
              </div>
            )}
            {(step === "generating" || step === "spending") && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-white text-sm mt-3">
                  {step === "spending" ? "Spending CV & generating..." : "Generating your PFP..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Done state */}
        {step === "done" && generatedImage && (
          <div className="mb-6 space-y-3">
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={handleDownload}>
                💾 Download PFP
              </button>
              <button className="btn btn-outline flex-1" onClick={handleReset}>
                🎨 Make Another
              </button>
            </div>
            {burnInfo && (
              <div className="text-center text-sm opacity-50">
                Burned {burnInfo.clawdAmount.toLocaleString()} CLAWD 🔥{" "}
                <a
                  href={`https://basescan.org/tx/${burnInfo.txHash}`}
                  target="_blank"
                  rel="noopener"
                  className="underline"
                >
                  View tx →
                </a>
              </div>
            )}
            {cvInfo && (
              <div className="text-center text-sm opacity-50">
                Spent {cvInfo.cvSpent.toLocaleString()} ClawdViction ⚡ — {cvInfo.newBalance.toLocaleString()} CV
                remaining
              </div>
            )}
          </div>
        )}

        {/* Input form */}
        {step !== "done" && (
          <>
            {/* Prompt input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Describe your CLAWD{" "}
                <button className="text-primary text-xs ml-2 opacity-70 hover:opacity-100" onClick={randomPrompt}>
                  🎲 random
                </button>
              </label>
              <textarea
                className="textarea textarea-bordered w-full h-20 text-sm"
                placeholder='e.g. "wearing a cowboy hat and boots" or "as a pirate captain"'
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={busy}
                maxLength={500}
              />
            </div>

            {/* Payment method toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Payment method</label>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm flex-1 ${paymentMethod === "cv" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setPaymentMethod("cv")}
                  disabled={busy}
                >
                  ⚡ ClawdViction
                </button>
                <button
                  className={`btn btn-sm flex-1 ${paymentMethod === "burn" ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setPaymentMethod("burn")}
                  disabled={busy}
                >
                  🔥 Burn CLAWD
                </button>
              </div>
            </div>

            {/* Price display */}
            <div className="flex items-center justify-between bg-base-300 rounded-xl px-5 py-4 mb-6">
              {paymentMethod === "burn" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">${PFP_PRICE_USD.toFixed(2)}</p>
                    {clawdNeeded > 0 && (
                      <p className="text-sm opacity-50">~{clawdNeeded.toLocaleString()} CLAWD burned</p>
                    )}
                  </div>
                  <div className="text-right text-sm opacity-60">
                    <p>🔥 Deflationary</p>
                    <p>CLAWD → 0xdead</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">{PFP_CV_COST.toLocaleString()} CV</p>
                    <p className="text-sm opacity-50">
                      {cvLoading
                        ? "Loading balance..."
                        : cvBalance !== null
                          ? `You have ${cvBalance.toLocaleString()} CV`
                          : "Connect wallet to check"}
                    </p>
                  </div>
                  <div className="text-right text-sm opacity-60">
                    <p>⚡ ClawdViction</p>
                    <p>Earned by staking</p>
                  </div>
                </>
              )}
            </div>

            {/* Warnings */}
            {!address && (
              <div className="alert alert-warning mb-4">
                <span>Connect your wallet to start</span>
              </div>
            )}
            {isWrongNetwork && (
              <div className="alert alert-error mb-4">
                <span>Switch to Base network</span>
              </div>
            )}
            {paymentMethod === "burn" && insufficientClawd && (
              <div className="alert alert-error mb-4">
                <span>
                  Not enough CLAWD.{" "}
                  <a
                    href="https://app.uniswap.org/swap?outputCurrency=0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07&chain=base"
                    target="_blank"
                    rel="noopener"
                    className="underline"
                  >
                    Get CLAWD →
                  </a>
                </span>
              </div>
            )}
            {paymentMethod === "cv" && insufficientCv && (
              <div className="alert alert-error mb-4">
                <span>
                  Not enough ClawdViction. You have {(cvBalance || 0).toLocaleString()} CV, need{" "}
                  {PFP_CV_COST.toLocaleString()}.{" "}
                  <a href="https://clawdviction.vercel.app/stake" target="_blank" rel="noopener" className="underline">
                    Stake CLAWD →
                  </a>
                </span>
              </div>
            )}

            {/* Generate button */}
            <button
              className="btn btn-primary btn-lg w-full text-base"
              onClick={handleGenerate}
              disabled={!address || isWrongNetwork || isInsufficient || busy || !prompt.trim() || (paymentMethod === "burn" && priceWei === BigInt(0))}
            >
              {busy && <span className="loading loading-spinner loading-sm mr-2" />}
              {step === "signing"
                ? "Sign message in wallet..."
                : step === "burning"
                  ? "Burning CLAWD..."
                  : step === "spending"
                    ? "Generating PFP..."
                    : step === "generating"
                      ? "Generating PFP..."
                      : paymentMethod === "cv"
                        ? `⚡ Spend ${PFP_CV_COST.toLocaleString()} CV & Generate`
                        : `🔥 Burn ${clawdNeeded > 0 ? clawdNeeded.toLocaleString() + " CLAWD" : "..."} & Generate`}
            </button>

            {busy && (
              <div className="mt-4 text-center text-sm opacity-60">
                {step === "signing" && "Sign the message to prove wallet ownership"}
                {step === "burning" && "Step 1/2 — Confirm the burn in your wallet"}
                {step === "spending" && "Spending CV and generating your PFP (~30s)"}
                {step === "generating" && "Step 2/2 — AI is creating your PFP (~30s)"}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="alert alert-error mt-4">
                <div className="flex flex-col gap-1">
                  <span>{error}</span>
                  {step === "error" && burnInfo && (
                    <span className="text-xs opacity-70">
                      Your CLAWD was burned but generation failed. Contact @leftclaw for help.
                      <br />
                      TX: {burnInfo.txHash.slice(0, 10)}...
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-xs opacity-40 mt-6">
              {paymentMethod === "burn"
                ? "CLAWD is burned (sent to 0xdead) — deflationary and non-refundable."
                : "ClawdViction is earned by staking CLAWD. No tokens are burned."}
              <br />
              Images generated by AI (gpt-image-1.5) based on the CLAWD mascot.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
