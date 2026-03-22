"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { SERVICE_META } from "~~/lib/servicesMeta";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServicesV2?.address as `0x${string}`;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServicesV2?.abi;

// Contract service type ID 9 = HumanQA
const SERVICE_TYPE_ID = 9;

const meta = SERVICE_META["humanqa"];

interface ServiceType {
  id: bigint;
  name: string;
  slug: string;
  priceUsd: bigint;
  cvDivisor: bigint;
  status: string;
}

export default function HumanqaPage() {
  const publicClient = usePublicClient();
  const [service, setService] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!publicClient) return;

    (async () => {
      try {
        const svc = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getServiceType",
          args: [BigInt(SERVICE_TYPE_ID)],
        }) as ServiceType;

        if (svc && svc.status === "active") {
          setService(svc);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error("Failed to load HumanQA service type", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicClient]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="opacity-60">HumanQA service not found or inactive</p>
      </div>
    );
  }

  const priceUsd = Number(service.priceUsd) / 1e6;
  const cvDivisor = Number(service.cvDivisor);

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="Human QA"
          emoji={meta?.emoji || "👤"}
          tagline={meta?.tagline || "Human-powered frontend QA review."}
          bullets={meta?.bullets || ["Real human review of your dApp frontend", "Prioritized written report", "Tracked on-chain"]}
          heroImage={meta?.heroImage || "/hero-humanqa.png"}
          heroPosition={meta?.heroPosition || "left"}
        />

        <UnifiedPaymentFlow
          serviceTypeId={SERVICE_TYPE_ID}
          priceUsd={priceUsd}
          cvDivisor={cvDivisor}
          serviceName="Human QA Report"
          descriptionLabel={meta?.descriptionLabel || "What dApp should we review?"}
          descriptionPlaceholder={meta?.descriptionPlaceholder || "Include the dApp URL, contract address, or GitHub repo."}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
