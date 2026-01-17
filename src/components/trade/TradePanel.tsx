'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Loader2, AlertCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTradeQuote, useCreateTrade } from '@/hooks/useTrades';
import type { Token, TradeType } from '@/types';

interface TradePanelProps {
    token: Token;
    className?: string;
}

const QUICK_AMOUNTS = ['0.1', '0.5', '1', '5'];
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

export function TradePanel({ token, className }: TradePanelProps) {
    const [tradeType, setTradeType] = useState<TradeType>('buy');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(1);

    const {
        data: quote,
        isLoading: quoteLoading,
    } = useTradeQuote(
        token.id,
        tradeType,
        amount,
        !!amount && parseFloat(amount) > 0
    );

    const createTrade = useCreateTrade();

    const handleAmountChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value)) {
            setAmount(value);
        }
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
            setAmount('');
        } catch (error) {
            console.error('Trade failed:', error);
        }
    }, [amount, token.id, tradeType, slippage, createTrade]);

    const isBuy = tradeType === 'buy';

    return (
        <div className={cn('bg-card border border-border rounded-xl', className)}>
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Trade {token.symbol}</h3>
                <span className="text-xs text-primary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full pulse-live" />
                    Live
                </span>
            </div>

            <div className="p-4">
                {/* Buy/Sell Tabs */}
                <Tabs
                    value={tradeType}
                    onValueChange={(v) => setTradeType(v as TradeType)}
                >
                    <TabsList className="w-full grid grid-cols-2 bg-muted">
                        <TabsTrigger
                            value="buy"
                            className={cn(
                                'font-semibold',
                                isBuy && 'bg-primary text-primary-foreground'
                            )}
                        >
                            Buy
                        </TabsTrigger>
                        <TabsTrigger
                            value="sell"
                            className={cn(
                                'font-semibold',
                                !isBuy && 'bg-destructive text-white'
                            )}
                        >
                            Sell
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Balance */}
                <div className="flex items-center justify-between mt-4 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5" />
                        Balance
                    </span>
                    <span className="font-medium tabular-nums">0.00 SOL</span>
                </div>

                {/* Amount Input */}
                <div className="mt-4">
                    <div className="relative">
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="text-xl font-bold h-14 pr-16 bg-muted border-transparent"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            SOL
                        </span>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                        {QUICK_AMOUNTS.map((qa) => (
                            <button
                                key={qa}
                                onClick={() => setAmount(qa)}
                                className={cn(
                                    'py-2 rounded-lg text-sm font-medium transition-colors',
                                    amount === qa
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {qa} SOL
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quote */}
                <AnimatePresence>
                    {quoteLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : quote && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-3 rounded-lg bg-muted space-y-2"
                        >
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">You receive</span>
                                <span className="font-medium tabular-nums">
                                    {parseFloat(quote.outputAmount).toFixed(4)} {isBuy ? token.symbol : 'SOL'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Price impact</span>
                                <span className={cn(
                                    'font-medium tabular-nums',
                                    quote.priceImpact > 5 && 'text-yellow-500',
                                    quote.priceImpact > 10 && 'text-destructive'
                                )}>
                                    {quote.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Slippage */}
                <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                        <Settings2 className="h-3 w-3" />
                        Slippage: {slippage}%
                    </span>
                    <div className="flex gap-1">
                        {SLIPPAGE_OPTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setSlippage(s)}
                                className={cn(
                                    'px-2 py-1 rounded text-xs',
                                    slippage === s
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                )}
                            >
                                {s}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Trade Button */}
                <Button
                    onClick={handleTrade}
                    disabled={!amount || createTrade.isPending || parseFloat(amount) <= 0}
                    className={cn(
                        'w-full mt-4 h-12 font-bold text-base',
                        isBuy
                            ? 'bg-primary hover:bg-primary/90'
                            : 'bg-destructive hover:bg-destructive/90'
                    )}
                >
                    {createTrade.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        `${isBuy ? 'Buy' : 'Sell'} ${token.symbol}`
                    )}
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-3">
                    Trade at your own risk. DYOR.
                </p>
            </div>
        </div>
    );
}
