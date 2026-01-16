'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Zap,
  Clock,
  BarChart3,
  Sparkles,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenCard } from '@/components/token';
import { useTrendingTokens, useNewTokens } from '@/hooks/useTokens';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';

// Filter tabs inspired by pump.fun
const FILTER_TABS = [
  { id: 'movers', label: 'Movers', icon: TrendingUp },
  { id: 'live', label: 'Live', icon: Zap },
  { id: 'new', label: 'New', icon: Clock },
  { id: 'marketcap', label: 'Market cap', icon: BarChart3 },
  { id: 'mayhem', label: 'Mayhem', icon: Sparkles },
] as const;

type FilterTab = typeof FILTER_TABS[number]['id'];

// Mock tokens for development (replace with real API data)
const MOCK_TOKENS: Token[] = Array.from({ length: 12 }, (_, i) => ({
  id: `token-${i}`,
  name: ['Gascoin', 'GAMESTOP', 'Emotiguy', 'CARA', 'Troll Alon', 'World of Meme'][i % 6],
  symbol: ['GAS', 'GME', 'EMOTI', 'CARA', 'TROLL', 'WOM'][i % 6],
  description: 'A revolutionary memecoin',
  imageUrl: '',
  totalSupply: '1000000000',
  initialPrice: '0.00001',
  currentPrice: (0.00001 + Math.random() * 0.001).toString(),
  marketCap: (Math.random() * 1000000).toString(),
  volume24h: (Math.random() * 100000).toString(),
  priceChange24h: (Math.random() - 0.5) * 40,
  chainId: 1,
  status: 'active',
  creatorId: 'creator-1',
  creator: {
    id: 'creator-1',
    walletAddress: '0x1234...5678',
    username: 'degen_user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  bondingCurveProgress: Math.random() * 100,
  graduationTarget: '100',
  currentBondingAmount: (Math.random() * 100).toString(),
  holdersCount: Math.floor(Math.random() * 1000),
  tradesCount: Math.floor(Math.random() * 5000),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('movers');

  // Fetch tokens based on filter
  const { data: trendingData, isLoading: trendingLoading } = useTrendingTokens();
  const { data: newData, isLoading: newLoading } = useNewTokens();

  // Use mock data for now, replace with real data when API is available
  const tokens = MOCK_TOKENS;
  const isLoading = false;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl font-bold mb-2">
          <span className="text-gradient">Now trending</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Discover the hottest memecoins launched in the last 24 hours
        </p>
      </motion.div>

      {/* Trending Highlights - Horizontal scroll */}
      <div className="mb-8 overflow-x-auto scrollbar-thin">
        <div className="flex gap-4 pb-2">
          {tokens.slice(0, 6).map((token, index) => (
            <motion.div
              key={token.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 w-48"
            >
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{token.name}</p>
                    <p className="text-xs text-muted-foreground">{token.symbol}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">market cap</span>
                  <span className={cn(
                    'text-xs font-medium',
                    token.priceChange24h >= 0 ? 'text-[#00ff88]' : 'text-destructive'
                  )}>
                    {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-thin pb-2">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;

          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </motion.button>
          );
        })}

        {/* More Filters */}
        <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
          <Filter className="h-4 w-4" />
          More
        </Button>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-4 w-full mt-4" />
            </div>
          ))
        ) : (
          // Token cards
          tokens.map((token, index) => (
            <motion.div
              key={token.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <TokenCard token={token} />
            </motion.div>
          ))
        )}
      </div>

      {/* Load More */}
      <div className="flex justify-center mt-8">
        <Button variant="outline" size="lg" className="gap-2">
          Load more tokens
        </Button>
      </div>
    </div>
  );
}
