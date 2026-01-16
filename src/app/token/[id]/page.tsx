'use client';

import { use, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
    Globe,
    Twitter,
    MessageCircle,
    ExternalLink,
    Share2,
    Star,
    Copy,
    Check,
    Users,
    Activity,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceChart } from '@/components/charts';
import { TradePanel, TradeTape } from '@/components/trade';
import { BondingCurveProgress } from '@/components/token';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useToken } from '@/hooks/useTokens';
import { useTokenTrades } from '@/hooks/useTrades';
import { cn } from '@/lib/utils';
import type { Token, TokenHolder } from '@/types';

// Mock token for development
const MOCK_TOKEN: Token = {
    id: 'gorse-1',
    name: 'GORSE',
    symbol: 'GORSE',
    description: 'The most based memecoin on the internet.',
    imageUrl: '',
    websiteUrl: 'https://example.com',
    twitterUrl: 'https://twitter.com/gorse',
    telegramUrl: '',
    discordUrl: '',
    totalSupply: '1000000000',
    initialPrice: '0.00001',
    currentPrice: '0.00000887',
    marketCap: '8900',
    volume24h: '18300',
    priceChange24h: 112.75,
    chainId: 1,
    status: 'active',
    creatorId: 'creator-1',
    creator: {
        id: 'creator-1',
        walletAddress: '7sEbqh...raLE',
        displayName: '7sEbqh...raLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    bondingCurveProgress: 43,
    graduationTarget: '59888',
    currentBondingAmount: '13588',
    holdersCount: 156,
    tradesCount: 885,
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
};

// Mock holders
const MOCK_HOLDERS: TokenHolder[] = [
    { address: 'Liquidity pool 🔥', balance: '68550000', percentage: 68.55 },
    { address: '6DjQ...ZxM', balance: '3410000', percentage: 3.41 },
    { address: '6u05...QRoW', balance: '3070000', percentage: 3.07 },
    { address: '2GyY...esdx', balance: '2840000', percentage: 2.84 },
    { address: 'C8ij...Xx8y', balance: '2670000', percentage: 2.67 },
];

interface TokenDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function TokenDetailPage({ params }: TokenDetailPageProps) {
    const { id } = use(params);
    const [copied, setCopied] = useState(false);

    // Fetch token data
    const { data: token, isLoading } = useToken(id);
    const { data: trades } = useTokenTrades(id);

    // Merge API data with mock data to ensure all fields exist
    const displayToken = token ? { ...MOCK_TOKEN, ...token } : MOCK_TOKEN;
    const holders = MOCK_HOLDERS;

    const handleCopy = () => {
        navigator.clipboard.writeText(displayToken.id || id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const pricePositive = (displayToken.priceChange24h ?? 0) >= 0;

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
                                {/* Token Image */}
                                <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                                    {displayToken.imageUrl ? (
                                        <Image
                                            src={displayToken.imageUrl}
                                            alt={displayToken.name || 'Token'}
                                            width={64}
                                            height={64}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                            {displayToken.symbol?.slice(0, 2) || '??'}
                                        </div>
                                    )}
                                </div>

                                {/* Token Info */}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold">{displayToken.name}</h1>
                                        <Badge variant="outline" className="text-xs">
                                            {displayToken.symbol}
                                        </Badge>
                                        {displayToken.status === 'active' && (
                                            <Badge className="bg-primary/20 text-primary text-xs">
                                                @DEW_pump
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                            Created by
                                        </span>
                                        <Link
                                            href={`/profile/${displayToken.creatorId}`}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            {displayToken.creator?.displayName ||
                                                `${displayToken.creator?.walletAddress.slice(0, 6)}...`}
                                        </Link>
                                        <span className="text-xs text-muted-foreground">
                                            20m ago
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
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
                                <span className="text-3xl font-bold">${parseFloat(displayToken.marketCap).toLocaleString()}</span>
                                <span
                                    className={cn(
                                        'text-sm font-medium flex items-center gap-1',
                                        pricePositive ? 'text-[#00ff88]' : 'text-destructive'
                                    )}
                                >
                                    {pricePositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                    {pricePositive ? '+' : ''}{displayToken.priceChange24h.toFixed(2)}% 24hr
                                </span>
                            </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                            <div>
                                <p className="text-xs text-muted-foreground">Vol 24h</p>
                                <p className="font-semibold tabular-nums">
                                    ${parseFloat(displayToken.volume24h).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Price</p>
                                <p className="font-semibold tabular-nums">
                                    ${parseFloat(displayToken.currentPrice).toFixed(8)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">5m</p>
                                <p className="font-semibold tabular-nums text-[#00ff88]">
                                    +12.45%
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">6h</p>
                                <p className="font-semibold tabular-nums text-[#00ff88]">
                                    +112.75%
                                </p>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
                            {displayToken.websiteUrl && (
                                <a
                                    href={displayToken.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Globe className="h-3 w-3" />
                                    Website
                                </a>
                            )}
                            {displayToken.twitterUrl && (
                                <a
                                    href={displayToken.twitterUrl}
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
                                {copied ? 'Copied!' : 'View on Terminal'}
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
                        <Tabs defaultValue="comments">
                            <TabsList className="w-full bg-card border border-border">
                                <TabsTrigger value="comments" className="flex-1">
                                    Comments
                                </TabsTrigger>
                                <TabsTrigger value="trades" className="flex-1">
                                    Trades
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="comments" className="mt-4">
                                <div className="bg-card border border-border rounded-xl p-6 text-center">
                                    <div className="flex items-center gap-2 mb-4">
                                        <input
                                            type="text"
                                            placeholder="Add a comment..."
                                            className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm"
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground py-8">
                                        <span className="animate-pulse">Loading...</span>
                                    </p>
                                </div>
                            </TabsContent>
                            <TabsContent value="trades" className="mt-4">
                                <TradeTape tokenId={id} initialTrades={trades || []} />
                            </TabsContent>
                        </Tabs>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Trade Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <TradePanel token={displayToken} />
                    </motion.div>

                    {/* Bonding Curve Progress */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card border border-border rounded-xl p-4"
                    >
                        <BondingCurveProgress
                            progress={displayToken.bondingCurveProgress}
                            currentAmount={displayToken.currentBondingAmount}
                            targetAmount={displayToken.graduationTarget}
                        />
                    </motion.div>

                    {/* Token Chat */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-card border border-border rounded-xl p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-sm">{displayToken.symbol} chat</span>
                            <Button size="sm" variant="outline" className="h-7 text-xs">
                                💬 Join chat
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Chat with others about this token
                        </p>
                    </motion.div>

                    {/* Top Holders */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-card border border-border rounded-xl p-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold text-sm">Top holders</span>
                            <button className="text-xs text-primary hover:underline">
                                Generate bubble map
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
                </div>
            </div>
        </div>
    );
}
