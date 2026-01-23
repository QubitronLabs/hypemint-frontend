/**
 * Number and Currency Formatting Utilities
 *
 * Human-readable formatting for large numbers, currency values, and balances
 */

/**
 * Format a number with K, M, B, T suffixes for human readability
 * Handles very large numbers gracefully
 */
export function formatCompactNumber(
	value: number,
	decimals: number = 2,
): string {
	if (!Number.isFinite(value) || isNaN(value)) {
		return "0";
	}

	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	// Very small numbers
	if (absValue > 0 && absValue < 0.0001) {
		return `${sign}<0.0001`;
	}

	// Very large numbers (over 1 quadrillion)
	if (absValue >= 1e15) {
		return `${sign}${(absValue / 1e15).toFixed(decimals)}Q`;
	}

	// Trillions
	if (absValue >= 1e12) {
		return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
	}

	// Billions
	if (absValue >= 1e9) {
		return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
	}

	// Millions
	if (absValue >= 1e6) {
		return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
	}

	// Thousands
	if (absValue >= 1e3) {
		return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
	}

	// Regular numbers
	if (absValue >= 1) {
		return `${sign}${absValue.toFixed(decimals)}`;
	}

	// Small decimals
	return `${sign}${absValue.toFixed(4)}`;
}

/**
 * Format a currency value with $ prefix and human readable suffix
 */
export function formatCompactCurrency(
	value: number,
	decimals: number = 2,
): string {
	if (!Number.isFinite(value) || isNaN(value)) {
		return "$0.00";
	}

	const absValue = Math.abs(value);
	const sign = value < 0 ? "-$" : "$";

	// Very small numbers
	if (absValue > 0 && absValue < 0.01) {
		return `${sign}${absValue.toFixed(4)}`;
	}

	// Very large numbers (over 1 quadrillion)
	if (absValue >= 1e15) {
		return `${sign}${(absValue / 1e15).toFixed(decimals)}Q`;
	}

	// Trillions
	if (absValue >= 1e12) {
		return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
	}

	// Billions
	if (absValue >= 1e9) {
		return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
	}

	// Millions
	if (absValue >= 1e6) {
		return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
	}

	// Thousands
	if (absValue >= 1e3) {
		return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
	}

	// Regular numbers
	return `${sign}${absValue.toFixed(2)}`;
}

/**
 * Safe value formatting with display and full tooltip values
 * Returns both a truncated display value and full value for tooltip
 */
export interface SafeFormattedValue {
	display: string;
	full: string;
}

export function formatSafeValue(value: number): SafeFormattedValue {
	// Handle NaN, Infinity, or undefined
	if (!Number.isFinite(value) || isNaN(value)) {
		return { display: "$0.00", full: "$0.00" };
	}

	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	// For very large numbers (> 1 quadrillion), show simplified
	if (absValue >= 1e15) {
		return {
			display: formatCompactCurrency(value),
			full: `${sign}$${absValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
		};
	}

	// Normal formatting
	const formatted = formatCompactCurrency(value);
	return { display: formatted, full: formatted };
}

/**
 * Format balance safely for native tokens
 * Returns both display value and full value for tooltip
 */
export function formatSafeBalance(
	value: number,
	symbol: string,
): SafeFormattedValue {
	if (!Number.isFinite(value) || isNaN(value)) {
		return { display: `0 ${symbol}`, full: `0 ${symbol}` };
	}

	const absValue = Math.abs(value);

	// Quadrillions
	if (absValue >= 1e15) {
		return {
			display: `${(absValue / 1e15).toFixed(2)}Q ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 18 })} ${symbol}`,
		};
	}

	// Trillions
	if (absValue >= 1e12) {
		return {
			display: `${(absValue / 1e12).toFixed(2)}T ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`,
		};
	}

	// Billions
	if (absValue >= 1e9) {
		return {
			display: `${(absValue / 1e9).toFixed(2)}B ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`,
		};
	}

	// Millions
	if (absValue >= 1e6) {
		return {
			display: `${(absValue / 1e6).toFixed(2)}M ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`,
		};
	}

	// Thousands
	if (absValue >= 1e3) {
		return {
			display: `${(absValue / 1e3).toFixed(2)}K ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`,
		};
	}

	// Small numbers (show more decimals)
	if (absValue < 1 && absValue > 0) {
		return {
			display: `${absValue.toFixed(6)} ${symbol}`,
			full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 18 })} ${symbol}`,
		};
	}

	// Regular numbers
	return {
		display: `${absValue.toFixed(4)} ${symbol}`,
		full: `${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`,
	};
}

