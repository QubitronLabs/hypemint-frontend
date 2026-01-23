/**
 * Safe localStorage wrapper that handles SSR and errors gracefully
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`[SafeStorage] Failed to get item "${key}":`, error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`[SafeStorage] Failed to set item "${key}":`, error);
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[SafeStorage] Failed to remove item "${key}":`, error);
    }
  },
};
