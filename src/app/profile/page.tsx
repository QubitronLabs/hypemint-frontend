'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  Edit2,
  Copy,
  Check,
  Wallet,
  Coins,
  BarChart3,
  Bell,
  Rocket,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatorDashboard } from '@/components/dashboard';
import { Portfolio } from '@/components/portfolio';
import { useAuth, useCurrentUser } from '@/hooks';
import { getAddressUrl } from '@/lib/wagmi';

export default function ProfilePage() {
  const { isAuthenticated, isLoading, walletAddress, dynamicUser, logout } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('portfolio');

  const displayName = user?.displayName
    || user?.username
    || dynamicUser?.firstName
    || (dynamicUser?.email?.split('@')[0])
    || null;

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-8 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-24" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  // Not connected
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to view your profile, portfolio, and creator dashboard.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20 border-2 border-border">
            <AvatarImage src={user?.avatarUrl} alt={displayName || shortAddress} />
            <AvatarFallback className="bg-primary/20 text-2xl">
              {displayName?.slice(0, 2) || '🐸'}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-2xl font-bold">
              {displayName || shortAddress}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {shortAddress}
              </button>
              {walletAddress && (
                <a
                  href={getAddressUrl(walletAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  View on Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {dynamicUser?.email && (
              <p className="text-xs text-muted-foreground mt-1">
                {dynamicUser.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-destructive hover:text-destructive"
          >
            Logout
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-8 mb-8"
      >
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{user?.followersCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{user?.followingCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">Following</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{user?.tokensCreated ?? 0}</p>
          <p className="text-sm text-muted-foreground">Coins Created</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{user?.tradesCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total Trades</p>
        </div>
      </motion.div>

      {/* Main Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="portfolio" className="gap-2">
              <PieChart className="h-4 w-4" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="creator" className="gap-2">
              <Rocket className="h-4 w-4" />
              Creator Dashboard
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <Portfolio />
          </TabsContent>

          <TabsContent value="creator">
            <CreatorDashboard />
          </TabsContent>

          <TabsContent value="notifications">
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Notifications</h3>
              <p className="text-muted-foreground">
                You'll receive notifications for trades, graduations, and more.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
