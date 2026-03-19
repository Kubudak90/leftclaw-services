"use client";

import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { EXTRA_SERVICE_META } from "~~/lib/servicesMeta";

// Oracle/Judge uses the "build" service type in the contract (ID 6, priceUsd = $1000, cvDivisor = 1)
// This is a custom job — uses the Daily Build price tier since oracle jobs are complex
const SERVICE_TYPE_ID = 6;
const PRICE_USD = 1000;
const CV_DIVISOR = 1;

const meta = EXTRA_SERVICE_META["oracle"];

export default function OraclePage() {
  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="AI Oracle & Judge"
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
          serviceName="Oracle Job"
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
