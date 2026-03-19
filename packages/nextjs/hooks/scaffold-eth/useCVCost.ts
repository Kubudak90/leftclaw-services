import { useEffect, useState } from "react";

/**
 * Fetches the "fifth" from larv.ai and computes CV cost for a given service.
 * fifth = highestCVBalance / 5
 * cvCost = Math.ceil(fifth / cvDivisor)
 *
 * Caches the fifth value across renders and components via module-level cache.
 */

let _fifthCache: { fifth: number | null; fetchedAt: number } = { fifth: null, fetchedAt: 0 };
const FIFTH_TTL = 30_000; // 30s cache

export function useCVCost(cvDivisor: number): { cvCost: number | null; fifth: number | null; loading: boolean } {
  const [fifth, setFifth] = useState<number | null>(_fifthCache.fifth);
  const [loading, setLoading] = useState(_fifthCache.fifth === null);

  useEffect(() => {
    const now = Date.now();
    if (_fifthCache.fifth !== null && now - _fifthCache.fetchedAt < FIFTH_TTL) {
      setFifth(_fifthCache.fifth);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    fetch("https://larv.ai/api/cv/highest")
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        if (data.success !== false && data.highestCVBalance) {
          const f = data.highestCVBalance / 5;
          _fifthCache = { fifth: f, fetchedAt: Date.now() };
          setFifth(f);
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  const cvCost = fifth !== null && cvDivisor > 0 ? Math.ceil(fifth / cvDivisor) : null;

  return { cvCost, fifth, loading };
}
