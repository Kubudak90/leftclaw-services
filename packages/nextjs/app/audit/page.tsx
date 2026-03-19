"use client";

import { ServiceHero, UnifiedPaymentFlow } from "~~/components/payment";
import { SERVICE_META } from "~~/lib/servicesMeta";

// Contract service type ID 4 = Contract Audit, priceUsd = $200, cvDivisor = 25
const SERVICE_TYPE_ID = 4;
const PRICE_USD = 200;
const CV_DIVISOR = 25;

const meta = SERVICE_META["audit"];

export default function AuditPage() {
  return (
    <div className="flex flex-col items-center py-10 px-4 min-h-screen">
      <div className="w-full max-w-lg">
        <ServiceHero
          name="Smart Contract Audit"
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
          serviceName="Contract Audit"
          descriptionLabel={meta.descriptionLabel}
          descriptionPlaceholder={meta.descriptionPlaceholder}
          descriptionRequired={true}
          onSuccess={jobId => `/jobs/${jobId}`}
        />
      </div>
    </div>
  );
}
