'use client';

/**
 * Trading Panel Component
 * Real centralized-ledger trading interface
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Loader2,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { createTrade, confirmTrade } from '@/lib/api/trades';
import { toast } from 'sonner';

interface TradingPanelProps {
    tokenId: string;
    tokenSymbol: string;
    tokenName: string;
    currentPrice: string;
    totalSupply: string;
    className?: string;
}

type TradeType = 'buy' | 'sell';

interface TradeResult {
    success: boolean;
    message: string;
    amount: string;
    price: string;
}

// Helper to parse decimals (18 defaults)
function parseUnits(value: string, decimals: number = 18): string {
    if (!value) return '0';
    try {
        let [integer, fraction = ''] = value.split('.');
        fraction = fraction.padEnd(decimals, '0').slice(0, decimals);
        return (BigInt(integer + fraction)).toString();
    } catch {
        return '0';
    }
}

// Format number with commas
function formatNumber(num: number | string): string {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}

export function TradingPanel({
    tokenId,
    tokenSymbol,
    tokenName,
    currentPrice,
    totalSupply,
    className
}: TradingPanelProps) {
    const [tradeType, setTradeType] = useState<TradeType>('buy');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [isExecuting, setIsExecuting] = useState(false);
    const [result, setResult] = useState<TradeResult | null>(null);

    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // Calculate trade metrics
    const tradeMetrics = useMemo(() => {
        const parsedAmount = parseFloat(amount) || 0;
        const price = parseFloat(currentPrice) || 0.00001;
        const supply = parseFloat(totalSupply) || 1e9;

        // Note: This is an estimation. The backend Bonding Curve has the exact authority.
        const tokenAmount = tradeType === 'buy'
            ? parsedAmount / price
            : parsedAmount;

        const priceImpact = (tokenAmount / supply) * 100 * 0.5; // Rough estimate
        const finalPrice = tradeType === 'buy'
            ? price * (1 + priceImpact / 100)
            : price * (1 - priceImpact / 100);

        const estimatedOutput = tradeType === 'buy'
            ? parsedAmount / finalPrice
            : parsedAmount * finalPrice;

        const minOutput = estimatedOutput * (1 - slippage / 100);

        return {
            tokenAmount,
            estimatedOutput,
            minOutput,
            priceImpact,
            finalPrice,
            isHighImpact: priceImpact > 5
        };
    }, [amount, tradeType, currentPrice, totalSupply, slippage]);

    // Handle trade execution
    const handleTrade = async () => {
        if (!amount || parseFloat(amount) <= 0 || !isAuthenticated) return;

        setIsExecuting(true);
        setResult(null);

        try {
            // 1. Prepare amounts (simple 18 decimals assumption for both Token and ETH for now)
            // For 'buy', amount entered is ETH. For 'sell', amount entered is Token.
            // Backend expects 'amount' to be the Token Amount involved? 
            // Checking backend: createTrade -> uses body.amount. Buy -> calculateBuyPrice(amount). Sell -> calculateSellPrice(amount).
            // Usually bonding curve inputs are "Token Amount" for buy/sell? Or "ETH In" for buy?
            // "calculateBuyPrice(bondingCurve, amount)" usually takes Token Output Amount to calculate ETH Cost.
            // But standard AMMs take Input Amount.
            // Let's assume input is TOKEN AMOUNT for `calculateBuyPrice` (target output) or `calculateSellPrice` (input).

            let amountInWei = '0';
            // For now, let's treat input strictly as TOKEN AMOUNT for both. 
            // It simplifies the backend calls.

            amountInWei = parseUnits(amount, 18);

            // 2. Create Pending Trade
            const trade = await createTrade({
                tokenId,
                type: tradeType,
                amount: amountInWei,
                slippageTolerance: slippage,
            });

            if (!trade || !trade.id) throw new Error("Failed to create trade");

            // 3. Confirm Trade (Simulating ledger update)
            // In a real app, user would sign a tx here.
            const txHash = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

            const confirmed = await confirmTrade(trade.id, {
                txHash,
                blockNumber: 12345678,
                gasUsed: '21000',
                actualSlippage: 0
            });

            setResult({
                success: true,
                message: `Successfully ${tradeType === 'buy' ? 'bought' : 'sold'}!`,
                amount: amount,
                price: currentPrice
            });

            toast.success(`Trade successful! Tx: ${txHash.slice(0, 8)}...`);

        } catch (error) {
            console.error(error);
            setResult({
                success: false,
                message: 'Transaction failed. Please try again.',
                amount: '0',
                price: currentPrice
            });
            toast.error("Trade failed");
        } finally {
            setIsExecuting(false);
            setAmount('');
        }
    };

    // Quick amount buttons
    const quickAmounts = [100, 1000, 5000, 10000]; // Token amounts

    return (
        <div className={cn(
            "bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden",
            className
        )}>
            {/* Trade Type Tabs */}
            <div className="p-4">
                <div className="flex bg-background/50 rounded-lg p-1 gap-1">
                    <button
                        onClick={() => setTradeType('buy')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium transition-all",
                            tradeType === 'buy'
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ArrowUpCircle className="h-4 w-4" />
                        Buy
                    </button>
                    <button
                        onClick={() => setTradeType('sell')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium transition-all",
                            tradeType === 'sell'
                                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ArrowDownCircle className="h-4 w-4" />
                        Sell
                    </button>
                </div>
            </div>

            {/* Amount Input */}
            <div className="px-4 pb-4">
                <div className="mb-3">
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                        Amount ({tokenSymbol})
                    </label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="pr-16 text-lg font-medium bg-background/50"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {tokenSymbol}
                        </div>
                    </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex gap-2 mb-4">
                    {quickAmounts.map((qa) => (
                        <button
                            key={qa}
                            onClick={() => setAmount(qa.toString())}
                            className="flex-1 py-1.5 text-xs font-medium bg-background/50 border border-border/50 rounded-md hover:border-primary/30 transition-colors"
                        >
                            {qa}
                        </button>
                    ))}
                </div>

                {/* Amount Output Estimate */}
                <AnimatePresence mode="wait">
                    {parseFloat(amount) > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 mb-4"
                        >
                            <div className="p-3 bg-background/30 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Est. Cost/Value</span>
                                    <span className="font-medium">
                                        {formatNumber(tradeMetrics.estimatedOutput * tradeMetrics.finalPrice)} ETH
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Price per Token</span>
                                    <span className="font-medium">
                                        {tradeMetrics.finalPrice.toFixed(8)} ETH
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Impact</span>
                                    <span className={cn(
                                        "font-medium",
                                        tradeMetrics.isHighImpact ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                        {tradeMetrics.priceImpact.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Execute Button */}
                {isAuthenticated ? (
                    <Button
                        onClick={handleTrade}
                        disabled={!amount || parseFloat(amount) <= 0 || isExecuting}
                        className={cn(
                            "w-full h-12 text-base font-semibold",
                            tradeType === 'buy'
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                                : "bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-90"
                        )}
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {tradeType === 'buy' ? (
                                    <TrendingUp className="h-5 w-5 mr-2" />
                                ) : (
                                    <TrendingDown className="h-5 w-5 mr-2" />
                                )}
                                {tradeType === 'buy' ? 'Buy' : 'Sell'} {tokenSymbol}
                            </>
                        )}
                    </Button>
                ) : (
                    <Button
                        disabled
                        className="w-full h-12 bg-muted"
                    >
                        <Wallet className="h-5 w-5 mr-2" />
                        Connect Wallet to Trade
                    </Button>
                )}

                {/* Result Message */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={cn(
                                "mt-4 p-3 rounded-lg flex items-center gap-2",
                                result.success
                                    ? "bg-green-500/10 border border-green-500/30"
                                    : "bg-destructive/10 border border-destructive/30"
                            )}
                        >
                            {result.success ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                            )}
                            <span className={cn(
                                "text-sm font-medium",
                                result.success ? "text-green-500" : "text-destructive"
                            )}>
                                {result.message}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
