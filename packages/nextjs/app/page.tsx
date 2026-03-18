"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { Address } from "@scaffold-ui/components";
import { CVPriceTicker } from "~~/components/CVPriceTicker";
import type { NextPage } from "next";
import deployedContracts from "~~/contracts/deployedContracts";

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServices?.address;
const CONTRACT_ABI = deployedContracts[8453]?.LeftClawServices?.abi;

const textShadow = { textShadow: "0 2px 8px rgba(0,0,0,0.7)" };

interface ServiceType {
  id: bigint;
  name: string;
  slug: string;
  priceUsd: bigint;
  cvDivisor: bigint;
  status: string;
}

const EMOJI_MAP: Record<string, string> = {
  consult: "💬",
  "consult-deep": "🧠",
  pfp: "🎨",
  audit: "🛡️",
  qa: "🔍",
  build: "🔨",
};

const Home: NextPage = () => {
  const publicClient = usePublicClient();
  const [services, setServices] = useState<ServiceType[]>([]);

  useEffect(() => {
    if (!publicClient) return;
    (async () => {
      try {
        const types = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: "getAllServiceTypes",
        })) as ServiceType[];
        setServices(types.filter(t => t.status === "active"));
      } catch (e) {
        console.error("Failed to load service types", e);
      }
    })();
  }, [publicClient]);

  return (
    <div className="flex flex-col items-center px-4">
      <div className="w-full max-w-5xl">
        {/* Hero */}
        <div className="relative w-full rounded-xl overflow-hidden mb-8 mt-8">
          <img
            src="/hero-builder.png"
            alt="LeftClaw builder"
            className="w-full object-cover"
            style={{ height: "560px" }}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex flex-col justify-center items-end p-10 md:p-16">
            <div className="max-w-lg text-right">
              <p className="text-white/80 mb-6 text-lg md:text-xl" style={textShadow}>
                AI Ethereum builder for hire.
                <br />
                Pay with CLAWD, USDC, ETH, or CV on Base.
              </p>
              <div className="flex flex-col gap-3 items-end">
                <Link href="/consult" className="btn btn-primary btn-lg">
                  💬 Start a Consultation
                </Link>
                <a
                  href="/skill.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-lg text-white border-white hover:bg-white/20"
                >
                  📄 Hire via Agent (x402/ERC-8004)
                </a>
              </div>
              <p className="text-sm text-white/50 mt-4" style={textShadow}>
                Hire programmatically via x402 or ERC-8004
              </p>
            </div>
          </div>
        </div>

        {/* Service Cards */}
        <h2 className="text-2xl font-bold mb-6">Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map(svc => {
            const priceUsd = Number(svc.priceUsd) / 1e6;
            const emoji = EMOJI_MAP[svc.slug] || "⚡";
            return (
              <div key={svc.slug} className="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
                <div className="card-body">
                  <h3 className="card-title text-lg">
                    <span className="text-2xl">{emoji}</span> {svc.name}
                  </h3>
                  <div className="flex items-center gap-3 my-2">
                    <span className="text-xl font-bold text-primary">${priceUsd.toLocaleString()}</span>
                    <span className="opacity-30">|</span>
                    <CVPriceTicker cvDivisor={Number(svc.cvDivisor)} />
                  </div>
                  <div className="card-actions justify-end mt-2">
                    <Link href={`/${svc.slug}`} className="btn btn-primary btn-sm">
                      View Service →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {services.length === 0 && (
            <div className="col-span-full text-center py-12 opacity-50">
              <span className="loading loading-spinner" /> Loading services...
            </div>
          )}
        </div>

        {/* Contract Address */}
        <section className="py-16 flex flex-col items-center gap-2">
          <p className="opacity-60 text-sm">Contract on Base</p>
          {CONTRACT_ADDRESS && <Address address={CONTRACT_ADDRESS} />}
        </section>
      </div>
    </div>
  );
};

export default Home;
