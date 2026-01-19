'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  BarChart3,
  Sparkles,
  Search,
  Rocket,
  Flame,
  TrendingUp,
  Clock,
  Trophy,
  Plus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenCard } from '@/components/token';
import { useTrendingTokens, useNewTokens, useTokens } from '@/hooks/useTokens';
import { useNewTokenFeed, useGlobalTradeFeed } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Token } from '@/types';

// Filter tabs configuration
const FILTER_TABS = [
  { id: 'all', label: 'All', icon: BarChart3, description: 'All tokens' },
  { id: 'trending', label: 'Trending', icon: Flame, description: 'Hot right now' },
  { id: 'new', label: 'New', icon: Sparkles, description: 'Just launched' },
  { id: 'live', label: 'Live', icon: Zap, description: 'Active trading' },
  { id: 'graduated', label: 'Graduated', icon: Trophy, description: 'Made it' },
] as const;

type FilterTab = typeof FILTER_TABS[number]['id'];

// Live activity indicator component
function LiveIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
      isConnected
        ? "bg-green-500/10 text-green-500 border border-green-500/20"
        : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
    )}>
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
}

// Recent activity feed item
interface ActivityItem {
  id: string;
  type: 'new_token' | 'trade';
  tokenSymbol: string;
  tokenName?: string;
  message: string;
  timestamp: number;
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Live Activity</span>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {items.slice(0, 5).map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              className="flex items-center gap-3 text-sm py-2 border-b border-border/30 last:border-0"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                item.type === 'new_token' ? "bg-primary/20 text-primary" : "bg-green-500/20 text-green-500"
              )}>
                {item.type === 'new_token' ? <Sparkles className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate">{item.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stats card component
function StatsCard({ icon: Icon, label, value, trend }: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: number;
}) {
  return (
    <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {trend !== undefined && (
          <div className={cn(
            "ml-auto text-xs font-medium px-2 py-1 rounded",
            trend >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            {trend >= 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data
  const { data: allTokens = [], isLoading: allLoading, refetch: refetchAll } = useTokens({ page: 1, pageSize: 50 });
  const { data: trendingTokens = [], isLoading: trendingLoading } = useTrendingTokens();
  const { data: newTokens = [], isLoading: newLoading } = useNewTokens();

  // WebSocket: Listen for new tokens
  useNewTokenFeed(useCallback((newToken) => {
    setWsConnected(true);

    // Add to activity feed
    const activity: ActivityItem = {
      id: `token-${newToken.tokenId}-${Date.now()}`,
      type: 'new_token',
      tokenSymbol: newToken.symbol,
      tokenName: newToken.name,
      message: `${newToken.name} ($${newToken.symbol}) just launched!`,
      timestamp: Date.now(),
    };

    setActivityFeed(prev => [activity, ...prev].slice(0, 20));

    // Refetch tokens after a small delay
    setTimeout(() => refetchAll(), 1000);
  }, [refetchAll]));

  // WebSocket: Listen for trades
  useGlobalTradeFeed(useCallback((trade) => {
    setWsConnected(true);

    const activity: ActivityItem = {
      id: `trade-${trade.tradeId}-${Date.now()}`,
      type: 'trade',
      tokenSymbol: trade.tokenSymbol,
      message: `${trade.username || 'Someone'} ${trade.type === 'buy' ? 'bought' : 'sold'} $${trade.tokenSymbol}`,
      timestamp: Date.now(),
    };

    setActivityFeed(prev => [activity, ...prev].slice(0, 20));
  }, []));

  // Determine display tokens
  const getDisplayTokens = (): Token[] => {
    switch (activeFilter) {
      case 'trending':
        return Array.isArray(trendingTokens) ? trendingTokens : [];
      case 'new':
        return Array.isArray(newTokens) ? newTokens : [];
      case 'graduated':
        return allTokens.filter(t => t.status === 'graduated');
      case 'live':
        return allTokens.filter(t => t.status === 'active');
      case 'all':
      default:
        return Array.isArray(allTokens) ? allTokens : [];
    }
  };

  const tokens = getDisplayTokens();
  const isLoading = activeFilter === 'all' ? allLoading :
    activeFilter === 'trending' ? trendingLoading :
      activeFilter === 'new' ? newLoading : false;

  // Search filtering
  const filteredTokens = tokens.filter((token: Token) =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <main className="min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* Hero Section - Clean and Minimal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Discover Tokens
                </span>
              </h1>
              <p className="text-muted-foreground">
                Find the next moonshot or launch your own
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LiveIndicator isConnected={wsConnected} />
              <Link href="/create">
                <Button className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Create Token
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <StatsCard icon={Rocket} label="Total Tokens" value={allTokens.length.toString()} />
          <StatsCard icon={Flame} label="Trending" value={trendingTokens.length.toString()} trend={12} />
          <StatsCard icon={Clock} label="New Today" value={newTokens.length.toString()} />
          <StatsCard icon={Trophy} label="Graduated" value={allTokens.filter(t => t.status === 'graduated').length.toString()} />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Left Column - Token Grid */}
          <div>
            {/* Filter & Search Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
            >
              {/* Filter Tabs */}
              <div className="flex bg-card/60 backdrop-blur-md p-1 rounded-xl border border-border/60 overflow-x-auto">
                {FILTER_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                        isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeFilter"
                          className="absolute inset-0 bg-primary rounded-lg"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-card/60 backdrop-blur border-border/50 focus:border-primary/50"
                />
              </div>
            </motion.div>

            {/* Token Grid */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-card/40 border border-border/50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : filteredTokens.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No tokens found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mb-4">
                    {searchQuery
                      ? `No tokens match "${searchQuery}"`
                      : "Be the first to launch a token!"
                    }
                  </p>
                  <Link href="/create">
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Token
                    </Button>
                  </Link>
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {filteredTokens.map((token, index) => (
                    <motion.div
                      key={token.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                    >
                      <TokenCard
                        token={token}
                        className="h-full bg-card/40 hover:bg-card/70 border-border/50 hover:border-primary/30 transition-all duration-200"
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column - Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="hidden lg:block space-y-4"
          >
            <ActivityFeed items={activityFeed} />

            {/* Quick Links */}
            <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/create" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10">
                    <Plus className="h-4 w-4" />
                    Create New Token
                  </Button>
                </Link>
                <Link href="/portfolio" className="block">
                  <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                    <BarChart3 className="h-4 w-4" />
                    View Portfolio
                  </Button>
                </Link>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Pro Tip</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable HypeBoost when creating tokens to protect against bots and ensure fair distribution.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
