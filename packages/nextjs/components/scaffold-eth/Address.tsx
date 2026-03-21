"use client";

import { useState } from "react";
import Link from "next/link";
import { BlockieAvatar } from "./BlockieAvatar";
import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useEnsName } from "wagmi";
import { mainnet } from "viem/chains";

interface AddressProps {
  address?: string;
  disableAddressLink?: boolean;
  format?: "short" | "long";
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  onlyEnsOrAddress?: boolean;
  chain?: { id: number };
}

const sizeMap = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};

const blockieSizeMap = {
  xs: 6,
  sm: 7,
  base: 8,
  lg: 9,
  xl: 10,
  "2xl": 12,
  "3xl": 15,
};

export function Address({ address, disableAddressLink = false, format = "short", size = "base", onlyEnsOrAddress = false, chain }: AddressProps) {
  const [copied, setCopied] = useState(false);

  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: chain?.id ?? mainnet.id,
    query: { enabled: !!address },
  });

  if (!address) return null;

  const displayAddress =
    format === "short" ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

  const basescanUrl = `https://basescan.org/address/${address}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch {}
  };

  // Show only ENS name (if available) or address — never both
  const content = ensName && onlyEnsOrAddress ? ensName : (ensName || displayAddress);

  return (
    <div className={`flex items-center gap-1.5 ${sizeMap[size]}`}>
      <BlockieAvatar address={address} size={blockieSizeMap[size]} />
      {disableAddressLink ? (
        <span className="font-mono">{content}</span>
      ) : (
        <Link
          href={basescanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono hover:underline"
        >
          {content}
        </Link>
      )}
      <button
        onClick={handleCopy}
        className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
        title="Copy address"
      >
        {copied ? (
          <CheckCircleIcon className="h-4 w-4 text-success" />
        ) : (
          <DocumentDuplicateIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
