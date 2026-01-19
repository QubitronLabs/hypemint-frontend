'use client';

/**
 * Portfolio Component
 * Shows user's token holdings, P&L, and transaction history
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  RefreshCw,
  PieChart,
  BarChart3,
  Coins,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { useNativeBalance } from '@/hooks';
import { useUserTrades } from '@/hooks/useTrades';
import { getAddressUrl } from '@/lib/wagmi';
import type { Trade } from '@/types';

interface PortfolioProps {
  className?: string;
}

interface HoldingDisplay {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  balance: string;
  value: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  lastTrade?: Date;
}

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  if (num < 0.0001 && num > 0) return '<0.0001';
  return num.toFixed(4);
}

// Format currency
function formatCurrency(num: number): string {
  if (num < 0) return '-$' + formatNumber(Math.abs(num));
  return '$' + formatNumber(num);
}

// Format date relative
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function Portfolio({ className }: PortfolioProps) {
  const { isAuthenticated, walletAddress } = useAuth();
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('holdings');

  // Fetch user's native balance
  const { data: nativeBalance, isLoading: balanceLoading } = useNativeBalance();

  // Fetch user's trades
  const { data: userTrades, isLoading: tradesLoading } = useUserTrades();

  // Calculate holdings from trades (simplified - in production, use on-chain balances)
  const holdings = useMemo((): HoldingDisplay[] => {
    if (!userTrades || !Array.isArray(userTrades)) return [];

    // Group trades by token
    const tokenMap = new Map<string, {
      buys: number;
      sells: number;
      buyValue: number;
      sellValue: number;
      token: Trade['token'];
      lastTrade: Date;
    }>();

    userTrades.forEach((trade) => {
      if (!trade.token) return;

      const existing = tokenMap.get(trade.tokenId) || {
        buys: 0,
        sells: 0,
        buyValue: 0,
        sellValue: 0,
        token: trade.token,
        lastTrade: new Date(trade.createdAt),
      };

      const amount = parseFloat(trade.amount || '0');
      const value = parseFloat(trade.totalValue || '0');

      if (trade.type === 'buy') {
        existing.buys += amount;
        existing.buyValue += value;
      } else {
        existing.sells += amount;
        existing.sellValue += value;
      }

      if (new Date(trade.createdAt) > existing.lastTrade) {
        existing.lastTrade = new Date(trade.createdAt);
      }

      tokenMap.set(trade.tokenId, existing);
    });

    // Convert to holdings array
    const holdings = Array.from(tokenMap.entries())
      .map(([tokenId, data]) => {
        const balance = data.buys - data.sells;
        if (balance <= 0) return null;

        const currentPrice = parseFloat(data.token?.currentPrice || '0');
        const currentValue = balance * currentPrice;
        const costBasis = data.buyValue - data.sellValue;
        const pnl = currentValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        return {
          tokenId,
          tokenName: data.token?.name || 'Unknown',
          tokenSymbol: data.token?.symbol || '???',
          tokenImage: data.token?.imageUrl,
          balance: formatNumber(balance),
          value: currentValue,
          costBasis,
          pnl,
          pnlPercent,
          lastTrade: data.lastTrade,
        } as HoldingDisplay;
      })
      .filter((h): h is HoldingDisplay => h !== null)
      .sort((a, b) => b.value - a.value);

    return holdings;
  }, [userTrades]);

  // Calculate portfolio totals
  const portfolioStats = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const nativeValue = nativeBalance?.value
      ? parseFloat(formatEther(nativeBalance.value))
      : 0;

    return {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      nativeValue,
      totalPortfolioValue: totalValue + nativeValue,
    };
  }, [holdings, nativeBalance]);

  // Not connected state
  if (!isAuthenticated || !isConnected) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-12 text-center", className)}>
        <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Connect your wallet to view your portfolio, holdings, and transaction history
        </p>
      </div>
    );
  }

  // Loading state
  if (balanceLoading || tradesLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Portfolio Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <PieChart className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Total Value</span>
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(portfolioStats.totalPortfolioValue)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Coins className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Token Holdings</span>
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(portfolioStats.totalValue)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              portfolioStats.totalPnl >= 0 ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {portfolioStats.totalPnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <span className="text-sm text-muted-foreground">Total P&L</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            portfolioStats.totalPnl >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {portfolioStats.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalPnl)}
          </p>
          <p className={cn(
            "text-xs",
            portfolioStats.totalPnl >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {portfolioStats.totalPnlPercent >= 0 ? '+' : ''}{portfolioStats.totalPnlPercent.toFixed(2)}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">MATIC Balance</span>
          </div>
          <p className="text-2xl font-bold">
            {portfolioStats.nativeValue.toFixed(4)}
          </p>
          <p className="text-xs text-muted-foreground">MATIC</p>
        </motion.div>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="holdings" className="gap-2">
                <Coins className="h-4 w-4" />
                Holdings
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            {walletAddress && (
              <a
                href={getAddressUrl(walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Holdings Tab */}
          <TabsContent value="holdings" className="space-y-4">
            {holdings.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Coins className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Holdings Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Start trading to build your portfolio!
                </p>
                <Link href="/">
                  <Button className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Explore Tokens
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 border-b border-border text-sm text-muted-foreground">
                  <span>Token</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">P&L</span>
                  <span className="text-right">Last Trade</span>
                </div>

                {/* Holdings Rows */}
                {holdings.map((holding, index) => (
                  <Link
                    key={holding.tokenId}
                    href={`/token/${holding.tokenId}`}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 items-center border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden">
                        {holding.tokenImage ? (
                          <Image
                            src={holding.tokenImage}
                            alt={holding.tokenName}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                            {holding.tokenSymbol.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{holding.tokenName}</p>
                        <p className="text-xs text-muted-foreground">${holding.tokenSymbol}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-medium tabular-nums">{holding.balance}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-medium tabular-nums">{formatCurrency(holding.value)}</p>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "font-medium tabular-nums",
                        holding.pnl >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
                      </p>
                      <p className={cn(
                        "text-xs",
                        holding.pnl >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                      </p>
                    </div>

                    <div className="text-right text-sm text-muted-foreground">
                      {holding.lastTrade ? formatRelativeTime(holding.lastTrade) : '-'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {!userTrades || userTrades.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Transactions Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Your trading history will appear here
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-border text-sm text-muted-foreground">
                  <span>Type</span>
                  <span>Token</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Time</span>
                </div>

                {/* Transaction Rows */}
                {userTrades.slice(0, 50).map((trade) => (
                  <div
                    key={trade.id}
                    className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 items-center border-b border-border last:border-0"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      trade.type === 'buy' ? "bg-green-500/20" : "bg-red-500/20"
                    )}>
                      {trade.type === 'buy' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden">
                        {trade.token?.imageUrl ? (
                          <Image
                            src={trade.token.imageUrl}
                            alt={trade.token.name || ''}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                            {trade.token?.symbol?.slice(0, 2) || '??'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{trade.token?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">${trade.token?.symbol || '???'}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "font-medium tabular-nums text-sm",
                        trade.type === 'buy' ? "text-green-500" : "text-red-500"
                      )}>
                        {trade.type === 'buy' ? '+' : '-'}{formatNumber(parseFloat(trade.amount || '0'))}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-medium tabular-nums text-sm">
                        ${parseFloat(trade.price || '0').toFixed(8)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-medium tabular-nums text-sm">
                        {formatCurrency(parseFloat(trade.totalValue || '0'))}
                      </p>
                    </div>

                    <div className="text-right text-xs text-muted-foreground min-w-[80px]">
                      {formatRelativeTime(new Date(trade.createdAt))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
