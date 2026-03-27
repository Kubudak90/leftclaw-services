const CACHE_PREFIX = "leftclaw_auth_sig_";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedSig {
  signature: string;
  expiresAt: number;
}

export function getCachedAuthSignature(wallet: string): string | null {
  try {
    const key = CACHE_PREFIX + wallet.toLowerCase();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedSig = JSON.parse(raw);
    if (Date.now() > cached.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.signature;
  } catch {
    return null;
  }
}

export function setCachedAuthSignature(wallet: string, signature: string): void {
  try {
    const key = CACHE_PREFIX + wallet.toLowerCase();
    const cached: CachedSig = {
      signature,
      expiresAt: Date.now() + TTL_MS,
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function clearCachedAuthSignature(wallet: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + wallet.toLowerCase());
  } catch {
    // ignore
  }
}
