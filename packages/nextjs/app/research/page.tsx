"use client";

import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { EXTRA_SERVICE_META } from "~~/lib/servicesMeta";

// Research uses the "build" service type in the contract (ID 6, priceUsd = $1000, cvDivisor = 1)
// Research reports are priced as a full build day
const SERVICE_TYPE_ID = 6;
const PRICE_USD = 1000;
const CV_DIVISOR = 1;

const meta = EXTRA_SERVICE_META["research"];

export default function ResearchPage() {
  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="Research Report"
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
          serviceName="Research Report"
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
