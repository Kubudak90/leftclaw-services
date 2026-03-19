"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { parseEther, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";
import { useCLAWDPrice } from "~~/hooks/scaffold-eth/useCLAWDPrice";
import { useCVCost } from "~~/hooks/scaffold-eth/useCVCost";
import { PaymentMethodSelector } from "~~/components/payment";
import { usePaymentContext, PaymentMethod } from "~~/hooks/scaffold-eth/usePaymentContext";

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const TREASURY_ADDRESS = "0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0" as const;
const BASE_CHAIN_ID = 8453;
const PFP_PRICE_USD = 0.25; // $0.25 — matches contract service type ID 3
const PFP_CV_DIVISOR = 250;
const CV_SIGN_MESSAGE = "larv.ai CV Spend";
const USDC_AMOUNT = parseUnits("4", 6); // $4 USDC (6 decimals)

const ERC20_ABI = [
  {
    name: "transfer", type: "function", stateMutability: "nonpayable" as const,
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "approve", type: "function", stateMutability: "nonpayable" as const,
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf", type: "function", stateMutability: "view" as const,
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

export default function PfpPage() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const clawdPrice = useCLAWDPrice();
  const { writeContractAsync } = useWriteContract();
  const { ethPrice } = usePaymentContext();
  const { cvCost } = useCVCost(PFP_CV_DIVISOR);

  const [prompt, setPrompt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cv");
  const [step, setStep] = useState<"idle" | "signing" | "paying" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ txHash?: string; method: string; amount?: string } | null>(null);
  const [cvBalance, setCvBalance] = useState<number | null>(null);
  const [cvLoading, setCvLoading] = useState(false);

  const isWrongNetwork = !!address && chainId !== BASE_CHAIN_ID;
  const clawdNeeded = clawdPrice ? Math.ceil(PFP_PRICE_USD / clawdPrice) : 0;
  const priceWei = BigInt(clawdNeeded) * BigInt(10) ** BigInt(18);

  const { data: clawdBalanceRaw } = useReadContract({
    address: CLAWD_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const insufficientClawd = !!address && clawdBalanceRaw !== undefined && clawdBalanceRaw < priceWei;
  const insufficientCv = cvBalance !== null && cvCost !== null && cvBalance < cvCost;
  const insufficientUsdc = !!address && usdcBalanceRaw !== undefined && usdcBalanceRaw < USDC_AMOUNT;

  // Fetch CV balance
  useEffect(() => {
    if (!address) { setCvBalance(null); return; }
    setCvLoading(true);
    fetch(`https://larv.ai/api/clawdviction/${address}`)
      .then(r => r.json())
      .then(data => { setCvBalance(Number(data.clawdviction) || 0); })
      .catch(() => setCvBalance(null))
      .finally(() => setCvLoading(false));
  }, [address]);

  const ethNeeded = ethPrice ? (PFP_PRICE_USD / ethPrice) * 1.05 : 0;

  const handleGenerate = async () => {
    if (!address || !prompt.trim()) return;
    setError(null); setGeneratedImage(null); setPaymentInfo(null);

    try {
      if (paymentMethod === "cv") {
        // CV payment — sign, spend, generate
        if (!walletClient) throw new Error("Wallet not connected");
        setStep("signing");
        const signature = await walletClient.signMessage({ message: CV_SIGN_MESSAGE });
        setStep("generating");
        const res = await fetch("/api/pfp/generate-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), wallet: address, signature }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 402) throw new Error(`Not enough ClawdViction. You have ${(data.currentBalance || 0).toLocaleString()} CV, need ${(cvCost ?? 0).toLocaleString()}.`);
          throw new Error(data.error || "Generation failed");
        }
        setPaymentInfo({ method: "cv", amount: `${data.cvSpent?.toLocaleString() || ""} CV` });
        setCvBalance(data.newBalance);
        setGeneratedImage(data.image);
        setStep("done");

      } else if (paymentMethod === "clawd") {
        // CLAWD payment — transfer to treasury (direct, no swap needed)
        if (!publicClient || priceWei === BigInt(0)) throw new Error("Price not loaded");
        setStep("paying");
        const txHash = await writeContractAsync({
          address: CLAWD_ADDRESS, abi: ERC20_ABI, functionName: "transfer",
          args: [TREASURY_ADDRESS, priceWei],
        });
        if (!txHash) throw new Error("Transaction failed");
        await publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 20, retryDelay: 3_000 });
        setPaymentInfo({ txHash, method: "clawd", amount: `${clawdNeeded.toLocaleString()} CLAWD` });

        setStep("generating");
        const res = await fetch("/api/pfp/generate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), txHash, address, paymentMethod: "clawd" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        setGeneratedImage(data.image);
        setStep("done");

      } else if (paymentMethod === "usdc") {
        // USDC payment — transfer to treasury
        if (!publicClient || !walletClient) throw new Error("Wallet not connected");
        setStep("paying");
        const txHash = await writeContractAsync({
          address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "transfer",
          args: [TREASURY_ADDRESS, USDC_AMOUNT],
        });
        if (!txHash) throw new Error("Transaction failed");
        await publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 20, retryDelay: 3_000 });
        setPaymentInfo({ txHash, method: "usdc" });

        setStep("generating");
        const res = await fetch("/api/pfp/generate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), txHash, address, paymentMethod: "usdc" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        setGeneratedImage(data.image);
        setStep("done");

      } else if (paymentMethod === "eth") {
        // ETH payment — send to treasury
        if (!publicClient || !walletClient || !ethPrice) throw new Error("ETH price not loaded");
        setStep("paying");
        const txHash = await walletClient.sendTransaction({
          to: TREASURY_ADDRESS,
          value: parseEther(ethNeeded.toFixed(18)),
          account: address,
        });
        if (!txHash) throw new Error("Transaction failed");
        await publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 20, retryDelay: 3_000 });
        setPaymentInfo({ txHash, method: "eth" });

        setStep("generating");
        const res = await fetch("/api/pfp/generate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), txHash, address, paymentMethod: "eth" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        setGeneratedImage(data.image);
        setStep("done");
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
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
    setStep("idle"); setError(null); setGeneratedImage(null); setPaymentInfo(null); setPrompt("");
  };

  const randomPrompt = () => {
    setPrompt(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]);
  };

  const busy = step === "paying" || step === "generating" || step === "signing";
  const isInsufficient = paymentMethod === "clawd" ? insufficientClawd
    : paymentMethod === "cv" ? insufficientCv
    : paymentMethod === "usdc" ? insufficientUsdc
    : false;

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🎨</div>
          <h1 className="text-3xl font-bold">CLAWD PFP Generator</h1>
          <p className="text-base opacity-60 mt-2">Custom profile pictures of the CLAWD mascot</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-base-300 bg-base-200">
            {generatedImage ? (
              <Image src={generatedImage} alt="Generated CLAWD PFP" fill className="object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Image src="/clawd-base.jpg" alt="CLAWD base" width={180} height={180} className="rounded-xl opacity-40" />
                <p className="text-xs opacity-40 mt-2">Your custom PFP will appear here</p>
              </div>
            )}
            {step === "generating" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-white text-sm mt-3">Generating your PFP...</p>
              </div>
            )}
          </div>
        </div>

        {step === "done" && generatedImage && (
          <div className="mb-6 space-y-3">
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={handleDownload}>💾 Download PFP</button>
              <button className="btn btn-outline flex-1" onClick={handleReset}>🎨 Make Another</button>
            </div>
            {paymentInfo && (
              <div className="text-center text-sm opacity-50">
                {paymentInfo.method === "cv" ? (
                  <>Spent {paymentInfo.amount} ⚡</>
                ) : (
                  <>
                    Paid with {paymentInfo.method === "clawd" ? `${paymentInfo.amount} 🔥` : paymentInfo.method === "usdc" ? "$4.00 USDC 💵" : "ETH ⟠"} → treasury{" "}
                    {paymentInfo.txHash && (
                      <a href={`https://basescan.org/tx/${paymentInfo.txHash}`} target="_blank" rel="noopener" className="underline">View tx →</a>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step !== "done" && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Describe your CLAWD{" "}
                <button className="text-primary text-xs ml-2 opacity-70 hover:opacity-100" onClick={randomPrompt}>🎲 random</button>
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

            <PaymentMethodSelector
              value={paymentMethod}
              onChange={m => setPaymentMethod(m)}
              disabled={busy}
              disabledMethods={cvCost === null ? ["cv"] : []}
            />

            <div className="flex items-center justify-between bg-base-300 rounded-xl px-5 py-4 mb-6">
              {paymentMethod === "clawd" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">${PFP_PRICE_USD.toFixed(2)}</p>
                    {clawdNeeded > 0 && <p className="text-sm opacity-50">~{clawdNeeded.toLocaleString()} CLAWD</p>}
                    {address && clawdBalanceRaw !== undefined && (
                      <p className="text-sm opacity-50">You have {Number(clawdBalanceRaw / BigInt(10) ** BigInt(18)).toLocaleString()} CLAWD</p>
                    )}
                  </div>
                  <div className="text-right text-sm opacity-60"><p>🔥 CLAWD</p><p>Sent to treasury</p></div>
                </>
              ) : paymentMethod === "cv" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">{cvCost !== null ? cvCost.toLocaleString() : "..."} CV</p>
                    <p className="text-sm opacity-50">{cvLoading ? "Loading balance..." : cvBalance !== null ? `You have ${cvBalance.toLocaleString()} CV` : "Connect wallet to check"}</p>
                    <p className="text-sm opacity-50">~${PFP_PRICE_USD.toFixed(2)} USD</p>
                  </div>
                  <div className="text-right text-sm opacity-60"><p>⚡ ClawdViction</p><p>Earned by staking</p></div>
                </>
              ) : paymentMethod === "usdc" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">${PFP_PRICE_USD.toFixed(2)} USDC</p>
                    {address && usdcBalanceRaw !== undefined && (
                      <p className="text-sm opacity-50">You have {(Number(usdcBalanceRaw) / 1e6).toFixed(2)} USDC</p>
                    )}
                  </div>
                  <div className="text-right text-sm opacity-60"><p>💵 Stablecoin</p><p>Sent to treasury</p></div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">{ethPrice ? (PFP_PRICE_USD / ethPrice).toFixed(5) : "..."} ETH</p>
                    <p className="text-sm opacity-50">~${PFP_PRICE_USD.toFixed(2)} USD</p>
                  </div>
                  <div className="text-right text-sm opacity-60"><p>⟠ Native ETH</p><p>Sent to treasury</p></div>
                </>
              )}
            </div>

            {!address && <div className="alert alert-warning mb-4"><span>Connect your wallet to start</span></div>}
            {isWrongNetwork && <div className="alert alert-error mb-4"><span>Switch to Base network</span></div>}
            {paymentMethod === "clawd" && insufficientClawd && (
              <div className="alert alert-error mb-4">
                <span>Not enough CLAWD. <a href="https://app.uniswap.org/swap?outputCurrency=0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07&chain=base" target="_blank" rel="noopener" className="underline">Get CLAWD →</a></span>
              </div>
            )}
            {paymentMethod === "cv" && insufficientCv && (
              <div className="alert alert-error mb-4">
                <span>Not enough ClawdViction. You have {(cvBalance || 0).toLocaleString()} CV, need {(cvCost ?? 0).toLocaleString()}. <a href="https://larv.ai/stake" target="_blank" rel="noopener" className="underline">Stake CLAWD →</a></span>
              </div>
            )}
            {paymentMethod === "usdc" && insufficientUsdc && (
              <div className="alert alert-error mb-4">
                <span>Not enough USDC. You have {usdcBalanceRaw !== undefined ? (Number(usdcBalanceRaw) / 1e6).toFixed(2) : "0"} USDC, need ${PFP_PRICE_USD.toFixed(2)}.</span>
              </div>
            )}
            {paymentMethod === "eth" && !ethPrice && (
              <div className="alert alert-warning mb-4"><span>Loading ETH price...</span></div>
            )}

            <button
              className="btn btn-primary btn-lg w-full text-base"
              onClick={handleGenerate}
              disabled={!address || isWrongNetwork || isInsufficient || busy || !prompt.trim() || (paymentMethod === "clawd" && priceWei === BigInt(0)) || (paymentMethod === "eth" && !ethPrice) || (paymentMethod === "cv" && cvCost === null)}
            >
              {busy && <span className="loading loading-spinner loading-sm mr-2" />}
              {step === "signing" ? "Sign message in wallet..." :
               step === "paying" ? "Confirm payment in wallet..." :
               step === "generating" ? "Generating PFP..." :
               paymentMethod === "cv" ? `⚡ Spend ${cvCost !== null ? cvCost.toLocaleString() : "..."} CV & Generate` :
               paymentMethod === "clawd" ? `🔥 Pay ${clawdNeeded > 0 ? clawdNeeded.toLocaleString() + " CLAWD" : "..."} & Generate` :
               paymentMethod === "usdc" ? `💵 Pay $${PFP_PRICE_USD.toFixed(2)} USDC & Generate` :
               `⟠ Pay ${ethPrice ? (PFP_PRICE_USD / ethPrice).toFixed(5) : "..."} ETH & Generate`}
            </button>

            {busy && (
              <div className="mt-4 text-center text-sm opacity-60">
                {step === "signing" && "Sign the message to prove wallet ownership"}
                {step === "paying" && "Confirm the payment in your wallet"}
                {step === "generating" && "AI is creating your PFP (~30s)"}
              </div>
            )}

            {error && (
              <div className="alert alert-error mt-4">
                <div className="flex flex-col gap-1">
                  <span>{error}</span>
                  {step === "error" && paymentInfo && (
                    <span className="text-xs opacity-70">
                      Payment was sent but generation failed. Contact @leftclaw for help.
                      {paymentInfo.txHash && <><br />TX: {paymentInfo.txHash.slice(0, 10)}...</>}
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-xs opacity-40 mt-6">
              {paymentMethod === "clawd" ? "CLAWD sent to the LeftClaw treasury. Non-refundable."
                : paymentMethod === "cv" ? "ClawdViction earned by staking CLAWD. No tokens burned."
                : paymentMethod === "usdc" ? "USDC sent to the LeftClaw treasury. Non-refundable."
                : "ETH sent to the LeftClaw treasury. Non-refundable."}
              <br />Images generated by AI (gpt-image-1.5) based on the CLAWD mascot.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
