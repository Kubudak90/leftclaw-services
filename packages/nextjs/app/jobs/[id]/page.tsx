import JobDetailClient from "./JobDetailClient";

// For static export — pre-render a range of possible job IDs
export function generateStaticParams() {
  return Array.from({ length: 50 }, (_, i) => ({ id: String(i + 1) }));
}

export default function JobDetailPage() {
  return <JobDetailClient />;
}
