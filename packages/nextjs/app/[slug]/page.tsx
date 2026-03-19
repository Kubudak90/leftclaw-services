"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { formatUnits, parseEther, parseUnits } from "viem";
import { useAccount, usePublicClient, useSignMessage, useWalletClient, useWriteContract } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { PaymentMethodSelector } from "~~/components/payment";
import { CVPriceTicker } from "~~/components/CVPriceTicker";
import { usePaymentContext, PaymentMethod } from "~~/hooks/scaffold-eth/usePaymentContext";
import { getCachedCVSignature, setCachedCVSignature, clearCachedCVSignature } from "~~/utils/cvSignatureCache";
import deployedContracts from "~~/contracts/deployedContracts";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServicesV2?.address as `0x${string}`;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServicesV2?.abi;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const CLAWD_ADDRESS = "0x174bea9E6b4a89aACa2B68e86551B12f9bf11a78" as const;
const CV_SIGN_MESSAGE = "larv.ai CV Spend";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "spender", type: "address" as const },
      { name: "amount", type: "uint256" as const },
    ],
    outputs: [{ type: "bool" as const }],
  },
] as const;

interface ServiceType {
  id: bigint;
  name: string;
  slug: string;
  priceUsd: bigint;
  cvDivisor: bigint;
  status: string;
}

export default function ServicePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const payment = usePaymentContext();

  const [service, setService] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("usdc");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load service types from contract
  useEffect(() => {
    if (!publicClient) return;

    (async () => {
      try {
        const types = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getAllServiceTypes",
        })) as ServiceType[];

        const match = types.find(t => t.slug === slug && t.status === "active");
        if (match) {
          setService(match);
        } else {
          setNotFoundState(true);
        }
      } catch (e) {
        console.error("Failed to load service types", e);
        setNotFoundState(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicClient, slug]);

  // Auto-select payment method
  useEffect(() => {
    if (payment.bestPaymentMethod) setPaymentMethod(payment.bestPaymentMethod);
  }, [payment.bestPaymentMethod]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (notFoundState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="opacity-60">Service &quot;{slug}&quot; not found</p>
      </div>
    );
  }

  if (!service) return null;

  const priceUsd = Number(service.priceUsd) / 1e6;
  const cvDivisor = Number(service.cvDivisor);

  const handleSubmit = async () => {
    if (!address || !description.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const serviceTypeId = service.id;

      if (paymentMethod === "cv") {
        // CV payment: get or cache signature, call API, then post on-chain
        let signature = getCachedCVSignature(address);
        if (!signature) {
          signature = await signMessageAsync({ message: CV_SIGN_MESSAGE });
          setCachedCVSignature(address, signature);
        }

        // Fetch CV cost
        const highestRes = await fetch("https://larv.ai/api/cv/highest");
        const highestData = await highestRes.json();
        const fifth = highestData.highestCVBalance / 5;
        const cvAmount = Math.ceil(fifth / cvDivisor);

        // Spend CV via our API
        const spendRes = await fetch("/api/cv-spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: address, signature, amount: cvAmount }),
        });
        const spendData = await spendRes.json();

        if (!spendRes.ok || !spendData.success) {
          // If sig was rejected, clear cache and retry
          if (spendRes.status === 401) {
            clearCachedCVSignature(address);
          }
          throw new Error(spendData.error || "CV spend failed");
        }

        // CV is off-chain — no on-chain transaction needed
        setSuccess("CV spent! Your job has been submitted. Check your wallet for updates.");
        setDescription("");
        setSubmitting(false);
        return;
      } else if (paymentMethod === "usdc") {
        // Approve USDC then post
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESS, service.priceUsd],
        });

        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "postJobWithUsdc",
          args: [serviceTypeId, description, BigInt(1)],
        });
      } else if (paymentMethod === "eth") {
        // Estimate ETH from price
        const ethNeeded = payment.ethPrice ? priceUsd / payment.ethPrice : 0;
        if (ethNeeded <= 0) throw new Error("Cannot determine ETH price");
        const ethWei = parseEther((ethNeeded * 1.05).toFixed(18)); // 5% buffer

        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "postJobWithETH",
          args: [serviceTypeId, description],
          value: ethWei,
        });
      } else if (paymentMethod === "clawd") {
        // Calculate CLAWD amount from price
        if (!payment.clawdPrice) throw new Error("Cannot determine CLAWD price");
        const clawdNeeded = priceUsd / payment.clawdPrice;
        const clawdWei = parseUnits((clawdNeeded * 1.05).toFixed(18), 18); // 5% buffer

        await writeContractAsync({
          address: CLAWD_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESS, clawdWei],
        });

        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "postJob",
          args: [serviceTypeId, clawdWei, description],
        });
      }

      setSuccess("Job posted! Check /jobs for status.");
      setDescription("");
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/user rejected|user denied/i.test(msg)) {
        setError("Cancelled");
      } else {
        setError(msg.slice(0, 200));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">{service.name}</h1>

        <div className="flex items-center gap-4 mb-6">
          <span className="text-2xl font-bold text-primary">${priceUsd.toLocaleString()}</span>
          <span className="opacity-40">|</span>
          <CVPriceTicker cvDivisor={cvDivisor} />
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            {!address ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="opacity-60">Connect your wallet to get started</p>
                <RainbowKitCustomConnectButton />
              </div>
            ) : (
              <>
                <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} disabled={submitting} />

                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text font-medium">Describe your job</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-32"
                    placeholder="What do you need? Be specific..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="alert alert-error mb-4">
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="alert alert-success mb-4">
                    <span>{success}</span>
                  </div>
                )}

                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim()}
                >
                  {submitting ? <span className="loading loading-spinner" /> : `Pay $${priceUsd} & Submit`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
