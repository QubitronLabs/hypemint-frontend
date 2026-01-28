import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Wei string (10^18) to decimal number
 * Since backend now always sends decimal values, this just parses the number
 * Legacy Wei detection kept for backward compatibility
 */
export function fromWei(weiStr: string | number | undefined | null): number {
  if (!weiStr) return 0;
  try {
    const strVal = String(weiStr);
    const val = parseFloat(strVal);
    if (isNaN(val)) return 0;
    // Check if this is likely a Wei value (very large integer string without decimal)
    // This shouldn't happen anymore since backend converts to decimal
    if (strVal.length > 15 && !strVal.includes(".")) {
      console.warn(
        "[fromWei] Received Wei value, but backend should send decimal:",
        weiStr,
      );
      return val / 1e18;
    }
    return val;
  } catch {
    return 0;
  }
}

/**
 * Format large numbers with K, M, B, T suffixes
 * @param num - The number to format
 * @param decimals - Number of decimal places (default 2)
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (isNaN(num) || num === 0) return "0";
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1e12) return `${sign}${(absNum / 1e12).toFixed(decimals)}T`;
  if (absNum >= 1e9) return `${sign}${(absNum / 1e9).toFixed(decimals)}B`;
  if (absNum >= 1e6) return `${sign}${(absNum / 1e6).toFixed(decimals)}M`;
  if (absNum >= 1e3) return `${sign}${(absNum / 1e3).toFixed(decimals)}K`;
  if (absNum < 0.0001 && absNum > 0) return `${sign}<0.0001`;

  return num.toFixed(decimals > 4 ? decimals : 4);
}

/**
 * Format currency with $ prefix and K/M/B suffixes
 */
export function formatCurrency(num: number, decimals: number = 2): string {
  if (isNaN(num) || num === 0) return "$0";
  if (num < 0) return `-$${formatNumber(Math.abs(num), decimals)}`;
  return `$${formatNumber(num, decimals)}`;
}

/**
 * Format price with proper decimal places for crypto
 * Backend always sends decimal values now, so we just parse and format
 */
export function formatPrice(price: number | string | undefined | null): string {
  if (!price) return "$0";

  const val = typeof price === "string" ? parseFloat(price) : price;

  // Debug log for troubleshooting
  if (val > 1000000) {
    console.warn("[formatPrice] Received unexpectedly large price value:", {
      input: price,
      parsed: val,
      type: typeof price,
    });
  }

  if (isNaN(val) || val === 0) return "$0";

  // Format based on magnitude
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  if (val > 0) return `$${val.toFixed(8)}`;
  return "$0";
}

/**
 * Format market cap - converts from Wei if needed and formats with suffix
 */
export function formatMarketCap(
  value: string | number | undefined | null,
): string {
  const converted = fromWei(value);
  return formatCurrency(converted);
}

/**
 * Format volume - converts from Wei if needed and formats with suffix
 */
export function formatVolume(
  value: string | number | undefined | null,
): string {
  const converted = fromWei(value);
  return formatCurrency(converted);
}

/**
 * Format token amount - converts from Wei if needed
 */
export function formatTokenAmount(
  amount: string | number | undefined | null,
  symbol?: string,
): string {
  const converted = fromWei(amount);
  const formatted = formatNumber(converted);
  return symbol ? `${formatted} ${symbol}` : formatted;
}
