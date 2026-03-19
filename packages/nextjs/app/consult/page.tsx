"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { SERVICE_META } from "~~/lib/servicesMeta";

// Contract service types:
// ID 1 = Quick Consultation, priceUsd = $20, cvDivisor = 100
// ID 2 = Deep Consultation, priceUsd = $30, cvDivisor = 50

const CONSULT_CONFIG = {
  0: { id: 1, priceUsd: 20, cvDivisor: 100, slug: "consult" },
  1: { id: 2, priceUsd: 30, cvDivisor: 50, slug: "consult-deep" },
} as const;

const CONSULT_EXTRA = {
  0: {
    name: "Quick Consult",
    emoji: "💬",
    tagline: "Get clear answers and a concrete plan — fast.",
    bullets: [
      "A focused chat session with LeftClaw about your idea",
      "Architecture advice, stack recommendations, feasibility checks",
      "Ends with a written build plan you can act on immediately",
      "Plan auto-populates a job post if you want LeftClaw to build it",
    ],
  },
  1: {
    name: "Deep Consult",
    emoji: "🧠",
    tagline: "Deep-dive into complex architecture, protocol design, or strategy.",
    bullets: [
      "A longer, open-ended session to work through a complex idea",
      "Multi-contract systems, tokenomics, security tradeoffs, protocol design",
      "Ends with a detailed written build plan",
      "Plan auto-populates a job post if you want LeftClaw to build it",
    ],
  },
};

export default function ConsultPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg"></span></div>}>
      <ConsultPage />
    </Suspense>
  );
}

function ConsultPage() {
  const searchParams = useSearchParams();
  const typeParam = Number(searchParams.get("type") ?? "0");
  const serviceType = typeParam === 1 ? 1 : 0;

  const config = CONSULT_CONFIG[serviceType as 0 | 1];
  const extra = CONSULT_EXTRA[serviceType as 0 | 1];
  const meta = SERVICE_META[config.slug] || SERVICE_META["consult"];

  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name={extra.name}
          emoji={extra.emoji}
          tagline={extra.tagline}
          bullets={extra.bullets}
          heroImage={meta?.heroImage}
          heroPosition={meta?.heroPosition}
        />

        <UnifiedPaymentFlow
          serviceTypeId={config.id}
          priceUsd={config.priceUsd}
          cvDivisor={config.cvDivisor}
          serviceName={extra.name}
          descriptionLabel="What do you want to build?"
          descriptionPlaceholder="e.g. A staking dApp where users earn ETH rewards on CLAWD deposits..."
          descriptionRequired={false}
          onSuccess={jobId => {
            // Store topic for chat context
            const desc = `${extra.name} session`;
            try { localStorage.setItem(`consult-topic-${jobId}`, desc); } catch {}
            // Trigger sanitization for on-chain jobs
            if (!String(jobId).startsWith("cv-")) {
              fetch("/api/job/sanitize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: String(jobId), description: desc }),
              }).catch(() => {});
            }
            return `/chat/${jobId}`;
          }}
        />
      </div>
    </div>
  );
}
