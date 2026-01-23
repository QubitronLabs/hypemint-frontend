"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Copy,
  Check,
  Users,
  Coins,
  Activity,
  UserPlus,
  UserMinus,
  Loader2,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenCard } from "@/components/token";
import { useAuth } from "@/hooks";
import {
  useUserProfile,
  useFollowUser,
  useUnfollowUser,
  useUserFollowers,
  useUserFollowing,
  useUserCreatedTokens,
} from "@/hooks/useUsers";
import { cn } from "@/lib/utils";

interface UserProfilePageProps {
  params: Promise<{ address: string }>;
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { address } = use(params);
  const { isAuthenticated, walletAddress } = useAuth();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("tokens");
  const [localIsFollowing, setLocalIsFollowing] = useState(false);

  // Fetch user profile
  const { data: profileData, isLoading, error } = useUserProfile(address);

  // Fetch created tokens
  const { data: tokensData } = useUserCreatedTokens(profileData?.user?.id);

  // Fetch followers/following
  const { data: followersData } = useUserFollowers(address);
  const { data: followingData } = useUserFollowing(address);

  // Follow mutations
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const user = profileData?.user;
  const isOwnProfile = walletAddress?.toLowerCase() === address?.toLowerCase();

  // Sync local follow state with API data
  useEffect(() => {
    if (profileData?.isFollowing !== undefined) {
      setLocalIsFollowing(profileData.isFollowing);
    }
  }, [profileData?.isFollowing]);

  const displayName = user?.displayName || user?.username || null;
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) return;

    // Immediately update local state for instant UI feedback
    setLocalIsFollowing(!localIsFollowing);

    try {
      if (localIsFollowing) {
        await unfollowMutation.mutateAsync(address);
      } else {
        await followMutation.mutateAsync(address);
      }
    } catch (error) {
      // Revert on error
      setLocalIsFollowing(localIsFollowing);
      console.error("Follow/unfollow failed:", error);
    }
  };

  const isFollowLoading =
    followMutation.isPending || unfollowMutation.isPending;

  // Loading state - show skeleton while loading OR while user data hasn't arrived
  // This prevents flash of "User Not Found" while data is still loading
  if (isLoading || (!profileData && !error)) {
    return (
      <div className="max-w-4xl mx-auto p-6">
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
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  // Error or not found - only show if there's an actual error or data was fetched but user doesn't exist
  if (error || (profileData && !user)) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold mb-2">User Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The user you're looking for doesn't exist or the address is invalid.
          </p>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // At this point, user is guaranteed to exist
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </motion.div>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20 border-2 border-border">
            <AvatarImage
              src={user.avatarUrl || undefined}
              alt={displayName || shortAddress}
            />
            <AvatarFallback className="bg-primary/20 text-2xl">
              {displayName?.slice(0, 2) || "🐸"}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {displayName || shortAddress}
              </h1>
              {user.isVerified && (
                <BadgeCheck className="h-5 w-5 text-primary" />
              )}
            </div>

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
              <a
                href={`https://amoy.polygonscan.com/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Polygonscan
              </a>
            </div>

            {user.bio && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        {/* Follow Button */}
        {!isOwnProfile && isAuthenticated && (
          <motion.button
            onClick={handleFollow}
            disabled={isFollowLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              backgroundColor: localIsFollowing
                ? "transparent"
                : "var(--primary)",
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-300",
              localIsFollowing
                ? "border border-border text-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
              isFollowLoading && "opacity-70 cursor-not-allowed",
            )}
          >
            {isFollowLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div
                key={localIsFollowing ? "unfollow" : "follow"}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                {localIsFollowing ? (
                  <>
                    <UserMinus className="h-4 w-4" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Follow</span>
                  </>
                )}
              </motion.div>
            )}
          </motion.button>
        )}

        {isOwnProfile && (
          <Link href="/profile">
            <Button variant="outline">Edit Profile</Button>
          </Link>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-8 mb-8"
      >
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">
            {user.followersCount}
          </p>
          <p className="text-sm text-muted-foreground">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">
            {user.followingCount}
          </p>
          <p className="text-sm text-muted-foreground">Following</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">
            {user.tokensCreated}
          </p>
          <p className="text-sm text-muted-foreground">Coins</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">
            {user.tradesCount ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">Trades</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="tokens" className="gap-2">
              <Coins className="h-4 w-4" />
              Created ({user.tokensCreated})
            </TabsTrigger>
            <TabsTrigger value="followers" className="gap-2">
              <Users className="h-4 w-4" />
              Followers ({user.followersCount})
            </TabsTrigger>
            <TabsTrigger value="following" className="gap-2">
              <Users className="h-4 w-4" />
              Following ({user.followingCount})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Created Tokens */}
          <TabsContent value="tokens" className="mt-6">
            {tokensData?.tokens && tokensData.tokens.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {tokensData.tokens.map((token) => (
                  <TokenCard key={token.id} token={token} />
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Coins className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No tokens created yet</p>
              </div>
            )}
          </TabsContent>

          {/* Followers */}
          <TabsContent value="followers" className="mt-6">
            {followersData?.followers && followersData.followers.length > 0 ? (
              <div className="space-y-3">
                {followersData.followers.map((follower) => (
                  <Link
                    key={follower.id}
                    href={`/user/${follower.walletAddress}`}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={follower.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20">
                          {(
                            follower.displayName ||
                            follower.username ||
                            "?"
                          ).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {follower.displayName ||
                            follower.username ||
                            `${follower.walletAddress.slice(0, 6)}...${follower.walletAddress.slice(-4)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {follower.followersCount} followers
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No followers yet</p>
              </div>
            )}
          </TabsContent>

          {/* Following */}
          <TabsContent value="following" className="mt-6">
            {followingData?.following && followingData.following.length > 0 ? (
              <div className="space-y-3">
                {followingData.following.map((following) => (
                  <Link
                    key={following.id}
                    href={`/user/${following.walletAddress}`}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={following.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20">
                          {(
                            following.displayName ||
                            following.username ||
                            "?"
                          ).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {following.displayName ||
                            following.username ||
                            `${following.walletAddress.slice(0, 6)}...${following.walletAddress.slice(-4)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {following.followersCount} followers
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Not following anyone yet
                </p>
              </div>
            )}
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
