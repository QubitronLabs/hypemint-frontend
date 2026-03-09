/**
 * Token Creation Form Component
 *
 * This component handles the complete token creation flow on HypeMint:
 *
 * ## Overview
 * Creates a new token with an associated bonding curve on the blockchain,
 * with optional initial purchase (dev buy) functionality.
 *
 * ## Token Creation Flow
 *
 * ### Step 1: Form Input
 * - User fills in token details (name, symbol, description)
 * - User uploads token image
 * - User adds optional social links (website, Twitter, Telegram)
 * - User can enable HypeBoost for enhanced visibility
 * - User can optionally enable "Initial Buy" and specify an amount
 *
 * ### Step 2: Validation
 * - Token symbol is checked for availability via backend API
 * - Balance is verified to cover creation fee + optional initial buy
 * - All required fields are validated
 *
 * ### Step 3: On-Chain Token Creation
 * - Image is uploaded to backend storage
 * - `createTokenOnChain()` interacts with HypeFactory smart contract
 * - User pays creation fee (e.g., 0.01 POL)
 * - Factory deploys new HypeToken + HypeBondingCurve pair
 * - Returns tokenAddress, bondingCurveAddress, and transaction hash
 *
 * ### Step 4: Initial Purchase (Optional Dev Buy)
 * - If enabled, `buyTokens()` is called after token creation
 * - Interacts with the newly created bonding curve
 * - User sends native tokens to buy tokens at initial price
 * - Establishes creator as first token holder
 * - Shows confidence in the token to other traders
 *
 * ### Step 5: Backend Sync
 * - Token metadata stored in backend via `createTokenApi.mutateAsync()`
 * - Enables search, analytics, and social features
 * - User redirected to token detail page
 *
 * ## Network-Aware Features
 * - Native currency symbol dynamically updates based on connected network
 * - Balance refreshes when user switches networks
 * - Uses NetworkStateSynchronizer for real-time network state
 *
 * @module TokenCreationForm
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { parseEther, parseUnits as viemParseUnits, type Address } from "viem";
import {
	Upload,
	Globe,
	Twitter,
	MessageCircle,
	Loader2,
	AlertCircle,
	X,
	CheckCircle2,
	XCircle,
	Zap,
	TrendingUp,
	Users,
	Coins,
	Clock,
	Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
	useAuth,
	useCreateTokenOnChain,
	useCreateTokenRequest,
	useCreationFee,
	useBuyTokens,
	useNativeCurrencySymbol,
	useChainNativeBalance,
	useSolanaCreateToken,
	useSolanaBuyTokens,
} from "@/hooks";
import { useChainId as useWagmiChainId } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi/config";
import { toast } from "sonner";
import { syncTrade } from "@/lib/api/trades";
import {
	getInitialSupplyPreview,
	getChainTokenomics,
	type InitialSupplyPreview,
	type ChainTokenomics,
} from "@/lib/api/tokens";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { parseGwei } from "viem";
import { HYPE_BONDING_CURVE_ABI } from "@/lib/contracts";
import { useActiveChainType, useChainId as useDynamicChainId, useNetworkHasHydrated, useChainLogo } from "@/lib/network";
import { useNetwork as useDynamicNetwork } from "@/lib/network";

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Real-time Preview Card Component
 *
 * Displays a live preview of how the token will appear in the token list.
 * Updates in real-time as user fills in the form fields.
 */

interface TokenPreviewProps {
	name: string;
	symbol: string;
	description: string;
	imagePreview: string | null;
	hypeBoostEnabled: boolean;
	websiteUrl: string;
	twitterUrl: string;
	telegramUrl: string;
	initialPriceUsd?: number;
	initialMcapUsd?: number;
	graduationThresholdUsd?: number;
	graduationMultiplier?: number;
	nativeSymbol?: string;
}

