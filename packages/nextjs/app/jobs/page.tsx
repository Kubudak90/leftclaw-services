"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { formatUnits } from "viem";

const STATUS_LABELS: Record<number, { label: string; badge: string }> = {
  0: { label: "Open", badge: "badge-success" },
  1: { label: "In Progress", badge: "badge-warning" },
  2: { label: "Completed", badge: "badge-info" },
  3: { label: "Cancelled", badge: "badge-error" },
  4: { label: "Disputed", badge: "badge-error" },
};

function JobCard({ jobId, publicBoard, serviceNames }: { jobId: number; publicBoard?: boolean; serviceNames: Record<number, string> }) {
  const { data: job } = useScaffoldReadContract({
    contractName: "LeftClawServicesV2",
    functionName: "getJob",
    args: [BigInt(jobId)],
  });

  if (!job) return (
    <div className="card bg-base-200 animate-pulse">
      <div className="card-body py-4 px-5">
        <div className="h-4 bg-base-300 rounded w-1/2" />
        <div className="h-3 bg-base-300 rounded w-1/3 mt-2" />
      </div>
    </div>
  );

  // PFP jobs are automated — hide from public worker board
  if (publicBoard && typeof job.description === "string" && job.description.startsWith("PFP:")) {
    return null;
  }

  const serviceType = Number(job.serviceTypeId);
  const status = STATUS_LABELS[Number(job.status)] || { label: "Unknown", badge: "" };
  const price = formatUnits(job.paymentClawd, 18);
  const isConsult = serviceType <= 1;
  const cvAmount = job.cvAmount ? Number(job.cvAmount) : 0;

  // Determine the right action link
  const actionLink = isConsult ? `/chat/${jobId}` : `/jobs/${jobId}`;
  const actionLabel = isConsult
    ? (Number(job.status) === 0 ? "Continue Chat →" : "View Chat →")
    : "View Details →";

  return (
    <Link href={actionLink} className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
      <div className="card-body py-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm opacity-60">#{jobId}</span>
            <span className="font-semibold">{serviceNames[serviceType] || "Unknown"}</span>
          </div>
          <span className={`badge ${status.badge} badge-sm`}>{status.label}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm opacity-60">
            {Number(price) > 0 ? `${Number(price).toLocaleString()} CLAWD` : ""}
            {cvAmount > 0 ? `${cvAmount.toLocaleString()} CV` : ""}
            {Number(price) === 0 && cvAmount === 0 ? "Paid" : ""}
          </span>
          <span className="text-xs text-primary">{actionLabel}</span>
        </div>
      </div>
    </Link>
  );
}

export default function JobsPage() {
  const { address } = useAccount();

  const { data: serviceTypesRaw } = useScaffoldReadContract({
    contractName: "LeftClawServicesV2",
    functionName: "getAllServiceTypes",
  });

  const serviceNames: Record<number, string> = {};
  if (serviceTypesRaw) {
    for (const st of serviceTypesRaw) {
      serviceNames[Number(st.id)] = st.name;
    }
  }

  const { data: clientJobIds } = useScaffoldReadContract({
    contractName: "LeftClawServicesV2",
    functionName: "getJobsByClient",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  const { data: totalJobs } = useScaffoldReadContract({
    contractName: "LeftClawServicesV2",
    functionName: "getTotalJobs",
  });

  const myJobs = clientJobIds ? [...clientJobIds].map(Number).reverse() : [];
  const jobCount = totalJobs ? Number(totalJobs) : 0;
  const allJobIds = Array.from({ length: jobCount }, (_, i) => jobCount - i);

  return (
    <div className="flex flex-col items-center py-8 px-4 min-h-screen">
      <h1 className="text-3xl font-bold mb-2">📋 Jobs</h1>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/consult" className="btn btn-primary btn-sm">💬 New Consult</Link>
        <Link href="/build" className="btn btn-outline btn-sm">🔨 New Build</Link>
        <Link href="/post" className="btn btn-outline btn-sm">📝 Post Job</Link>
        <Link href="/" className="btn btn-ghost btn-sm">← Services</Link>
      </div>

      {/* My Jobs */}
      {!address ? (
        <div className="text-center py-12 w-full max-w-lg">
          <div className="text-5xl mb-3">🔗</div>
          <div className="mb-3"><RainbowKitCustomConnectButton /></div>
          <p className="text-sm opacity-50">Your consultations, builds, and audits will appear here</p>
        </div>
      ) : myJobs.length === 0 ? (
        <div className="text-center py-12 w-full max-w-lg">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-lg opacity-70 mb-2">No jobs yet</p>
          <p className="text-sm opacity-50">Start a consultation or post a job to get going</p>
        </div>
      ) : (
        <div className="w-full max-w-lg space-y-3 mb-8">
          <h2 className="text-lg font-semibold opacity-70">My Jobs ({myJobs.length})</h2>
          {myJobs.map(id => (
            <JobCard key={id} jobId={id} serviceNames={serviceNames} />
          ))}
        </div>
      )}

      {/* All jobs (public board) */}
      {jobCount > 0 && (
        <div className="w-full max-w-lg space-y-3">
          <h2 className="text-lg font-semibold opacity-70">All Jobs ({jobCount})</h2>
          {allJobIds.map(id => (
            <JobCard key={`all-${id}`} jobId={id} publicBoard serviceNames={serviceNames} />
          ))}
        </div>
      )}
    </div>
  );
}
