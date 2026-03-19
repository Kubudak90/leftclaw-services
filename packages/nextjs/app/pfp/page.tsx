"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";
import { useCLAWDPrice } from "~~/hooks/scaffold-eth/useCLAWDPrice";

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;
const TREASURY_ADDRESS = "0x90eF2A9211A3E7CE788561E5af54C76B0Fa3aEd0" as const;
const BASE_CHAIN_ID = 8453;
const PFP_PRICE_USD = 0.25;
const PFP_CV_DIVISOR = 250; // fifth / 250 per on-chain ServiceType
const CV_SIGN_MESSAGE = "larv.ai CV Spend";
const USDC_AMOUNT = BigInt(250_000); // 0.25 USDC (6 decimals)

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
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
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

type PaymentMethod = "cv" | "burn" | "usdc" | "eth";

export default function PfpPage() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const clawdPrice = useCLAWDPrice();
  const { writeContractAsync } = useWriteContract();

  const [prompt, setPrompt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cv");
  const [step, setStep] = useState<"idle" | "signing" | "burning" | "spending" | "approving" | "paying" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [burnInfo, setBurnInfo] = useState<{ clawdAmount: number; txHash: string } | null>(null);
  const [cvInfo, setCvInfo] = useState<{ cvSpent: number; newBalance: number } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ txHash: string; method: string } | null>(null);
  const [cvBalance, setCvBalance] = useState<number | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvCost, setCvCost] = useState<number | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  const isWrongNetwork = !!address && chainId !== BASE_CHAIN_ID;
  const clawdNeeded = clawdPrice ? Math.ceil(PFP_PRICE_USD / clawdPrice) : 0;
  const priceWei = BigInt(clawdNeeded) * BigInt(10) ** BigInt(18);

  const { data: clawdBalanceRaw } = useReadContract({
    address: CLAWD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
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

  // Fetch dynamic CV cost: fifth / PFP_CV_DIVISOR
  useEffect(() => {
    fetch("https://larv.ai/api/cv/highest")
      .then(r => r.json())
      .then(data => {
        const fifth = data.highestCVBalance / 5;
        setCvCost(Math.ceil(fifth / PFP_CV_DIVISOR));
      })
      .catch(() => setCvCost(null));
  }, []);

  // Fetch ETH price
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then(r => r.json())
      .then(d => setEthPrice(d.ethereum.usd))
      .catch(() => {});
  }, []);

  const ethNeeded = ethPrice ? (PFP_PRICE_USD / ethPrice) * 1.05 : 0; // 5% buffer

  const handleBurnGenerate = async () => {
    if (!address || !publicClient || !prompt.trim() || priceWei === BigInt(0)) return;
    setError(null); setGeneratedImage(null); setBurnInfo(null);
    try {
      setStep("burning");
      const txHash = await writeContractAsync({
        address: CLAWD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [DEAD_ADDRESS, priceWei],
      });
      if (!txHash) throw new Error("Transaction failed");
      await publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 20, retryDelay: 3_000 });
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

  const handleCvGenerate = async () => {
    if (!address || !walletClient || !prompt.trim()) return;
    setError(null); setGeneratedImage(null); setCvInfo(null);
    try {
      setStep("signing");
      const signature = await walletClient.signMessage({ message: CV_SIGN_MESSAGE });
      setStep("spending");
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
      setCvInfo({ cvSpent: data.cvSpent, newBalance: data.newBalance });
      setCvBalance(data.newBalance);
      setGeneratedImage(data.image);
      setStep("done");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
    }
  };

  const handleUsdcGenerate = async () => {
    if (!address || !publicClient || !walletClient || !prompt.trim()) return;
    setError(null); setGeneratedImage(null); setPaymentInfo(null);
    try {
      setStep("approving");
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TREASURY_ADDRESS, USDC_AMOUNT],
      });

      setStep("paying");
      const txHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
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
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
    }
  };

  const handleEthGenerate = async () => {
    if (!address || !publicClient || !walletClient || !prompt.trim() || !ethPrice) return;
    setError(null); setGeneratedImage(null); setPaymentInfo(null);
    try {
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
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Something went wrong");
      setStep("error");
    }
  };

  const handleGenerate = () => {
    if (paymentMethod === "cv") handleCvGenerate();
    else if (paymentMethod === "burn") handleBurnGenerate();
    else if (paymentMethod === "usdc") handleUsdcGenerate();
    else if (paymentMethod === "eth") handleEthGenerate();
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `clawd-pfp-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => { setStep("idle"); setError(null); setGeneratedImage(null); setBurnInfo(null); setCvInfo(null); setPaymentInfo(null); setPrompt(""); };

  const randomPrompt = () => { setPrompt(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]); };

  const busy = step === "burning" || step === "generating" || step === "signing" || step === "spending" || step === "approving" || step === "paying";
  const isInsufficient = paymentMethod === "burn" ? insufficientClawd : paymentMethod === "cv" ? insufficientCv : paymentMethod === "usdc" ? insufficientUsdc : false;

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
            {(step === "generating" || step === "spending") && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-white text-sm mt-3">{step === "spending" ? "Spending CV & generating..." : "Generating your PFP..."}</p>
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
            {burnInfo && (
              <div className="text-center text-sm opacity-50">
                Burned {burnInfo.clawdAmount.toLocaleString()} CLAWD 🔥{" "}
                <a href={`https://basescan.org/tx/${burnInfo.txHash}`} target="_blank" rel="noopener" className="underline">View tx →</a>
              </div>
            )}
            {cvInfo && (
              <div className="text-center text-sm opacity-50">
                Spent {cvInfo.cvSpent.toLocaleString()} ClawdViction ⚡ — {cvInfo.newBalance.toLocaleString()} CV remaining
              </div>
            )}
            {paymentInfo && (
              <div className="text-center text-sm opacity-50">
                Paid with {paymentInfo.method === "usdc" ? "USDC 💵" : "ETH ⟠"}{" "}
                <a href={`https://basescan.org/tx/${paymentInfo.txHash}`} target="_blank" rel="noopener" className="underline">View tx →</a>
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Payment method</label>
              <div className="grid grid-cols-2 gap-2">
                <button className={`btn btn-sm ${paymentMethod === "cv" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("cv")} disabled={busy}>⚡ CV</button>
                <button className={`btn btn-sm ${paymentMethod === "burn" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("burn")} disabled={busy}>🔥 CLAWD</button>
                <button className={`btn btn-sm ${paymentMethod === "usdc" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("usdc")} disabled={busy}>💵 USDC</button>
                <button className={`btn btn-sm ${paymentMethod === "eth" ? "btn-primary" : "btn-outline"}`} onClick={() => setPaymentMethod("eth")} disabled={busy}>⟠ ETH</button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-base-300 rounded-xl px-5 py-4 mb-6">
              {paymentMethod === "burn" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">${PFP_PRICE_USD.toFixed(2)}</p>
                    {clawdNeeded > 0 && <p className="text-sm opacity-50">~{clawdNeeded.toLocaleString()} CLAWD burned</p>}
                  </div>
                  <div className="text-right text-sm opacity-60"><p>🔥 Deflationary</p><p>CLAWD → 0xdead</p></div>
                </>
              ) : paymentMethod === "cv" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">{cvCost !== null ? cvCost.toLocaleString() : "..."} CV</p>
                    <p className="text-sm opacity-50">{cvLoading ? "Loading balance..." : cvBalance !== null ? `You have ${cvBalance.toLocaleString()} CV` : "Connect wallet to check"}</p>
                  </div>
                  <div className="text-right text-sm opacity-60"><p>⚡ ClawdViction</p><p>Earned by staking</p></div>
                </>
              ) : paymentMethod === "usdc" ? (
                <>
                  <div>
                    <p className="text-sm opacity-60">Cost</p>
                    <p className="text-2xl font-mono font-bold">$0.25 USDC</p>
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
                    <p className="text-sm opacity-50">~${PFP_PRICE_USD} USD</p>
                  </div>
                  <div className="text-right text-sm opacity-60"><p>⟠ Native ETH</p><p>Sent to treasury</p></div>
                </>
              )}
            </div>

            {!address && <div className="alert alert-warning mb-4"><span>Connect your wallet to start</span></div>}
            {isWrongNetwork && <div className="alert alert-error mb-4"><span>Switch to Base network</span></div>}
            {paymentMethod === "burn" && insufficientClawd && (
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
                <span>Not enough USDC. You have {usdcBalanceRaw !== undefined ? (Number(usdcBalanceRaw) / 1e6).toFixed(2) : "0"} USDC, need 0.25.</span>
              </div>
            )}
            {paymentMethod === "eth" && !ethPrice && (
              <div className="alert alert-warning mb-4"><span>Loading ETH price...</span></div>
            )}

            <button
              className="btn btn-primary btn-lg w-full text-base"
              onClick={handleGenerate}
              disabled={!address || isWrongNetwork || isInsufficient || busy || !prompt.trim() || (paymentMethod === "burn" && priceWei === BigInt(0)) || (paymentMethod === "eth" && !ethPrice) || (paymentMethod === "cv" && cvCost === null)}
            >
              {busy && <span className="loading loading-spinner loading-sm mr-2" />}
              {step === "signing" ? "Sign message in wallet..." :
               step === "burning" ? "Burning CLAWD..." :
               step === "spending" ? "Generating PFP..." :
               step === "approving" ? "Approve USDC in wallet..." :
               step === "paying" ? "Confirm payment in wallet..." :
               step === "generating" ? "Generating PFP..." :
               paymentMethod === "cv" ? `⚡ Spend ${cvCost !== null ? cvCost.toLocaleString() : "..."} CV & Generate` :
               paymentMethod === "burn" ? `🔥 Burn ${clawdNeeded > 0 ? clawdNeeded.toLocaleString() + " CLAWD" : "..."} & Generate` :
               paymentMethod === "usdc" ? "💵 Pay $0.25 USDC & Generate" :
               `⟠ Pay ${ethPrice ? (PFP_PRICE_USD / ethPrice).toFixed(5) : "..."} ETH & Generate`}
            </button>

            {busy && (
              <div className="mt-4 text-center text-sm opacity-60">
                {step === "signing" && "Sign the message to prove wallet ownership"}
                {step === "burning" && "Step 1/2 — Confirm the burn in your wallet"}
                {step === "spending" && "Spending CV and generating your PFP (~30s)"}
                {step === "approving" && "Step 1/3 — Approve USDC spend in your wallet"}
                {step === "paying" && "Confirm the payment in your wallet"}
                {step === "generating" && "AI is creating your PFP (~30s)"}
              </div>
            )}

            {error && (
              <div className="alert alert-error mt-4">
                <div className="flex flex-col gap-1">
                  <span>{error}</span>
                  {step === "error" && burnInfo && (
                    <span className="text-xs opacity-70">Your CLAWD was burned but generation failed. Contact @leftclaw for help.<br />TX: {burnInfo.txHash.slice(0, 10)}...</span>
                  )}
                  {step === "error" && paymentInfo && (
                    <span className="text-xs opacity-70">Payment was sent but generation failed. Contact @leftclaw for help.<br />TX: {paymentInfo.txHash.slice(0, 10)}...</span>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-xs opacity-40 mt-6">
              {paymentMethod === "burn" ? "CLAWD is burned (sent to 0xdead) — deflationary and non-refundable." :
               paymentMethod === "cv" ? "ClawdViction is earned by staking CLAWD. No tokens are burned." :
               paymentMethod === "usdc" ? "USDC is sent to the LeftClaw treasury. Non-refundable." :
               "ETH is sent to the LeftClaw treasury. Non-refundable."}
              <br />Images generated by AI (gpt-image-1.5) based on the CLAWD mascot.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
