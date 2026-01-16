'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownUp, Settings2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTradeQuote, useCreateTrade } from '@/hooks/useTrades';
import type { Token, TradeType } from '@/types';

interface TradePanelProps {
    token: Token;
    className?: string;
}

const QUICK_AMOUNTS = ['0.1', '0.5', '1', '5'];
const DEFAULT_SLIPPAGE = 1;

/**
 * TradePanel - Buy/Sell interface for tokens
 * 
 * Features:
 * - Buy/Sell toggle
 * - Amount input with quick select buttons
 * - Real-time price quote
 * - Slippage tolerance setting
 * - Price impact warning
 */
export function TradePanel({ token, className }: TradePanelProps) {
    const [tradeType, setTradeType] = useState<TradeType>('buy');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
    const [showSlippageSettings, setShowSlippageSettings] = useState(false);

    // Debounced quote fetching
    const [debouncedAmount, setDebouncedAmount] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedAmount(amount);
        }, 300);
        return () => clearTimeout(timer);
    }, [amount]);

    // Get quote
    const {
        data: quote,
        isLoading: quoteLoading,
        error: quoteError,
    } = useTradeQuote(
        token.id,
        tradeType,
        debouncedAmount,
        !!debouncedAmount && parseFloat(debouncedAmount) > 0
    );

    // Create trade mutation
    const createTrade = useCreateTrade();

    const handleAmountChange = (value: string) => {
        // Only allow valid numbers
        if (/^\d*\.?\d*$/.test(value)) {
            setAmount(value);
        }
    };

    const handleQuickAmount = (quickAmount: string) => {
        setAmount(quickAmount);
    };

    const handleTrade = useCallback(async () => {
        if (!amount || parseFloat(amount) <= 0) return;

        try {
            await createTrade.mutateAsync({
                tokenId: token.id,
                type: tradeType,
                amount,
                slippageTolerance: slippage,
            });
            // Reset amount on success
            setAmount('');
        } catch (error) {
            console.error('Trade failed:', error);
        }
    }, [amount, token.id, tradeType, slippage, createTrade]);

    const isBuy = tradeType === 'buy';
    const hasHighPriceImpact = quote && quote.priceImpact > 5;

    return (
        <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
            {/* Buy/Sell Tabs */}
            <Tabs
                value={tradeType}
                onValueChange={(v) => setTradeType(v as TradeType)}
                className="w-full"
            >
                <TabsList className="w-full grid grid-cols-2 bg-muted">
                    <TabsTrigger
                        value="buy"
                        className={cn(
                            'data-[state=active]:bg-[#00ff88] data-[state=active]:text-black',
                            'font-semibold transition-all'
                        )}
                    >
                        Buy
                    </TabsTrigger>
                    <TabsTrigger
                        value="sell"
                        className={cn(
                            'data-[state=active]:bg-destructive data-[state=active]:text-white',
                            'font-semibold transition-all'
                        )}
                    >
                        Sell
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Switch to token toggle */}
            <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-muted-foreground">
                    Switch to {token.symbol}
                </span>
                <button className="text-primary hover:text-primary/80 flex items-center gap-1">
                    <ArrowDownUp className="h-3 w-3" />
                    Set max slippage
                </button>
            </div>

            {/* Balance Display */}
            <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-muted-foreground">balance:</span>
                <span className="font-medium tabular-nums">0 SOL</span>
            </div>

            {/* Amount Input */}
            <div className="mt-4 space-y-3">
                <div className="relative">
                    <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className={cn(
                            'text-lg font-semibold h-14 pr-16 bg-muted border-transparent',
                            'focus:border-primary/50 placeholder:text-muted-foreground'
                        )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">SOL</span>
                    </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((quickAmount) => (
                        <Button
                            key={quickAmount}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAmount(quickAmount)}
                            className={cn(
                                'text-xs font-medium',
                                amount === quickAmount && 'border-primary bg-primary/10'
                            )}
                        >
                            {quickAmount} SOL
                        </Button>
                    ))}
                </div>
            </div>

            {/* Quote Display */}
            <AnimatePresence mode="wait">
                {quoteLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center py-4"
                    >
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </motion.div>
                ) : quote ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 space-y-2 text-sm"
                    >
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">You receive</span>
                            <span className="font-semibold tabular-nums">
                                {parseFloat(quote.outputAmount).toFixed(4)} {isBuy ? token.symbol : 'SOL'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Price</span>
                            <span className="tabular-nums">
                                ${parseFloat(quote.price).toFixed(8)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Price impact</span>
                            <span
                                className={cn(
                                    'tabular-nums',
                                    hasHighPriceImpact && 'text-destructive font-medium'
                                )}
                            >
                                {quote.priceImpact.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Fee</span>
                            <span className="tabular-nums">{quote.fee} SOL</span>
                        </div>
                    </motion.div>
                ) : quoteError ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 mt-4 text-destructive text-sm"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed to get quote</span>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* Price Impact Warning */}
            {hasHighPriceImpact && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive"
                >
                    ⚠️ High price impact! Consider reducing your trade size.
                </motion.div>
            )}

            {/* Slippage Settings */}
            <div className="mt-4 flex items-center justify-between">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <Settings2 className="h-3 w-3" />
                                Slippage: {slippage}%
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Maximum price change you&apos;re willing to accept</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Slippage Quick Select */}
            <AnimatePresence>
                {showSlippageSettings && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 grid grid-cols-4 gap-2"
                    >
                        {[0.5, 1, 2, 5].map((s) => (
                            <Button
                                key={s}
                                variant="outline"
                                size="sm"
                                onClick={() => setSlippage(s)}
                                className={cn(
                                    'text-xs',
                                    slippage === s && 'border-primary bg-primary/10'
                                )}
                            >
                                {s}%
                            </Button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trade Button */}
            <Button
                onClick={handleTrade}
                disabled={!amount || createTrade.isPending || parseFloat(amount) <= 0}
                className={cn(
                    'w-full mt-4 h-12 font-bold text-lg',
                    isBuy
                        ? 'bg-[#00ff88] hover:bg-[#00ff88]/90 text-black'
                        : 'bg-destructive hover:bg-destructive/90 text-white'
                )}
            >
                {createTrade.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    `${isBuy ? 'Buy' : 'Sell'} ${token.symbol}`
                )}
            </Button>
        </div>
    );
}
