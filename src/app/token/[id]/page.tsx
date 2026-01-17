'use client';

import { use, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
    Globe,
    Twitter,
    Share2,
    Star,
    Copy,
    Check,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceChart } from '@/components/charts';
import { TradePanel, TradeTape, TradingPanel } from '@/components/trade';
import { BondingCurveProgress, TokenChat } from '@/components/token';
import { useToken } from '@/hooks/useTokens';
import { useTokenTrades } from '@/hooks/useTrades';
import { cn } from '@/lib/utils';
import type { Token, TokenHolder } from '@/types';

interface TokenDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function TokenDetailPage({ params }: TokenDetailPageProps) {
    const { id } = use(params);
    const [copied, setCopied] = useState(false);

    const { data: token, isLoading, error } = useToken(id);
    const { data: trades } = useTokenTrades(id);

    // Placeholder for holders until indexer is ready
    const holders: TokenHolder[] = [];

    const handleCopy = () => {
        if (!token) return;
        navigator.clipboard.writeText(token.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <div className="grid lg:grid-cols-[1fr_350px] gap-6">
                    <div className="space-y-6">
                        <Skeleton className="h-32 rounded-xl" />
                        <Skeleton className="h-[400px] rounded-xl" />
                        <Skeleton className="h-[300px] rounded-xl" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-[400px] rounded-xl" />
                        <Skeleton className="h-[200px] rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !token) {
        return (
            <div className="max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
                <h1 className="text-3xl font-bold mb-4">Token not found</h1>
                <p className="text-muted-foreground mb-6">
                    The token you are looking for does not exist or has been removed.
                </p>
                <Link href="/">
                    <Button>Return to Home</Button>
                </Link>
            </div>
        );
    }

    const pricePositive = (token.priceChange24h ?? 0) >= 0;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="grid lg:grid-cols-[1fr_350px] gap-6">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Token Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-xl p-6"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                                    {token.imageUrl ? (
                                        <Image
                                            src={token.imageUrl.replace('0.0.0.0', 'localhost')}
                                            alt={token.name || 'Token'}
                                            width={64}
                                            height={64}
                                            unoptimized
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                            {token.symbol?.slice(0, 2) || '??'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold">{token.name}</h1>
                                        <Badge variant="outline" className="text-xs">
                                            {token.symbol}
                                        </Badge>
                                        {token.status === 'active' && (
                                            <Badge className="bg-primary/20 text-primary text-xs">
                                                Live
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                            Created by
                                        </span>
                                        <Link
                                            href={`/user/${token.creator?.walletAddress || ''}`}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            {token.creator?.displayName || token.creator?.username ||
                                                (token.creator?.walletAddress ? `${token.creator.walletAddress.slice(0, 6)}...` : 'Unknown')}
                                        </Link>
                                        <span className="text-xs text-muted-foreground">
                                            {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon">
                                    <Star className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Price Stats */}
                        <div className="mt-6">
                            <div className="flex items-baseline gap-2">
                                <span className="text-muted-foreground text-sm">Market Cap</span>
                            </div>
                            <div className="flex items-baseline gap-3 mt-1">
                                <span className="text-3xl font-bold">${parseFloat(token.marketCap ?? '0').toLocaleString()}</span>
                                <span
                                    className={cn(
                                        'text-sm font-medium flex items-center gap-1',
                                        pricePositive ? 'text-[#00ff88]' : 'text-destructive'
                                    )}
                                >
                                    {pricePositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                    {pricePositive ? '+' : ''}{(token.priceChange24h ?? 0).toFixed(2)}% 24hr
                                </span>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                            <div>
                                <p className="text-xs text-muted-foreground">Vol 24h</p>
                                <p className="font-semibold tabular-nums">
                                    ${parseFloat(token.volume24h ?? '0').toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Price</p>
                                <p className="font-semibold tabular-nums">
                                    ${parseFloat(token.currentPrice ?? '0').toFixed(8)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Holders</p>
                                <p className="font-semibold tabular-nums">
                                    {token.holdersCount ?? 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Trades</p>
                                <p className="font-semibold tabular-nums">
                                    {token.tradesCount ?? 0}
                                </p>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
                            {token.websiteUrl && (
                                <a
                                    href={token.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Globe className="h-3 w-3" />
                                    Website
                                </a>
                            )}
                            {token.twitterUrl && (
                                <a
                                    href={token.twitterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Twitter className="h-3 w-3" />
                                    Twitter
                                </a>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-6 text-xs gap-1"
                            >
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? 'Copied!' : 'Copy Address'}
                            </Button>
                        </div>
                    </motion.div>

                    {/* Price Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <PriceChart tokenId={id} />
                    </motion.div>

                    {/* Comments / Trades Tabs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Tabs defaultValue="trades">
                            <TabsList className="w-full bg-card border border-border">
                                <TabsTrigger value="comments" className="flex-1">
                                    Comments
                                </TabsTrigger>
                                <TabsTrigger value="trades" className="flex-1">
                                    Trades
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="comments" className="mt-4">
                                <TokenChat tokenId={id} className="min-h-[350px]" />
                            </TabsContent>
                            <TabsContent value="trades" className="mt-4">
                                <TradeTape tokenId={id} initialTrades={trades || []} />
                            </TabsContent>
                        </Tabs>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Trading Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <TradingPanel
                            tokenId={id}
                            tokenSymbol={token.symbol || 'TOKEN'}
                            tokenName={token.name || 'Unknown Token'}
                            currentPrice={token.currentPrice || '0.00001'}
                            totalSupply={token.totalSupply || '1000000000'}
                        />
                    </motion.div>

                    {/* Bonding Curve */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card border border-border rounded-xl p-4"
                    >
                        <BondingCurveProgress
                            progress={token.bondingCurveProgress ?? 0}
                            currentAmount={token.currentBondingAmount || '0'}
                            targetAmount={token.graduationTarget || '100'}
                        />
                    </motion.div>

                    {/* Top Holders - Hidden if empty */}
                    {holders.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-card border border-border rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-semibold text-sm">Top holders</span>
                                <button className="text-xs text-primary hover:underline">
                                    View all
                                </button>
                            </div>
                            <div className="space-y-2">
                                {holders.map((holder, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">
                                                {index === 0 ? '🔥' : `${index + 1}.`}
                                            </span>
                                            <span className="font-mono text-xs">
                                                {holder.address}
                                            </span>
                                        </div>
                                        <span className="tabular-nums font-medium">
                                            {holder.percentage.toFixed(2)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
