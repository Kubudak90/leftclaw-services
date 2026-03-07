import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";

const CLAWD_ADDRESS = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_CHAIN_ID = 8453;

const CONTRACT_ADDRESS = deployedContracts[8453]?.LeftClawServices?.address as `0x${string}`;

const BALANCE_OF_ABI = [
  {
    name: "balanceOf" as const,
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" as const }],
    outputs: [{ type: "uint256" as const }],
  },
] as const;

const ALLOWANCE_ABI = [
  {
    name: "allowance" as const,
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "owner", type: "address" as const },
      { name: "spender", type: "address" as const },
    ],
    outputs: [{ type: "uint256" as const }],
  },
] as const;

// Module-level price cache so navigating between pages doesn't re-fetch
let _priceCache: { clawdPrice: number | null; ethPrice: number | null; fetchedAt: number } = {
  clawdPrice: null,
  ethPrice: null,
  fetchedAt: 0,
};
const PRICE_TTL = 60_000; // 60s stale window

export type PaymentMethod = "cv" | "clawd" | "usdc" | "eth";

interface PaymentContext {
  // Balances
  clawdBalance: bigint | undefined;
  usdcBalance: bigint | undefined;
  ethBalance: bigint | undefined;
  cvBalance: number | null;

  // Prices
  clawdPrice: number | null;
  ethPrice: number | null;

  // Allowances
  clawdAllowance: bigint | undefined;
  refetchAllowance: () => void;

  // Auto-selected best payment method
  bestPaymentMethod: PaymentMethod;

  // Helpers
  isLoading: boolean;
}

export function usePaymentContext(): PaymentContext {
  const { address } = useAccount();

  // --- Multicall: CLAWD balance + USDC balance + CLAWD allowance (3 reads → 1 RPC) ---
  const { data: multicallData, refetch: refetchMulticall } = useReadContracts({
    contracts: address
      ? [
          {
            address: CLAWD_ADDRESS,
            abi: BALANCE_OF_ABI,
            functionName: "balanceOf",
            args: [address],
            chainId: BASE_CHAIN_ID,
          },
          {
            address: USDC_ADDRESS,
            abi: BALANCE_OF_ABI,
            functionName: "balanceOf",
            args: [address],
            chainId: BASE_CHAIN_ID,
          },
          {
            address: CLAWD_ADDRESS,
            abi: ALLOWANCE_ABI,
            functionName: "allowance",
            args: [address, CONTRACT_ADDRESS],
            chainId: BASE_CHAIN_ID,
          },
        ]
      : [],
    query: { enabled: !!address },
  });

  const clawdBalance = multicallData?.[0]?.result as bigint | undefined;
  const usdcBalance = multicallData?.[1]?.result as bigint | undefined;
  const clawdAllowance = multicallData?.[2]?.result as bigint | undefined;

  // --- ETH native balance (separate call, can't batch with ERC20) ---
  const { data: ethBalanceData } = useBalance({ address, chainId: BASE_CHAIN_ID });
  const ethBalance = ethBalanceData?.value;

  // --- CV balance (off-chain API, cached) ---
  const [cvBalance, setCvBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!address) {
      setCvBalance(null);
      return;
    }
    fetch(`/api/cv-balance/${address}`)
      .then(r => r.json())
      .then(data => setCvBalance(Number(data.clawdviction) || 0))
      .catch(() => setCvBalance(null));
  }, [address]);

  // --- Prices (module-level cache, shared across pages) ---
  const [clawdPrice, setClawdPrice] = useState<number | null>(_priceCache.clawdPrice);
  const [ethPrice, setEthPrice] = useState<number | null>(_priceCache.ethPrice);

  useEffect(() => {
    const now = Date.now();
    if (_priceCache.clawdPrice !== null && _priceCache.ethPrice !== null && now - _priceCache.fetchedAt < PRICE_TTL) {
      setClawdPrice(_priceCache.clawdPrice);
      setEthPrice(_priceCache.ethPrice);
      return;
    }

    // Fetch both prices
    const clawdFetch = fetch(
      `https://api.dexscreener.com/latest/dex/tokens/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`,
    )
      .then(r => r.json())
      .then(data => {
        const p = parseFloat(data.pairs?.[0]?.priceUsd || "0");
        if (p > 0) {
          _priceCache.clawdPrice = p;
          setClawdPrice(p);
        }
      })
      .catch(() => {});

    const ethFetch = fetch(
      `https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006`,
    )
      .then(r => r.json())
      .then(data => {
        const p = parseFloat(data.pairs?.[0]?.priceUsd || "0");
        if (p > 0) {
          _priceCache.ethPrice = p;
          setEthPrice(p);
        }
      })
      .catch(() => {});

    Promise.all([clawdFetch, ethFetch]).then(() => {
      _priceCache.fetchedAt = Date.now();
    });
  }, []);

  // --- Auto-select best payment method ---
  const hasAutoSelected = useRef(false);
  const [bestPaymentMethod, setBestPaymentMethod] = useState<PaymentMethod>("cv");

  useEffect(() => {
    if (hasAutoSelected.current || !address || !ethPrice || !clawdPrice) return;
    if (clawdBalance === undefined && usdcBalance === undefined && ethBalance === undefined && cvBalance === null)
      return;
    hasAutoSelected.current = true;

    const balancesUsd: { method: PaymentMethod; usd: number }[] = [
      {
        method: "cv",
        usd: cvBalance !== null ? cvBalance * 0.001 : 0, // rough USD proxy: 1 CV ≈ $0.001
      },
      {
        method: "clawd",
        usd: clawdBalance !== undefined ? Number(clawdBalance / BigInt(10) ** BigInt(18)) * clawdPrice : 0,
      },
      { method: "usdc", usd: usdcBalance !== undefined ? Number(usdcBalance) / 1e6 : 0 },
      { method: "eth", usd: ethBalance !== undefined ? (Number(ethBalance) / 1e18) * ethPrice : 0 },
    ];

    const best = balancesUsd.sort((a, b) => b.usd - a.usd)[0];
    if (best && best.usd > 0) setBestPaymentMethod(best.method);
  }, [address, ethPrice, clawdPrice, clawdBalance, usdcBalance, ethBalance, cvBalance]);

  const isLoading =
    !!address && clawdBalance === undefined && usdcBalance === undefined && ethBalance === undefined && !clawdPrice;

  return {
    clawdBalance,
    usdcBalance,
    ethBalance,
    cvBalance,
    clawdPrice,
    ethPrice,
    clawdAllowance,
    refetchAllowance: refetchMulticall,
    bestPaymentMethod,
    isLoading,
  };
}
