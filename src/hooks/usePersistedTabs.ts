"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { safeLocalStorage } from "@/lib/utils/safe-storage";

/**
 * Global Tabs State Persistence Hook
 *
 * This hook provides a way to persist tab state across page refreshes.
 * It uses URL search params to store the active tab, making it:
 * - Shareable (users can share links with specific tabs open)
 * - Persistent (survives page refresh)
 * - SEO friendly (search engines can index different tab states)
 *
 * Usage:
 * const { activeTab, setActiveTab, isHydrated } = usePersistedTabs({
 *   key: 'tab',           // URL param key (e.g., ?tab=trending)
 *   defaultTab: 'all',    // Default tab if none in URL
 *   validTabs: ['all', 'trending', 'new', 'live', 'graduated'], // Valid tab values
 * });
 */

interface UsePersistedTabsOptions<T extends string> {
  /** The URL parameter key to store the tab state (default: 'tab') */
  key?: string;
  /** The default tab value if none is stored */
  defaultTab: T;
  /** Array of valid tab values - prevents invalid states */
  validTabs: readonly T[];
  /** Use localStorage instead of URL params (useful for non-shareable tabs) */
  useLocalStorage?: boolean;
  /** localStorage key prefix (used with useLocalStorage) */
  storagePrefix?: string;
}

interface UsePersistedTabsReturn<T extends string> {
  /** The current active tab */
  activeTab: T;
  /** Function to change the active tab (updates URL/localStorage) */
  setActiveTab: (tab: T) => void;
  /** Whether the component has hydrated (use to prevent flash) */
  isHydrated: boolean;
}

/**
 * Hook to persist tab state in URL search params
 * This is the recommended approach for shareable, SEO-friendly tabs
 */
export function usePersistedTabs<T extends string>(
  options: UsePersistedTabsOptions<T>
): UsePersistedTabsReturn<T> {
  const {
    key = "tab",
    defaultTab,
    validTabs,
    useLocalStorage = false,
    storagePrefix = "hypemint_tab_",
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isHydrated, setIsHydrated] = useState(false);

  // Get stored value from URL or localStorage - computed synchronously
  const getStoredTab = useCallback((): T => {
    if (useLocalStorage) {
      // Read from localStorage using safeLocalStorage utility
      const stored = safeLocalStorage.getItem(`${storagePrefix}${pathname}`);
      if (stored && validTabs.includes(stored as T)) {
        return stored as T;
      }
    } else {
      // Read from URL search params
      const urlTab = searchParams.get(key);
      if (urlTab && validTabs.includes(urlTab as T)) {
        return urlTab as T;
      }
    }
    return defaultTab;
  }, [searchParams, key, defaultTab, validTabs, useLocalStorage, storagePrefix, pathname]);

  // Initialize state with the stored value (or default during SSR)
  const [activeTab, setActiveTabState] = useState<T>(() => {
    // During SSR, return default. On client, read from URL/storage immediately.
    if (typeof window === "undefined") return defaultTab;
    return getStoredTab();
  });

  // Hydration effect - sync with URL after mount
  useEffect(() => {
    const storedTab = getStoredTab();
    // Only update if different to avoid unnecessary re-renders
function blahBlah(){}

    setActiveTabState((prev) => (prev !== storedTab ? storedTab : prev));
    setIsHydrated(true);
  }, [getStoredTab]);

  // Function to set active tab and persist it
  const setActiveTab = useCallback(
    (tab: T) => {
      // Validate tab value
      if (!validTabs.includes(tab)) {
        console.warn(`Invalid tab value: ${tab}. Using default: ${defaultTab}`);
        tab = defaultTab;
      }

      setActiveTabState(tab);

      if (useLocalStorage) {
        // Store in localStorage using safeLocalStorage utility
        safeLocalStorage.setItem(`${storagePrefix}${pathname}`, tab);
      } else {
        // Update URL search params
        const params = new URLSearchParams(searchParams.toString());

        if (tab === defaultTab) {
          // Remove param if it's the default (cleaner URLs)
          params.delete(key);
        } else {
          params.set(key, tab);
        }

        const newUrl = params.toString()
          ? `${pathname}?${params.toString()}`
          : pathname;

        // Use router.replace to update URL without adding to history
        router.replace(newUrl, { scroll: false });
      }
    },
    [
      validTabs,
      defaultTab,
      useLocalStorage,
      storagePrefix,
      pathname,
      searchParams,
      key,
      router,
    ]
  );

  return { activeTab, setActiveTab, isHydrated };
}

/**
 * Simplified hook for localStorage-based tab persistence
 * Use this when tabs don't need to be shareable via URL
 */
export function useLocalTabs<T extends string>(
  options: Omit<UsePersistedTabsOptions<T>, "useLocalStorage">
): UsePersistedTabsReturn<T> {
  return usePersistedTabs({
    ...options,
    useLocalStorage: true,
  });
}

/**
 * Hook that combines URL params with localStorage fallback
 * URL takes priority, but stores in localStorage too for cross-session persistence
 */
export function useSmartTabs<T extends string>(
  options: UsePersistedTabsOptions<T>
): UsePersistedTabsReturn<T> {
  const { key = "tab", defaultTab, validTabs, storagePrefix = "hypemint_tab_" } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isHydrated, setIsHydrated] = useState(false);
  const storageKey = `${storagePrefix}${pathname}`;

  // Get stored tab - URL takes priority over localStorage
  const getStoredTab = useCallback((): T => {
    // First check URL
    const urlTab = searchParams.get(key);
    if (urlTab && validTabs.includes(urlTab as T)) {
      return urlTab as T;
    }

    // Then check localStorage using safeLocalStorage utility
    const stored = safeLocalStorage.getItem(storageKey);
    if (stored && validTabs.includes(stored as T)) {
      return stored as T;
    }

    return defaultTab;
  }, [searchParams, key, defaultTab, validTabs, storageKey]);

  // Initialize with stored value
  const [activeTab, setActiveTabState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultTab;
    return getStoredTab();
  });

  // Hydration effect
  useEffect(() => {
    const storedTab = getStoredTab();
    setActiveTabState((prev) => (prev !== storedTab ? storedTab : prev));
    setIsHydrated(true);
  }, [getStoredTab]);

  // Set active tab and persist to both URL and localStorage
  const setActiveTab = useCallback(
    (tab: T) => {
      if (!validTabs.includes(tab)) {
        console.warn(`Invalid tab value: ${tab}`);
        tab = defaultTab;
      }

      setActiveTabState(tab);

      // Store in localStorage for cross-session persistence using safeLocalStorage
      safeLocalStorage.setItem(storageKey, tab);

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (tab === defaultTab) {
        params.delete(key);
      } else {
        params.set(key, tab);
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.replace(newUrl, { scroll: false });
    },
    [validTabs, defaultTab, storageKey, searchParams, key, pathname, router]
  );

  return { activeTab, setActiveTab, isHydrated };
}

export default usePersistedTabs;
