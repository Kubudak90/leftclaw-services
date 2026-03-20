"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { EXTRA_SERVICE_META } from "~~/lib/servicesMeta";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServicesV2?.address as `0x${string}`;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServicesV2?.abi;

// Judge / Oracle — on-chain service type ID 8
const SERVICE_TYPE_ID = 8;

const meta = EXTRA_SERVICE_META["oracle"];

interface ServiceType {
  id: bigint;
  name: string;
  slug: string;
  priceUsd: bigint;
  cvDivisor: bigint;
  status: string;
}

export default function JudgePage() {
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

        if (svc.status === "active") {
          setService(svc);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error("Failed to load judge service type", e);
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
        <p className="opacity-60">Judge service not found or inactive</p>
      </div>
    );
  }

  const priceUsd = Number(service.priceUsd) / 1e6;
  const cvDivisor = Number(service.cvDivisor);

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="AI Judge & Oracle"
          emoji={meta.emoji}
          tagline={meta.tagline}
          bullets={meta.bullets}
          heroImage={meta.heroImage}
          heroPosition={meta.heroPosition}
        />

        <UnifiedPaymentFlow
          serviceTypeId={SERVICE_TYPE_ID}
          priceUsd={priceUsd}
          cvDivisor={cvDivisor}
          serviceName="Judge / Oracle Job"
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