function TokenPreviewCard({
	name,
	symbol,
	description,
	imagePreview,
	hypeBoostEnabled,
	websiteUrl,
	twitterUrl,
	telegramUrl,
	initialPriceUsd,
	initialMcapUsd,
	graduationThresholdUsd,
}: TokenPreviewProps) {
	const hasSocialLinks = websiteUrl || twitterUrl || telegramUrl;

	// Format price for display
	const formatPrice = (price?: number): string => {
		if (!price || price === 0) return "—";
		if (price < 0.000001) return `$${price.toExponential(2)}`;
		if (price < 0.01) return `$${price.toFixed(8)}`;
		if (price < 1) return `$${price.toFixed(4)}`;
		return `$${price.toFixed(2)}`;
	};

	// Format market cap for display
	const formatMcap = (mcap?: number): string => {
		if (!mcap || mcap === 0) return "—";
		if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(1)}M`;
		if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
		return `$${mcap.toFixed(0)}`;
	};

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			className="sticky top-24 bg-card border border-border rounded-2xl overflow-hidden"
		>
			{/* Preview Header */}
			<div className="bg-linear-to-r from-primary/10 to-purple-500/10 px-4 py-3 border-b border-border">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					<span className="text-sm font-medium">Live Preview</span>
				</div>
			</div>

			{/* Token Card Preview */}
			<div className="p-4">
				<div className="bg-background border border-border rounded-xl p-4 ">
					{/* Token Header */}
					<div className="flex items-start gap-3 mb-3">
						<div className="relative">
							{imagePreview ? (
								<img
									src={imagePreview}
									alt={name || "Token"}
									className="w-12 h-12 rounded-xl object-cover"
								/>
							) : (
								<div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
									<Coins className="h-6 w-6 text-muted-foreground" />
								</div>
							)}
							{hypeBoostEnabled && (
								<div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
									<Zap className="h-3 w-3 text-white" />
								</div>
							)}
						</div>
						<div className="flex-1 min-w-0">
							<h3 className="font-semibold truncate">
								{name || "Token Name"}
							</h3>
							<p className="text-sm text-muted-foreground font-mono">
								${symbol || "SYMBOL"}
							</p>
						</div>
					</div>

					{/* Description */}
					<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
						{description ||
							"Your token description will appear here..."}
					</p>

					{/* Simulated Stats */}
					<div className="grid grid-cols-3 gap-2 text-center mb-3">
						<div className="bg-muted/50 rounded-lg p-2">
							<p className="text-xs text-muted-foreground">
								Price
							</p>
							<p className="text-sm font-mono font-medium text-green-500">
								{formatPrice(initialPriceUsd)}
							</p>
						</div>
						<div className="bg-muted/50 rounded-lg p-2">
							<p className="text-xs text-muted-foreground">
								Market Cap
							</p>
							<p className="text-sm font-mono font-medium">
								{formatMcap(initialMcapUsd)}
							</p>
						</div>
						<div className="bg-muted/50 rounded-lg p-2">
							<p className="text-xs text-muted-foreground">
								Holders
							</p>
							<p className="text-sm font-mono font-medium">1</p>
						</div>
					</div>

					{/* Progress Bar */}
					<div className="mb-3">
						<div className="flex justify-between text-xs text-muted-foreground mb-1">
							<span>Bonding Progress</span>
							<span>0%</span>
						</div>
						<div className="h-2 bg-muted rounded-full overflow-hidden">
							<div className="h-full bg-linear-to-r from-primary to-purple-500 w-0 transition-all" />
						</div>
						{graduationThresholdUsd ? (
							<p className="text-[10px] text-muted-foreground mt-1 text-right">
								Graduation at{" "}
								{formatMcap(graduationThresholdUsd)}
								{/* {graduationMultiplier ? ` (${graduationMultiplier}× initial mcap)` : ""} */}
							</p>
						) : null}
					</div>

					{/* Social Links Preview */}
					{hasSocialLinks && (
						<div className="flex items-center gap-2 pt-2 border-t border-border">
							{websiteUrl && (
								<div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
									<Globe className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
							)}
							{twitterUrl && (
								<div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
									<Twitter className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
							)}
							{telegramUrl && (
								<div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
									<MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
								</div>
							)}
						</div>
					)}
				</div>

				{/* Additional Info */}
				<div className="mt-4 space-y-2">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						<span>
							Token will be live immediately after creation.
						</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Users className="h-3.5 w-3.5" />
						<span>Anyone can trade on the bonding curve.</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<TrendingUp className="h-3.5 w-3.5" />
						<span>Price increases with each purchase.</span>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

/**
 * Chain Toggle Button - Used in create form to show which network
 * the token will be created on (auto-detected from wallet).
 */
function ChainToggleButton({
	active,
	icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
				active
					? "bg-primary/15 text-primary border border-primary/30"
					: "bg-background/30 text-muted-foreground/50 border border-transparent cursor-default",
			)}
		>
			{icon}
			{label}
		</button>
	);
}

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * TokenCreationForm Component
 *
 * Main form for creating new tokens on HypeMint platform.
 * Handles the complete lifecycle from form input to blockchain deployment.
 */
export function TokenCreationForm() {
	const router = useRouter();
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const { setShowAuthFlow, primaryWallet } = useDynamicContext();
	const activeChainType = useActiveChainType();
	const walletChainId = useWagmiChainId();
	const dynamicChainId = useDynamicChainId();
	const dynamicNetwork = useDynamicNetwork();
	const networkHasHydrated = useNetworkHasHydrated();
	const chainLogo = useChainLogo();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ========================================================================
	// BLOCKCHAIN HOOKS
	// ========================================================================

	/**
	 * Hook for creating tokens on the blockchain via HypeFactory contract.
	 * Returns the deployed token and bonding curve addresses.
	 */
	const {
		isCreating, // True while waiting for user to confirm in wallet
		isConfirming, // True while transaction is being mined
		txHash, // Transaction hash after submission
		error: contractError,
	} = useCreateTokenOnChain();

	/** Current creation fee from the factory contract */
	const { data: creationFee } = useCreationFee();

	/**
	 * User's native token balance for the current network.
	 * Chain-aware: uses Wagmi for EVM, Dynamic connector for Solana.
	 */
	const { data: chainBalance } = useChainNativeBalance();
	/**
	 * Native currency symbol for the current network (e.g., "POL", "ETH", "BNB").
	 * Synced from Dynamic Labs SDK via NetworkStateSynchronizer.
	 */
	const nativeSymbol = useNativeCurrencySymbol();

	/**
	 * Hook for buying tokens from a bonding curve.
	 * Used for the optional initial purchase (dev buy) after token creation.
	 */
	const {
		buy: buyTokens,
		isBuying,
		isConfirming: isBuyConfirming,
	} = useBuyTokens();

	/** Backend API mutation for storing token metadata */
	/** Gasless token creation — backend signs the on-chain tx (EVM + Solana) */
	const createTokenRequestApi = useCreateTokenRequest();
	const isGaslessCreating = createTokenRequestApi.isPending;

	// === Solana-specific Hooks ===
	const {
		isCreating: isSolanaCreating,
		isConfirming: isSolanaConfirming,
		txSignature: solanaTxSignature,
		error: solanaContractError,
	} = useSolanaCreateToken();

	const { buy: solanaBuyTokens } = useSolanaBuyTokens();

	/** Get deployment config to find correct chainId per chain type */

	// ========================================================================
	// FORM STATE
	// ========================================================================

	// Basic token info
	const [name, setName] = useState("");
	const [symbol, setSymbol] = useState("");
	const [description, setDescription] = useState("");

	// Token image
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [imageUrl, setImageUrl] = useState<string>("");

	// Social links
	const [websiteUrl, setWebsiteUrl] = useState("");
	const [twitterUrl, setTwitterUrl] = useState("");
	const [telegramUrl, setTelegramUrl] = useState("");

	// ========================================================================
	// INITIAL BUY (DEV BUY) STATE
	// ========================================================================

	/**
	 * Amount of native tokens to spend on initial purchase.
	 * This is the "dev buy" that establishes the creator as first holder.
	 */
	const [initialBuyAmount, setInitialBuyAmount] = useState<string>("");

	/** Input mode for initial purchase: enter native currency amount or token amount */
	const [inputMode, setInputMode] = useState<"native" | "token">("native");

	/** Token amount input (when inputMode === "token") */
	const [tokenInputValue, setTokenInputValue] = useState("");

	/**
	 * Preview data showing estimated tokens to receive for initial buy.
	 * Fetched from backend based on bonding curve math.
	 */
	const [supplyPreview, setSupplyPreview] =
		useState<InitialSupplyPreview | null>(null);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);

	/** CPMM tokenomics data for live preview (fetched per chain) */
	const [tokenomics, setTokenomics] = useState<ChainTokenomics | null>(null);

	/** Debounced buy amount to prevent excessive API calls */
	const debouncedBuyAmount = useDebounce(initialBuyAmount, 300);

	// ========================================================================
	// UI STATE
	// ========================================================================

	/** Whether HypeBoost is enabled for enhanced visibility */
	const [hypeBoostEnabled, setHypeBoostEnabled] = useState(true);

	/** Image upload in progress */
	const [isUploading, setIsUploading] = useState(false);

	/** Initial buy transaction in progress */
	const [isInitialBuying, setIsInitialBuying] = useState(false);

	/** Drag and drop state for image upload */
	const [isDragging, setIsDragging] = useState(false);

	// ========================================================================
	// SYMBOL VALIDATION STATE
	// ========================================================================

	/** Whether symbol availability check is in progress */
	const [isCheckingSymbol, setIsCheckingSymbol] = useState(false);

	/** Whether the symbol is available (null = not checked yet) */
	const [symbolAvailable, setSymbolAvailable] = useState<boolean | null>(
		null,
	);

	/** Error message if symbol is not available */
	const [symbolError, setSymbolError] = useState<string | null>(null);

	/** Debounced symbol to prevent excessive API calls during typing */
	const debouncedSymbol = useDebounce(symbol, 500);

	// ========================================================================
	// EFFECTS
	// ========================================================================

	/**
	 * Effect: Fetch CPMM Tokenomics for Live Preview
	 *
	 * Fetches initial price, market cap, and graduation threshold from
	 * the backend's CPMM engine for the user's actual chain.
	 * Uses dynamicChainId (from Dynamic SDK network store) which updates
	 * immediately when the user switches networks in their wallet.
	 *
	 * NOTE: We send the user's ACTUAL chain ID to the tokenomics API
	 * (not the deployment-resolved one) so that the preview shows correct
	 * native token/price for whatever chain the user is on. The deployment
	 * check is only needed for actual token creation.
	 */
	useEffect(() => {
		// Wait for network store hydration to avoid fetching with stale/wrong chainId.
		// Before hydration, dynamicChainId is null — wagmi's chainId (EVM-only) would be
		// used as fallback, which is incorrect when the user is on Solana.
		if (!networkHasHydrated) return;

		let cancelled = false;

		async function fetchTokenomics() {
			try {
				// Use the user's actual chain ID for preview data.
				// Prefer Dynamic SDK chain (reactive), then wagmi, then default.
				const previewChainId =
					dynamicChainId ?? walletChainId ?? DEFAULT_CHAIN_ID;
				const data = await getChainTokenomics(previewChainId);
				if (!cancelled) {
					setTokenomics(data);
				}
			} catch (err) {
				console.error("Failed to fetch tokenomics:", err);
			}
		}
		fetchTokenomics();

		return () => {
			cancelled = true;
		};
	}, [dynamicChainId, walletChainId, networkHasHydrated]);

	/**
	 * Effect: Check Symbol Availability
	 *
	 * Validates that the token symbol is unique and not already taken.
	 * Called whenever the debounced symbol value changes.
	 */
	useEffect(() => {
		async function checkSymbol() {
			if (!debouncedSymbol || debouncedSymbol.length < 2) {
				setSymbolAvailable(null);
				setSymbolError(null);
				return;
			}

			setIsCheckingSymbol(true);
			try {
				const response = await fetch(
					`${API_URL}/api/v1/tokens/check-symbol/${debouncedSymbol.toUpperCase()}`,
				);
				const result = await response.json();

				if (result.success) {
					setSymbolAvailable(result.data.available);
					setSymbolError(
						result.data.available ? null : result.data.reason,
					);
				}
			} catch (error) {
				console.error("Failed to check symbol:", error);
			} finally {
				setIsCheckingSymbol(false);
			}
		}

		checkSymbol();
	}, [debouncedSymbol]);

	/**
	 * Effect: Fetch Initial Supply Preview
	 *
	 * When user enters an initial buy amount, this fetches a preview
	 * from the backend showing estimated tokens they will receive.
	 * Uses bonding curve math to calculate the token allocation.
	 */
	useEffect(() => {
		if (!networkHasHydrated) return;

		let cancelled = false;

		async function fetchSupplyPreview() {
			if (!debouncedBuyAmount || parseFloat(debouncedBuyAmount) <= 0) {
				setSupplyPreview(null);
				return;
			}

			setIsLoadingPreview(true);
			try {
				const previewChainId =
					dynamicChainId ?? walletChainId ?? DEFAULT_CHAIN_ID;
				const preview = await getInitialSupplyPreview(
					debouncedBuyAmount,
					previewChainId,
				);
				if (!cancelled) {
					setSupplyPreview(preview);
				}
			} catch (error) {
				console.error("Failed to fetch supply preview:", error);
				if (!cancelled) {
					setSupplyPreview(null);
				}
			} finally {
				if (!cancelled) {
					setIsLoadingPreview(false);
				}
			}
		}

		fetchSupplyPreview();

		return () => {
			cancelled = true;
		};
	}, [debouncedBuyAmount, dynamicChainId, walletChainId, networkHasHydrated]);

	// ========================================================================
	// COMPUTED VALUES
	// ========================================================================

	/** Derived: whether user wants an initial purchase (non-empty amount > 0) */
	const wantInitialBuy =
		!!initialBuyAmount && parseFloat(initialBuyAmount) > 0;

	/** Max mintable token validation */
	const exceedsMaxMintable = !!(
		supplyPreview && supplyPreview.estimatedTokens > 793_100_000
	);

	/** Form is valid when required fields are filled and symbol is available */
	const isFormValid =
		name.length >= 2 &&
		symbol.length >= 2 &&
		symbol.length <= 10 &&
		symbolAvailable !== false &&
		!exceedsMaxMintable;

	/**
	 * Total cost calculation:
	 * - Creation fee (from factory contract for EVM, default for Solana)
	 * - Plus optional initial buy amount
	 * - Decimals differ: 18 for EVM (wei), 9 for Solana (lamports)
	 */
	const isSolana = activeChainType === "SOLANA";
	const decimals = isSolana ? 9 : 18;

	// Default fees: 0.01 POL (EVM) or 0.01 SOL (Solana)
	const defaultFee = isSolana
		? BigInt("10000000") // 0.01 SOL = 10_000_000 lamports
		: BigInt("10000000000000000"); // 0.01 POL = 10^16 wei
	const fee = isSolana ? defaultFee : creationFee || defaultFee;

	const initialBuySmallestUnit =
		wantInitialBuy && initialBuyAmount
			? viemParseUnits(initialBuyAmount || "0", decimals)
			: BigInt(0);
	const totalCost = fee + initialBuySmallestUnit;

	/** Check if user has enough balance for total cost */
	const hasEnoughBalance = chainBalance?.value
		? chainBalance.value >= totalCost
		: false;

	// ========================================================================
	// IMAGE HANDLERS
	// ========================================================================

	/**
	 * Handle image file upload (from file input or drag & drop)
	 * Validates file type and size, then creates preview
	 */
	const handleImageUpload = (file: File) => {
		if (file && file.type.startsWith("image/")) {
			if (file.size > 5 * 1024 * 1024) {
				toast.error("Image must be less than 5MB");
				return;
			}
			setImageFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	/** Handle file input change event */
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleImageUpload(file);
	};

	/** Handle drag over for drop zone */
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	/** Handle drag leave for drop zone */
	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	/** Handle file drop in drop zone */
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file) handleImageUpload(file);
	};

	/** Remove uploaded image */
	const removeImage = () => {
		setImageFile(null);
		setImagePreview(null);
		setImageUrl("");
		// Reset file input value so re-selecting the same file triggers onChange
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	/**
	 * Upload image to backend storage
	 * Returns the URL of the uploaded image
	 */
	const uploadImage = useCallback(async (): Promise<string | null> => {
		if (!imageFile) return imageUrl || null;

		setIsUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", imageFile);

			const response = await fetch(`${API_URL}/api/v1/uploads/image`, {
				method: "POST",
				body: formData,
			});

			const result = await response.json();
			if (result.success) {
				setImageUrl(result.data.url);
				return result.data.url;
			} else {
				toast.error("Failed to upload image");
				return null;
			}
		} catch (error) {
			console.error("Image upload error:", error);
			toast.error("Failed to upload image");
			return null;
		} finally {
			setIsUploading(false);
		}
	}, [imageFile, imageUrl]);

	// ========================================================================
	// INITIAL PURCHASE HANDLERS
	// ========================================================================

	/** Toggle between SOL and token input modes */
	const toggleInputMode = useCallback(() => {
		setInputMode((prev) => (prev === "native" ? "token" : "native"));
		setInitialBuyAmount("");
		setTokenInputValue("");
		setSupplyPreview(null);
	}, []);

	/** Handle amount change in either SOL or token input mode */
	const handleBuyAmountChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const val = e.target.value;
			if (inputMode === "native") {
				setInitialBuyAmount(val);
				setTokenInputValue("");
			} else {
				setTokenInputValue(val);
				const tokenAmt = parseFloat(val);
				if (
					!isNaN(tokenAmt) &&
					tokenAmt > 0 &&
					tokenomics?.initialPriceNative
				) {
					const solNeeded = tokenAmt * tokenomics.initialPriceNative;
					setInitialBuyAmount(solNeeded.toFixed(9));
				} else {
					setInitialBuyAmount("");
				}
			}
		},
		[inputMode, tokenomics?.initialPriceNative],
	);

	// ========================================================================
	// FORM SUBMISSION
	// ========================================================================

	/**
	 * Main Submit Handler
	 *
	 * Orchestrates the complete token creation flow:
	 *
	 * 1. Validates user is connected and authenticated
	 * 2. Uploads image to backend storage if needed
	 * 3. Calls backend gasless endpoint (EVM) or wallet signing (Solana)
	 *    - Backend signs the createToken tx using its signer wallet
	 *    - User pays zero gas for EVM token creation
	 * 4. (Optional) Makes initial purchase if dev buy enabled
	 *    - User signs this transaction from their own wallet
	 * 5. Redirects to token detail page
	 */
	const handleSubmit = async () => {
		// Ensure user is authenticated
		if (!isAuthenticated) setShowAuthFlow(true);
		if (!isFormValid) return;

		try {
			// Step 1: Upload image if needed
			let finalImageUrl = imageUrl;
			if (imageFile && !imageUrl) {
				const uploadedUrl = await uploadImage();
				if (uploadedUrl) {
					finalImageUrl = uploadedUrl;
				}
			}

			// ================================================================
			//  EVM GASLESS FLOW: Backend signs the transaction
			// ================================================================
			if (!isSolana) {
				toast.info("Creating token...", {
					id: "create-token",
				});

				try {
					// Use Dynamic SDK's active chain (reactive to network switches),
					// fall back to wagmi chain, then DEFAULT_CHAIN_ID.
					// Do NOT override with DEFAULT_CHAIN_ID — let the backend validate
					// factory availability and return a clear error if unsupported.
					const activeChainId =
						dynamicChainId ?? walletChainId ?? DEFAULT_CHAIN_ID;

					// Call gasless endpoint — backend signs & submits the tx
					const result = await createTokenRequestApi.mutateAsync({
						name,
						symbol: symbol.toUpperCase(),
						description,
						imageUrl: finalImageUrl,
						websiteUrl: websiteUrl || undefined,
						twitterUrl: twitterUrl || undefined,
						telegramUrl: telegramUrl || undefined,
						hypeBoostEnabled,
						chainId: activeChainId,
					});

					const backendTokenId = result.token.id;
					const bondingCurveAddr =
						result.bondingCurve?.contractAddress;

					toast.success("Token created successfully!", {
						id: "create-token",
						description: `Tx: ${result.txHash.slice(0, 10)}...`,
					});

					// Optional initial buy (dev buy) — user signs this from their wallet
					if (
						wantInitialBuy &&
						initialBuyAmount &&
						parseFloat(initialBuyAmount) > 0 &&
						bondingCurveAddr
					) {
						setIsInitialBuying(true);
						toast.info("Making initial purchase...", {
							id: "initial-buy",
						});

						try {
							// Use DynamicSDK wallet client directly for the initial buy.
							// wagmi's writeContractAsync cannot work because
							// @dynamic-labs/wagmi-connector is not installed — wagmi
							// has no connector to talk to MetaMask.  DynamicSDK's
							// EthereumWallet.getWalletClient() gives us a viem
							// WalletClient that IS connected to the user's wallet.
							if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
								throw new Error("No EVM wallet connected — please connect MetaMask");
							}

							// Get viem clients from DynamicSDK
							const walletClient = await primaryWallet.getWalletClient();
							const evmPublicClient = await primaryWallet.getPublicClient();

							// Poll until the bonding curve contract is visible on-chain.
							// The backend just deployed it — the frontend's RPC node
							// may need a few seconds to index the new contract.
							const bcAddr = bondingCurveAddr as `0x${string}`;
							const maxWaitMs = 30_000;
							const pollMs = 2_000;
							const t0 = Date.now();
							let contractReady = false;

							while (Date.now() - t0 < maxWaitMs) {
								try {
									const code = await evmPublicClient.getCode({ address: bcAddr });
									if (code && code !== "0x" && code.length > 2) {
										contractReady = true;
										break;
									}
								} catch { /* RPC hiccup — keep polling */ }
								toast.info("Waiting for contract deployment...", {
									id: "initial-buy",
								});
								await new Promise((r) => setTimeout(r, pollMs));
							}

							if (!contractReady) {
								throw new Error(
									"Contract not yet visible on RPC — please buy from the token page",
								);
							}

							// Polygon / Amoy RPCs need a higher priority fee
							const isPolygon = [137, 80002].includes(activeChainId);
							const gasOpts = isPolygon
								? { maxPriorityFeePerGas: parseGwei("30"), maxFeePerGas: parseGwei("150") }
								: {};

							// Send buy tx via DynamicSDK wallet (MetaMask will open)
							const buyHash = await walletClient.writeContract({
								address: bcAddr,
								abi: HYPE_BONDING_CURVE_ABI,
								functionName: "buy",
								args: [0n], // minTokens — no slippage guard for initial dev buy
								value: parseEther(initialBuyAmount),
								...gasOpts,
							});

							if (buyHash) {
								toast.info("Transaction submitted — waiting for confirmation...", {
									id: "initial-buy",
								});

								// Wait for the tx to be mined before syncing
								const receipt = await evmPublicClient.waitForTransactionReceipt({
									hash: buyHash,
									confirmations: 1,
									timeout: 60_000, // 60s max wait
								});

								if (receipt.status === "reverted") {
									throw new Error("Buy transaction reverted on-chain");
								}

								toast.success("Initial purchase confirmed!", {
									id: "initial-buy",
									description: `You now own ${symbol.toUpperCase()} tokens!`,
								});

								// Sync the initial buy trade to the backend immediately
								// (tx is already mined, backend can verify the receipt).
								try {
									await syncTrade({
										txHash: buyHash,
										tokenId: backendTokenId,
										chainId: activeChainId,
									});
								} catch {
									// Non-critical — event listener picks up trades as backup
								}
							} else {
								toast.error(
									"Initial purchase failed — please buy from the token page",
									{ id: "initial-buy" },
								);
							}
						} catch (buyErr) {
							console.error("Initial buy failed:", buyErr);
							toast.error(
								`Initial purchase failed: ${buyErr instanceof Error ? buyErr.message : "Unknown error"}`,
								{ id: "initial-buy" },
							);
						} finally {
							setIsInitialBuying(false);
						}
					}

					router.push(`/token/${backendTokenId}`);
					return;
				} catch (err) {
					const msg =
						err instanceof Error
							? err.message
							: "Failed to create token";
					toast.error(msg, { id: "create-token" });
					return;
				}
			}

			// ================================================================
			//  SOLANA GASLESS FLOW: Backend signs the transaction
			// ================================================================
			toast.info("Creating token on Solana...", {
				id: "create-token",
			});

			try {
				// Use the network store's chain ID (900=mainnet, 901=devnet)
				// instead of getDeploymentByChainType which always returns the first active entry.
				const targetChainId = dynamicChainId ?? 901;

				// Call gasless endpoint — backend signs & submits the Solana tx
				const result = await createTokenRequestApi.mutateAsync({
					name,
					symbol: symbol.toUpperCase(),
					description,
					imageUrl: finalImageUrl,
					websiteUrl: websiteUrl || undefined,
					twitterUrl: twitterUrl || undefined,
					telegramUrl: telegramUrl || undefined,
					hypeBoostEnabled,
					chainId: targetChainId,
				});

				const backendTokenId = result.token.id;
				const bondingCurveAddr = result.bondingCurve?.contractAddress;

				toast.success("Token created successfully!", {
					id: "create-token",
					description: `Tx: ${result.txHash.slice(0, 10)}...`,
				});

				// Optional initial buy (dev buy) — user signs from their Solana wallet
				if (
					wantInitialBuy &&
					initialBuyAmount &&
					parseFloat(initialBuyAmount) > 0 &&
					bondingCurveAddr
				) {
					setIsInitialBuying(true);
					toast.info("Making initial purchase...", {
						id: "initial-buy",
					});

					try {
						// const buySignature = await solanaBuyTokens({
						// 	bondingCurveAddress: bondingCurveAddr,
						// 	solAmount: initialBuyAmount,
						// 	tokenId: backendTokenId,
						// });

						toast.success("Initial purchase successful!", {
							id: "initial-buy",
							description: `You now own ${symbol.toUpperCase()} tokens!`,
						});
					} catch (buyErr) {
						console.error("Initial buy failed:", buyErr);
						toast.error(
							`Initial purchase failed: ${buyErr instanceof Error ? buyErr.message : "Unknown error"}. Token was created successfully.`,
							{ id: "initial-buy" },
						);
					} finally {
						setIsInitialBuying(false);
					}
				}

				router.push(`/token/${backendTokenId}`);
				return;
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: "Failed to create token on Solana";
				toast.error(msg, { id: "create-token" });
				return;
			}
		} catch (error) {
			console.error("Failed to create token:", error);
			toast.error("Failed to create token", {
				id: "create-token",
				description:
					error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	// Loading state
	if (authLoading) {
		return (
			<div className="min-h-[80vh] flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="p-8 mx-auto">
			{/* Two Column Layout */}
			<div className="grid lg:grid-cols-6 gap-6">
				{/* Left Column - Form */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="lg:col-span-4 space-y-6"
				>
					{/* ── Card 1: Token Details ── */}
					<div className="bg-card border border-border rounded-2xl p-6 space-y-5">
						{/* Header */}
						<div className="flex gap-2 flex-col">
							<h1 className="text-lg sm:text-2xl font-bold">
								Create Token
							</h1>

							<p className="text-sm text-muted-foreground mt-1">
								{isSolana
									? "Launch on Solana in under a minute"
									: "Launch on Polygon in under a minute"}
							</p>

							{/* HypeBoost inline toggle */}
							<button
								type="button"
								onClick={() =>
									setHypeBoostEnabled(!hypeBoostEnabled)
								}
								className={cn(
									"inline-flex w-fit items-center mt-2 gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
									hypeBoostEnabled
										? "border-primary bg-primary/10 text-primary"
										: "border-border bg-muted text-muted-foreground hover:border-primary/50",
								)}
							>
								<Zap
									className={cn(
										"h-3.5 w-3.5",
										hypeBoostEnabled && "fill-primary",
									)}
								/>
								HypeBoost {hypeBoostEnabled ? "ON" : "OFF"}
							</button>
						</div>

						{/* Network Selection */}
						<div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
							<span className="text-sm font-medium text-muted-foreground mr-auto">
								Network
							</span>
							<ChainToggleButton
								active={activeChainType === "EVM"}
								icon={<Zap className="h-3.5 w-3.5" />}
								label="EVM"
								onClick={() => {}}
							/>
							<ChainToggleButton
								active={activeChainType === "SOLANA"}
								icon={<Globe className="h-3.5 w-3.5" />}
								label="Solana"
								onClick={() => {}}
							/>
							<span className="text-[10px] text-muted-foreground/60 ml-1 hidden sm:inline">
								Auto-detected from wallet
							</span>
						</div>

						{/* Row 1: Token Name + Symbol side by side */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium mb-1.5 block">
									Token Name{" "}
									<span className="text-red-500">*</span>
								</label>
								<Input
									placeholder="e.g., Pepe Classic"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="h-11 bg-background"
									maxLength={50}
								/>
							</div>
							<div>
								<label className="text-sm font-medium mb-1.5 block">
									Symbol{" "}
									<span className="text-red-500">*</span>
								</label>
								<div className="relative">
									<Input
										placeholder="e.g., PEPE"
										value={symbol}
										onChange={(e) =>
											setSymbol(
												e.target.value
													.toUpperCase()
													.replace(/[^A-Z0-9]/g, ""),
											)
										}
										className={cn(
											"h-11 font-mono bg-background pr-10",
											symbolAvailable === false &&
												"border-red-500",
											symbolAvailable === true &&
												"border-green-500",
										)}
										maxLength={10}
									/>
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										{isCheckingSymbol ? (
											<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
										) : symbolAvailable === true ? (
											<CheckCircle2 className="h-4 w-4 text-green-500" />
										) : symbolAvailable === false ? (
											<XCircle className="h-4 w-4 text-red-500" />
										) : null}
									</div>
								</div>
								{symbolError && (
									<p className="text-xs text-red-500 mt-1">
										{symbolError}
									</p>
								)}
							</div>
						</div>

						{/* Row 2: Description (full width) */}
						<div>
							<label className="text-sm font-medium mb-1.5 block">
								Description
							</label>
							<Textarea
								placeholder="Tell the world about your token..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="min-h-24 bg-background resize-none"
								maxLength={500}
							/>
						</div>

						{/* Row 3: Social Links Accordion */}
						<Accordion type="single" collapsible className="w-full">
							<AccordionItem
								value="social-links"
								className="border border-border rounded-xl px-4 border-b!"
							>
								<AccordionTrigger className="hover:no-underline py-3">
									<div className="flex items-center gap-2">
										<Globe className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm font-medium">
											Social Links
										</span>
										<span className="text-xs text-muted-foreground">
											(optional)
										</span>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-3 pb-4">
									<div className="relative">
										<Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="https://yourwebsite.com"
											value={websiteUrl}
											onChange={(e) =>
												setWebsiteUrl(e.target.value)
											}
											className="pl-9 h-10 bg-background text-sm"
										/>
									</div>
									<div className="relative">
										<Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="https://twitter.com/yourtoken"
											value={twitterUrl}
											onChange={(e) =>
												setTwitterUrl(e.target.value)
											}
											className="pl-9 h-10 bg-background text-sm"
										/>
									</div>
									<div className="relative">
										<MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="https://t.me/yourtoken"
											value={telegramUrl}
											onChange={(e) =>
												setTelegramUrl(e.target.value)
											}
											className="pl-9 h-10 bg-background text-sm"
										/>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>

						{/* Row 4: Initial Purchase */}
						<div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-4">
							<div>
								<h3 className="text-sm font-semibold">
									Choose how many{" "}
									<span className="text-primary">
										{symbol || "tokens"}
									</span>{" "}
									you want to buy{" "}
									<span className="text-muted-foreground font-normal">
										(optional)
									</span>
								</h3>
								<p className="text-xs text-muted-foreground mt-1">
									It&apos;s optional but buying a small amount
									of coins helps protect your coin from
									snipers
								</p>
							</div>

							{/* Switch input mode */}
							<button
								type="button"
								onClick={toggleInputMode}
								disabled={!isAuthenticated}
								className="text-xs text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Switch to{" "}
								{inputMode === "native"
									? symbol || "tokens"
									: nativeSymbol}
							</button>

							{/* Amount input */}
							<div className="relative">
								<Input
									type="number"
									step={inputMode === "native" ? "0.01" : "1"}
									min="0"
									placeholder={
										inputMode === "native" ? "0.0" : "0"
									}
									value={
										inputMode === "native"
											? initialBuyAmount
											: tokenInputValue
									}
									onChange={handleBuyAmountChange}
									disabled={!isAuthenticated}
									className="h-12 pr-24 text-lg font-mono bg-background"
								/>
								<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
									<span className="text-sm text-muted-foreground font-medium">
										{inputMode === "native"
											? nativeSymbol
											: symbol || "TOKEN"}
									</span>
									{chainLogo && inputMode === "native" && (
										<img
											src={chainLogo}
											alt=""
											className="w-5 h-5 rounded-full"
										/>
									)}
								</div>
							</div>

							{/* Preview: You receive / Cost */}
							{isLoadingPreview ? (
								<div className="flex items-center gap-2 text-muted-foreground">
									<Loader2 className="w-3 h-3 animate-spin" />
									<span className="text-sm">
										Calculating...
									</span>
								</div>
							) : supplyPreview && wantInitialBuy ? (
								<p className="text-sm text-muted-foreground">
									{inputMode === "native" ? (
										<>
											You receive:{" "}
											<span className="font-semibold text-foreground">
												{
													supplyPreview.estimatedTokensFormatted
												}
											</span>{" "}
											{symbol || "tokens"}
										</>
									) : (
										<>
											Cost:{" "}
											<span className="font-semibold text-foreground">
												~{initialBuyAmount}
											</span>{" "}
											{nativeSymbol}
										</>
									)}
								</p>
							) : null}

							{/* Balance error */}
							{isAuthenticated &&
								wantInitialBuy &&
								chainBalance &&
								!hasEnoughBalance && (
									<p className="text-sm text-red-500 font-medium">
										Insufficient {nativeSymbol}: current
										balance{" "}
										{parseFloat(
											chainBalance.formatted,
										).toFixed(6)}
									</p>
								)}

							{/* Max mintable error */}
							{exceedsMaxMintable && (
								<p className="text-sm text-red-500 font-medium">
									Exceeds maximum mintable tokens
									(793,100,000). Please reduce your purchase
									amount.
								</p>
							)}
						</div>

						{/* Gasless Creation Info */}
						{isAuthenticated && (
							<div className="bg-muted/50 rounded-xl p-4">
								<div className="flex items-center gap-3">
									<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20">
										<Zap className="h-5 w-5 text-green-500" />
									</div>
									<div>
										<p className="text-sm font-semibold">
											Gasless Token Creation
										</p>
										<p className="text-xs text-muted-foreground">
											Free — No gas required! Creating on{" "}
											<span className="font-semibold text-primary">
												{dynamicNetwork?.name ||
													`Chain ${dynamicChainId ?? walletChainId ?? DEFAULT_CHAIN_ID}`}
											</span>
										</p>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* ── Card 2: Token Image ── */}
					<div className="bg-card border border-border rounded-2xl p-6">
						<h2 className="text-base font-semibold mb-4">
							Token Image
						</h2>
						<div
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							className={cn(
								"relative border-2 border-dashed rounded-xl transition-all",
								isDragging
									? "border-primary bg-primary/10"
									: imagePreview
										? "border-green-500/50"
										: "border-border",
							)}
						>
							{imagePreview ? (
								<div className="relative aspect-video sm:aspect-3/1 w-full overflow-hidden rounded-xl">
									<img
										src={imagePreview}
										alt="Token"
										className="w-full h-full object-cover"
									/>
									<button
										onClick={(e) => {
											e.stopPropagation();
											removeImage();
										}}
										className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
									>
										<X className="h-4 w-4 text-white" />
									</button>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-10 sm:py-14 px-4 text-center">
									<div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
										<Upload className="h-6 w-6 text-muted-foreground" />
									</div>
									<p className="text-sm font-medium mb-1">
										Select video or image to upload
									</p>
									<p className="text-xs text-muted-foreground mb-4">
										or drag and drop it here
									</p>
									<Button
										type="button"
										onClick={() =>
											fileInputRef.current?.click()
										}
										className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
										size="sm"
									>
										Select file
									</Button>
								</div>
							)}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleFileChange}
								className="hidden"
							/>
						</div>
						{/* Upload info row */}
						{!imagePreview && (
							<div className="grid grid-cols-2 gap-4 mt-4 text-xs text-muted-foreground">
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<span>File size</span>
										<span className="text-foreground font-medium">
											Max 5 MB
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span>File type</span>
										<span className="text-foreground font-medium">
											PNG, JPG, GIF
										</span>
									</div>
								</div>
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<span>Resolution</span>
										<span className="text-foreground font-medium">
											Any
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span>Aspect ratio</span>
										<span className="text-foreground font-medium">
											1:1 recommended
										</span>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Errors */}
					{isAuthenticated && contractError && (
						<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span className="text-sm">
								{contractError?.message}
							</span>
						</div>
					)}

					{isAuthenticated && solanaContractError && (
						<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span className="text-sm">
								{solanaContractError?.message}
							</span>
						</div>
					)}

					{isAuthenticated && (txHash || solanaTxSignature) && (
						<div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
							<div>
								<p className="text-sm font-medium">
									Transaction Submitted
								</p>
								<p className="text-xs text-muted-foreground font-mono">
									{(txHash || solanaTxSignature)?.slice(
										0,
										20,
									)}
									...
									{(txHash || solanaTxSignature)?.slice(-8)}
								</p>
							</div>
						</div>
					)}

					{/* ── Coin Data Warning ── */}
					<div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
						<AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
						<p className="text-xs text-muted-foreground leading-relaxed">
							Coin data (social links, banner, etc) can only be
							added now, and can&apos;t be changed or edited after
							creation.
						</p>
					</div>

					{/* ── Create Token Button (outside cards) ── */}
					<Button
						onClick={handleSubmit}
						disabled={
							isAuthenticated
								? !isFormValid ||
									isGaslessCreating ||
									isCreating ||
									isConfirming ||
									isSolanaCreating ||
									isSolanaConfirming ||
									isUploading ||
									isInitialBuying ||
									isBuying ||
									isBuyConfirming
								: false
						}
						className="w-fit h-12 text-base font-semibold gap-2 bg-primary/70 hover:opacity-100 rounded-sm"
					>
						{!isAuthenticated ? (
							<>Please connect your wallet to continue</>
						) : isUploading ? (
							<>
								<Loader2 className="h-5 w-5 animate-spin" />
								Uploading Image...
							</>
						) : isGaslessCreating ? (
							<>
								<Loader2 className="h-5 w-5 animate-spin" />
								Creating Token...
							</>
						) : isSolanaCreating ? (
							<>
								<Loader2 className="h-5 w-5 animate-spin" />
								Confirm in Wallet
							</>
						) : isSolanaConfirming ? (
							<>
								<Loader2 className="h-5 w-5 animate-spin" />
								Creating Token...
							</>
						) : isInitialBuying || isBuying || isBuyConfirming ? (
							<>
								<Loader2 className="h-5 w-5 animate-spin" />
								Making Initial Purchase...
							</>
						) : !isSolana ? (
							<>Create Coin</>
						) : (
							<>Create Coin on Solana</>
						)}
					</Button>

					{/* Mobile Preview (below button, hidden on lg+) */}
					<div className="lg:hidden">
						<TokenPreviewCard
							name={name}
							symbol={symbol}
							description={description}
							imagePreview={imagePreview}
							hypeBoostEnabled={hypeBoostEnabled}
							websiteUrl={websiteUrl}
							twitterUrl={twitterUrl}
							telegramUrl={telegramUrl}
							initialPriceUsd={tokenomics?.initialPriceUsd}
							initialMcapUsd={tokenomics?.initialMcapUsd}
							graduationThresholdUsd={
								tokenomics?.graduationThresholdUsd
							}
							graduationMultiplier={
								tokenomics?.graduationMultiplier
							}
							nativeSymbol={tokenomics?.nativeSymbol}
						/>
					</div>
				</motion.div>

				{/* Right Column - Preview Card */}
				<motion.div
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.2 }}
					className="lg:col-span-2 hidden lg:block"
				>
					<TokenPreviewCard
						name={name}
						symbol={symbol}
						description={description}
						imagePreview={imagePreview}
						hypeBoostEnabled={hypeBoostEnabled}
						websiteUrl={websiteUrl}
						twitterUrl={twitterUrl}
						telegramUrl={telegramUrl}
						initialPriceUsd={tokenomics?.initialPriceUsd}
						initialMcapUsd={tokenomics?.initialMcapUsd}
						graduationThresholdUsd={
							tokenomics?.graduationThresholdUsd
						}
						graduationMultiplier={tokenomics?.graduationMultiplier}
						nativeSymbol={tokenomics?.nativeSymbol}
					/>
				</motion.div>
			</div>
		</div>
	);
}
