'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  BarChart3,
  Sparkles,
  Search,
  Rocket,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenCard } from '@/components/token';
import { useTrendingTokens, useNewTokens, useTokens } from '@/hooks/useTokens';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Token } from '@/types';

// Filter tabs with proper icons and IDs
const FILTER_TABS = [
  { id: 'all', label: 'All Tokens', icon: BarChart3 },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'new', label: 'New Pairs', icon: Sparkles },
  { id: 'live', label: 'Live Now', icon: Zap },
  { id: 'graduated', label: 'Graduated', icon: Rocket },
] as const;

type FilterTab = typeof FILTER_TABS[number]['id'];

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data
  const { data: allTokens = [], isLoading: allLoading } = useTokens({ page: 1, pageSize: 50 });
  const { data: trendingTokens = [], isLoading: trendingLoading } = useTrendingTokens();
  const { data: newTokens = [], isLoading: newLoading } = useNewTokens();

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
        // Simulate "live" by showing active tokens with recent trades (mock logic for now if no "live" status)
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
    <main className="min-h-screen pb-20 overflow-x-hidden">

      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Modern Hero Section */}


        {/* Dashboard / Filter Area */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <motion.div
            className="w-full md:w-auto overflow-x-auto scrollbar-hide"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex bg-card/60 backdrop-blur-md p-1 rounded-2xl border border-border/60">
              {FILTER_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                      isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-primary rounded-xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            className="w-full md:w-72"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-card/80 backdrop-blur border-border/50 focus:border-primary/50 text-base"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Token Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : filteredTokens.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No tokens found</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                We couldn't find any tokens waiting for launch. Why not start the next moonshot?
              </p>
              <Link href="/create">
                <Button>Create Token</Button>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredTokens.map((token, index) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                >
                  <TokenCard token={token} className="h-full bg-card/40 hover:bg-card/80 border-white/5 hover:border-primary/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
