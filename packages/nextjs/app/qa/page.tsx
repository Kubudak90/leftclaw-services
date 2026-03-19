"use client";

import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { SERVICE_META } from "~~/lib/servicesMeta";

// Contract service type ID 5 = Frontend QA Audit, priceUsd = $50, cvDivisor = 50
const SERVICE_TYPE_ID = 5;
const PRICE_USD = 50;
const CV_DIVISOR = 50;

const meta = SERVICE_META["qa"];

export default function QaPage() {
  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="Frontend QA Audit"
          emoji={meta.emoji}
          tagline={meta.tagline}
          bullets={meta.bullets}
          heroImage={meta.heroImage}
          heroPosition={meta.heroPosition}
        />

        <UnifiedPaymentFlow
          serviceTypeId={SERVICE_TYPE_ID}
          priceUsd={PRICE_USD}
          cvDivisor={CV_DIVISOR}
          serviceName="QA Report"
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
