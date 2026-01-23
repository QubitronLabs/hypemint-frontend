"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorDashboard } from "@/components/dashboard";
import { Portfolio } from "@/components/portfolio";
import { useAuth, useCurrentUser } from "@/hooks";
import { getAddressUrl } from "@/lib/wagmi";

export default function ProfilePage() {
  const { isAuthenticated, isLoading, walletAddress, dynamicUser, logout } =
    useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");

  const displayName =
    user?.displayName ||
    user?.username ||
    dynamicUser?.firstName ||
    dynamicUser?.email?.split("@")[0] ||
    null;

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

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
            Connect your wallet to view your profile, portfolio, and creator
            dashboard.
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
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex items-start justify-between mb-8"
      >
        <div className="flex items-center gap-5">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Avatar className="w-24 h-24 border-4 border-border/50 shadow-xl ring-4 ring-primary/10">
              <AvatarImage
                src={user?.avatarUrl}
                alt={displayName || shortAddress}
              />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-3xl">
                {displayName?.slice(0, 2) || "🐸"}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          <div>
            <h1 className="text-3xl font-bold">
              {displayName || shortAddress}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {shortAddress}
              </motion.button>
              {walletAddress && (
                <a
                  href={getAddressUrl(walletAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  View on Explorer
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {dynamicUser?.email && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                {dynamicUser.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {/* <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          </motion.div> */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-destructive hover:text-destructive cursor-pointer bg-destructive/10 rounded-xl"
            >
              Logout
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {[
          { label: "Followers", value: user?.followersCount ?? 0 },
          { label: "Following", value: user?.followingCount ?? 0 },
          { label: "Coins Created", value: user?.tokensCreated ?? 0 },
          { label: "Total Trades", value: user?.tradesCount ?? 0 },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 text-center hover:border-primary/20 transition-colors"
          >
            <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl mb-6 p-1">
            <TabsTrigger
              value="portfolio"
              className="gap-2 rounded-lg data-[state=active]:shadow-sm"
            >
              <PieChart className="h-4 w-4" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="creator"
              className="gap-2 rounded-lg data-[state=active]:shadow-sm"
            >
              <Rocket className="h-4 w-4" />
              Creator Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="gap-2 rounded-lg data-[state=active]:shadow-sm"
            >
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-16 text-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <Bell className="h-20 w-20 mx-auto mb-6 text-muted-foreground/30" />
              </motion.div>
              <h3 className="text-2xl font-bold mb-3">No Notifications</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                You'll receive notifications for trades, token graduations, and
                more.
              </p>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
