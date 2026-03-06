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
 * Truncates a number to the specified decimal places without rounding.
 * @param n - The number to truncate.
 * @param decimals - The number of decimal places to keep.
 * @returns The truncated number as a string.
 * @example
 * truncateToDecimals(3234.98798789, 3) // "3234.987"
 * truncateToDecimals(3234.98798789, 0) // "3234"
 */
export function truncateToDecimals(n: number, decimals: number): string {
	if (decimals <= 0) return Math.trunc(n).toString();
	const factor = Math.pow(10, decimals);
	return (Math.trunc(n * factor) / factor).toString();
}

/**
 * Format large numbers with K, M, B, T suffixes
 * @param num - The number to format
 * @param decimals - Number of decimal places (default 2)
 */
export function formatNumber(num: number | string, decimals: number = 2): string {
	const n = typeof num === "string" ? parseFloat(num) : num;
	if (isNaN(n) || !isFinite(n)) return "0";

	if (n >= 1e15) return truncateToDecimals(n / 1e15, decimals) + "Q";
	if (n >= 1e12) return truncateToDecimals(n / 1e12, decimals) + "T";
	if (n >= 1e9) return truncateToDecimals(n / 1e9, decimals) + "B";
	if (n >= 1e6) return truncateToDecimals(n / 1e6, decimals) + "M";
	if (n >= 1e3) return truncateToDecimals(n / 1e3, decimals) + "K";

	if (n < 0.00000001 && n > 0) return "<0.00000001";
	if (n < 1 && n > 0) {
		const truncated = truncateToDecimals(n, decimals < 8 ? 8 : decimals);
		return truncated.replace(/0+$/, "").replace(/\.$/, ".0");
	}

	return truncateToDecimals(n, decimals);
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
  decimal?: number,
): string {
  const converted = fromWei(value);
  return formatCurrency(converted,decimal);
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