/**
 * Format token amount with safe display (for table cells)
 * Returns compact display and full value for tooltip
 */
export function formatSafeTokenAmount(
	value: number | string,
): SafeFormattedValue {
	const num = typeof value === "string" ? parseFloat(value) : value;

	if (!Number.isFinite(num) || isNaN(num)) {
		return { display: "0", full: "0" };
	}

	const absValue = Math.abs(num);
	const sign = num < 0 ? "-" : "";

	// Full value for tooltip
	const full = `${sign}${absValue.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;

	// Very large numbers
	if (absValue >= 1e15) {
		return { display: `${sign}${(absValue / 1e15).toFixed(2)}Q`, full };
	}
	if (absValue >= 1e12) {
		return { display: `${sign}${(absValue / 1e12).toFixed(2)}T`, full };
	}
	if (absValue >= 1e9) {
		return { display: `${sign}${(absValue / 1e9).toFixed(2)}B`, full };
	}
	if (absValue >= 1e6) {
		return { display: `${sign}${(absValue / 1e6).toFixed(2)}M`, full };
	}
	if (absValue >= 1e3) {
		return { display: `${sign}${(absValue / 1e3).toFixed(2)}K`, full };
	}

	// Small numbers
	if (absValue < 0.0001 && absValue > 0) {
		return { display: `${sign}<0.0001`, full };
	}

	if (absValue < 1) {
		return { display: `${sign}${absValue.toFixed(6)}`, full };
	}

	return { display: `${sign}${absValue.toFixed(2)}`, full };
}

/**
 * Format token price with safe display (supports very small prices)
 * Returns compact display and full value for tooltip
 */
export function formatSafePrice(value: number | string): SafeFormattedValue {
	const num = typeof value === "string" ? parseFloat(value) : value;

	if (!Number.isFinite(num) || isNaN(num) || num === 0) {
		return { display: "$0.00", full: "$0.00000000" };
	}

	const absValue = Math.abs(num);
	const sign = num < 0 ? "-$" : "$";

	// Full value with high precision for tooltip
	const full = `${sign}${absValue.toFixed(8)}`;

	// Very small prices (< 0.00000001)
	if (absValue < 1e-8 && absValue > 0) {
		return { display: `${sign}<0.00000001`, full };
	}

	// Small prices show more decimals
	if (absValue < 0.01) {
		return { display: `${sign}${absValue.toFixed(8)}`, full };
	}

	// Normal prices
	if (absValue < 1) {
		return { display: `${sign}${absValue.toFixed(4)}`, full };
	}

	// Larger values
	if (absValue >= 1e6) {
		return { display: `${sign}${(absValue / 1e6).toFixed(2)}M`, full };
	}
	if (absValue >= 1e3) {
		return { display: `${sign}${(absValue / 1e3).toFixed(2)}K`, full };
	}

	return { display: `${sign}${absValue.toFixed(2)}`, full };
}

/**
 * Format date relative to now
 */
export function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

/**
 * Common chain symbols mapping for native tokens
 */
export const CHAIN_NATIVE_SYMBOLS: Record<string, string> = {
	// EVM chains
	ethereum: "ETH",
	eth: "ETH",
	mainnet: "ETH",
	polygon: "MATIC",
	matic: "MATIC",
	"polygon amoy": "MATIC",
	amoy: "MATIC",
	bsc: "BNB",
	bnb: "BNB",
	"binance smart chain": "BNB",
	"bnb chain": "BNB",
	avalanche: "AVAX",
	avax: "AVAX",
	"avalanche c-chain": "AVAX",
	arbitrum: "ETH",
	"arbitrum one": "ETH",
	optimism: "ETH",
	base: "ETH",
	fantom: "FTM",
	cronos: "CRO",
	gnosis: "xDAI",
	celo: "CELO",
	moonbeam: "GLMR",
	moonriver: "MOVR",
	aurora: "ETH",
	harmony: "ONE",
	// Solana
	solana: "SOL",
	sol: "SOL",
	// Others
	evm: "ETH",
};

/**
 * Get native token symbol from network name
 */
export function getNativeTokenSymbol(networkName?: string | null): string {
	if (!networkName) return "ETH";

	const nameLower = networkName.toLowerCase().trim();

	// Direct match
	if (CHAIN_NATIVE_SYMBOLS[nameLower]) {
		return CHAIN_NATIVE_SYMBOLS[nameLower];
	}

	// Partial match
	for (const [key, symbol] of Object.entries(CHAIN_NATIVE_SYMBOLS)) {
		if (nameLower.includes(key) || key.includes(nameLower)) {
			return symbol;
		}
	}

	return "ETH";
}
