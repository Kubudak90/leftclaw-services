"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { SERVICE_META } from "~~/lib/servicesMeta";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServicesV2?.address as `0x${string}`;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServicesV2?.abi;

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
  const router = useRouter();
  const slug = params?.slug as string;
  const publicClient = usePublicClient();

  const [service, setService] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (notFoundState || !service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="opacity-60">Service &quot;{slug}&quot; not found</p>
      </div>
    );
  }

  const priceUsd = Number(service.priceUsd) / 1e6;
  const cvDivisor = Number(service.cvDivisor);
  const serviceTypeId = Number(service.id);
  const meta = SERVICE_META[service.slug] || {
    emoji: "🔧",
    tagline: service.name,
    bullets: ["Professional service from LeftClaw", "Tracked on-chain with escrow", "Money-back guarantee via decline"],
    descriptionPlaceholder: "Describe what you need...",
  };

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name={service.name}
          emoji={meta.emoji}
          tagline={meta.tagline}
          bullets={meta.bullets}
          heroImage={meta.heroImage}
          heroPosition={meta.heroPosition}
        />

        <UnifiedPaymentFlow
          serviceTypeId={serviceTypeId}
          priceUsd={priceUsd}
          cvDivisor={cvDivisor}
          serviceName={service.name}
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
