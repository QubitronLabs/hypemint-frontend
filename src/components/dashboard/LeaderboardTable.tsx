"use client";

import { useState } from "react";
import { Trophy, Medal, TrendingUp, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLeaderboard,
  useLeaderboardStats,
  useMyRanking,
} from "@/hooks/useLeaderboard";
import type {
  LeaderboardPeriod,
  LeaderboardMetric,
} from "@/lib/api/leaderboard";

interface LeaderboardTableProps {
  className?: string;
}

export function LeaderboardTable({ className }: LeaderboardTableProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [metric, setMetric] = useState<LeaderboardMetric>("pnl");

  const { data: entries, isLoading } = useLeaderboard({
    period,
    metric,
    limit: 50,
  });
  const { data: stats } = useLeaderboardStats(period);
  const { data: myRanking } = useMyRanking(period);

  const formatValue = (value: string, decimals = 4) => {
    const num = parseFloat(value) / 1e18;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(decimals);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">#{rank}</span>;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Traders</span>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalTraders.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Volume</span>
              </div>
              <p className="text-2xl font-bold">
                {formatValue(stats.totalVolume, 2)} SOL
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Trades</span>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalTrades.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Avg Win Rate
                </span>
              </div>
              <p className="text-2xl font-bold">
                {stats.avgWinRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Ranking */}
      {myRanking && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">#{myRanking.rank}</div>
                <div>
                  <p className="font-medium">Your Ranking</p>
                  <p className="text-sm text-muted-foreground">
                    Top {myRanking.percentile.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-xl font-bold",
                    parseFloat(myRanking.entry.totalPnl) >= 0
                      ? "text-green-400"
                      : "text-red-400",
                  )}
                >
                  {formatValue(myRanking.entry.totalPnl)} SOL
                </p>
                <p className="text-sm text-muted-foreground">
                  {myRanking.entry.tradeCount} trades
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}
        >
          <TabsList>
            <TabsTrigger value="daily">24H</TabsTrigger>
            <TabsTrigger value="weekly">7D</TabsTrigger>
            <TabsTrigger value="monthly">30D</TabsTrigger>
            <TabsTrigger value="all_time">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs
          value={metric}
          onValueChange={(v) => setMetric(v as LeaderboardMetric)}
        >
          <TabsList>
            <TabsTrigger value="pnl">PnL</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="win_rate">Win Rate</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Traders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Rank */}
                  <div className="w-12 flex justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={entry.avatarUrl || undefined} />
                      <AvatarFallback>
                        {entry.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {entry.username || shortenAddress(entry.walletAddress)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.tradeCount} trades • {entry.winRate.toFixed(0)}%
                        win
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="hidden md:flex gap-1">
                    {entry.badges.slice(0, 2).map((badge) => (
                      <Badge
                        key={badge.type}
                        variant="secondary"
                        className="text-xs"
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>

                  {/* PnL */}
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-bold font-mono",
                        parseFloat(entry.totalPnl) >= 0
                          ? "text-green-400"
                          : "text-red-400",
                      )}
                    >
                      {formatValue(entry.totalPnl)} SOL
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        entry.totalPnlPercent >= 0
                          ? "text-green-400"
                          : "text-red-400",
                      )}
                    >
                      {formatPercent(entry.totalPnlPercent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              No trading activity yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
