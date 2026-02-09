'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface StorageQuota {
  /** Bytes currently used, or null if unsupported */
  usageBytes: number | null;
  /** Total quota in bytes, or null if unsupported */
  quotaBytes: number | null;
  /** Percentage of quota used (0-100), or null if unsupported */
  percentUsed: number | null;
  /** True when usage exceeds 80% of quota */
  isLow: boolean;
}

const LOW_STORAGE_THRESHOLD = 80;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Monitors IndexedDB / origin storage quota using the Storage API.
 * Polls every 5 minutes and returns current usage stats.
 * Returns nulls gracefully on browsers without Storage API support.
 */
export function useStorageQuota(): StorageQuota {
  const [quota, setQuota] = useState<StorageQuota>({
    usageBytes: null,
    quotaBytes: null,
    percentUsed: null,
    isLow: false,
  });

  const prevRef = useRef<{
    usageBytes: number | null;
    quotaBytes: number | null;
  }>({ usageBytes: null, quotaBytes: null });

  const checkQuota = useCallback(async (): Promise<void> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      !navigator.storage.estimate
    ) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? null;
      const total = estimate.quota ?? null;

      // Only update state when values actually change to avoid re-renders
      if (
        usage === prevRef.current.usageBytes &&
        total === prevRef.current.quotaBytes
      ) {
        return;
      }

      prevRef.current = { usageBytes: usage, quotaBytes: total };

      const percent =
        usage !== null && total !== null && total > 0
          ? Math.round((usage / total) * 100)
          : null;

      setQuota({
        usageBytes: usage,
        quotaBytes: total,
        percentUsed: percent,
        isLow: percent !== null && percent >= LOW_STORAGE_THRESHOLD,
      });
    } catch {
      // Storage API call failed — leave state unchanged
    }
  }, []);

  useEffect(() => {
    // Initial check (defer to avoid setState-in-effect lint rule).
    const timeoutId = setTimeout(() => {
      void checkQuota();
    }, 0);

    // Poll every 5 minutes
    const intervalId = setInterval(() => {
      void checkQuota();
    }, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [checkQuota]);

  return quota;
}
