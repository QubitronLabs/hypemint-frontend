"use client";

/**
 * BubbleMap Dialog Component
 * Shows InsightX Bubblemaps iframe for token holder visualization
 * @see https://docs.insightx.network/docs/web-integration
 */

import { useState } from "react";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";

interface BubbleMapDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tokenAddress?: string;
	tokenSymbol: string;
	chainId: number;
}

// InsightX supported chains (Mainnet only)
// @see https://docs.insightx.network/docs/supported-chains
const SUPPORTED_CHAINS: Record<
	number,
	{ name: string; chainIdParam: string | number }
> = {
	1: { name: "Ethereum", chainIdParam: 1 },
	56: { name: "BNB Chain", chainIdParam: 56 },
	137: { name: "Polygon", chainIdParam: 137 },
	8453: { name: "Base", chainIdParam: 8453 },
	42161: { name: "Arbitrum", chainIdParam: 42161 },
	43114: { name: "Avalanche", chainIdParam: 43114 },
	250: { name: "Fantom", chainIdParam: 250 },
	204: { name: "opBNB", chainIdParam: 204 },
	1284: { name: "Moonbeam", chainIdParam: 1284 },
};

// Testnet chain IDs that are NOT supported
const TESTNET_CHAINS: Record<number, string> = {
	80002: "Polygon Amoy (Testnet)",
	11155111: "Sepolia (Testnet)",
	97: "BSC Testnet",
	84532: "Base Sepolia (Testnet)",
	421614: "Arbitrum Sepolia (Testnet)",
};

export function BubbleMapDialog({
	open,
	onOpenChange,
	tokenAddress,
	tokenSymbol,
	chainId,
}: BubbleMapDialogProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	const supportedChain = SUPPORTED_CHAINS[chainId];
	const isTestnet = TESTNET_CHAINS[chainId];
	const isSupported = !!supportedChain && !isTestnet;

	// InsightX URL format: https://app.insightx.network/bubblemaps/[CHAIN_ID]/[TOKEN_ADDRESS]
	const iframeUrl =
		tokenAddress && isSupported
			? `https://app.insightx.network/bubblemaps/${supportedChain.chainIdParam}/${tokenAddress}`
			: null;

	const handleIframeLoad = () => {
		setIsLoading(false);
	};

	const handleIframeError = () => {
		setIsLoading(false);
		setHasError(true);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				onOpenChange(value);
				if (!value) {
					setIsLoading(true);
					setHasError(false);
				}
			}}
		>
			<DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
				<DialogHeader className="px-6 py-4 border-b border-border shrink-0">
					<div className="flex items-center justify-between">
						<div>
							<DialogTitle className="text-lg">
								Bubble Map - {tokenSymbol}
							</DialogTitle>
							<DialogDescription className="text-sm text-muted-foreground">
								Visualize token holder distribution and wallet
								clusters
							</DialogDescription>
						</div>
						{iframeUrl && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => window.open(iframeUrl, "_blank")}
								className="gap-2"
							>
								<ExternalLink className="h-4 w-4" />
								Open Full View
							</Button>
						)}
					</div>
				</DialogHeader>

				<div className="flex-1 relative overflow-hidden bg-background">
					{/* No token address */}
					{!tokenAddress ? (
						<div className="flex flex-col items-center justify-center h-full text-center p-8">
							<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
								<span className="text-3xl">🫧</span>
							</div>
							<h3 className="text-lg font-medium mb-2">
								Bubble Map Unavailable
							</h3>
							<p className="text-sm text-muted-foreground max-w-md">
								This token doesn&apos;t have a contract address
								yet. The bubble map will be available after the
								token is deployed on-chain.
							</p>
						</div>
					) : isTestnet ? (
						/* Testnet not supported */
						<div className="flex flex-col items-center justify-center h-full text-center p-8">
							<div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
								<AlertTriangle className="h-8 w-8 text-yellow-500" />
							</div>
							<h3 className="text-lg font-medium mb-2">
								Testnet Not Supported
							</h3>
							<p className="text-sm text-muted-foreground max-w-md mb-4">
								InsightX Bubblemaps only supports mainnet
								networks. This token is on{" "}
								<strong>{TESTNET_CHAINS[chainId]}</strong>.
							</p>
							<p className="text-xs text-muted-foreground">
								Bubble maps will be available when the token is
								deployed on mainnet.
							</p>
						</div>
					) : !isSupported ? (
						/* Chain not supported */
						<div className="flex flex-col items-center justify-center h-full text-center p-8">
							<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
								<span className="text-3xl">⛓️</span>
							</div>
							<h3 className="text-lg font-medium mb-2">
								Chain Not Supported
							</h3>
							<p className="text-sm text-muted-foreground max-w-md">
								Bubble maps are not available for this
								blockchain network (Chain ID: {chainId}).
							</p>
							<p className="text-xs text-muted-foreground mt-2">
								Supported: Ethereum, Base, BNB Chain, Polygon,
								Arbitrum, Avalanche
							</p>
						</div>
					) : hasError ? (
						/* Error loading iframe */
						<div className="flex flex-col items-center justify-center h-full text-center p-8">
							<div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
								<AlertTriangle className="h-8 w-8 text-destructive" />
							</div>
							<h3 className="text-lg font-medium mb-2">
								Failed to Load
							</h3>
							<p className="text-sm text-muted-foreground max-w-md">
								Unable to load the bubble map. The token may be
								too new or not yet indexed.
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-4"
								onClick={() => {
									setHasError(false);
									setIsLoading(true);
								}}
							>
								Try Again
							</Button>
						</div>
					) : (
						/* Show iframe */
						<>
							{isLoading && (
								<div className="absolute inset-0 flex items-center justify-center bg-background z-10">
									<div className="flex flex-col items-center gap-3">
										<Loader2 className="h-8 w-8 animate-spin text-primary" />
										<p className="text-sm text-muted-foreground">
											Loading bubble map...
										</p>
									</div>
								</div>
							)}
							<iframe
								src={iframeUrl!}
								className="w-full h-full border-0"
								onLoad={handleIframeLoad}
								onError={handleIframeError}
								title={`Bubble Map for ${tokenSymbol}`}
								allow="clipboard-write"
							/>
						</>
					)}
				</div>

				{/* Attribution */}
				<div className="px-6 py-3 border-t border-border shrink-0 bg-muted/30">
					<p className="text-xs text-muted-foreground text-center">
						Powered by{" "}
						<a
							href="https://insightx.network"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							InsightX
						</a>{" "}
						— Blockchain Intelligence & Analytics
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
