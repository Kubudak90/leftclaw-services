"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

function ServicePageContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const publicClient = usePublicClient();

  const [service, setService] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [initialDescription, setInitialDescription] = useState("");
  const [lockedContent, setLockedContent] = useState("");

  // Fetch gist content if gist param is present
  useEffect(() => {
    const gistUrl = searchParams.get("gist");
    if (!gistUrl) return;

    const descParam = searchParams.get("description") || "";
    // Strip the "Build plan: https://gist.github.com/..." prefix if present
    const cleanDesc = descParam
      .replace(/^Build\s+plan:\s*https?:\/\/gist\.github\.com\/[^\n]+\n*/i, "")
      .trim();
    setInitialDescription(cleanDesc);

    // Convert gist HTML URL to API URL to get raw content
    // URL format: https://gist.github.com/{username}/{gist-id}
    // API format: https://api.github.com/gists/{username}/{gist-id}
    const pathname = new URL(gistUrl).pathname; // e.g. "/clawdbotatg/b8f333ee5d8df4e46dec5f51340e38ad"
    const lastTwo = pathname.split("/").filter(Boolean).slice(-2); // ["clawdbotatg", "b8f333ee5d8df4e46dec5f51340e38ad"]
    const apiUrl = `https://api.github.com/gists/${lastTwo.join("/")}`;

    Promise.all([
      fetch(apiUrl, { headers: { Accept: "application/vnd.github.v3+json" } }).then(r => r.json() as Promise<{
        files: Record<string, { raw_url: string; content?: string; filename: string }>;
      }>),
      fetch(apiUrl, { headers: { Accept: "application/vnd.github.v3.raw+json" } }).then(r => r.text()).catch(() => ""),
    ])
      .then(([gistData, plainText]) => {
        const fileContents: string[] = [];
        for (const [filename, fileData] of Object.entries(gistData.files || {})) {
          if (fileData.content !== undefined) {
            fileContents.push(`// --- ${filename} ---\n${fileData.content}`);
          }
        }
        const gistContent = fileContents.length > 0 ? fileContents.join("\n\n") : plainText;
        setLockedContent(gistContent.trim());
      })
      .catch(err => {
        console.error("Failed to fetch gist:", err);
      });
  }, [searchParams]);

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
    bullets: [
      "Professional service from LeftClaw",
      "Tracked on-chain with escrow",
      "Money-back guarantee via decline",
    ],
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
          initialDescription={initialDescription}
          lockedContent={lockedContent}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}

export default function ServicePage() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>}>
      <ServicePageContent slug={slug} />
    </Suspense>
  );
}
