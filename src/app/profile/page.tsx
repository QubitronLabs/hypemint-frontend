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
    ArrowLeftRight,
    Bell,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenCard } from '@/components/token';
import { useAuth, useCurrentUser } from '@/hooks';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';

const MOCK_TOKENS: Token[] = [];

const MOCK_BALANCES = [
    { name: 'Solana', symbol: 'SOL', balance: '0.00', value: '$0' },
];

/**
 * Profile Page with JWT Auth
 * 
 * Uses:
 * - useAuth() - Combined auth state
 * - useCurrentUser() - Backend user data via JWT
 */
export default function ProfilePage() {
    const { isAuthenticated, isLoading, walletAddress, dynamicUser, logout } = useAuth();
    const { data: user, isLoading: userLoading } = useCurrentUser();

    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('balances');

    // Display name with multiple fallbacks
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
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="w-20 h-20 rounded-full" />
                    <div className="flex-1">
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="flex gap-8 mb-8">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-24" />
                    ))}
                </div>
                <Skeleton className="h-[300px] rounded-xl" />
            </div>
        );
    }

    // Not connected state
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
                        Connect your wallet to view your profile, balances, and trading history.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Your JWT token will be used for all API requests
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Profile Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start justify-between mb-8"
            >
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="w-20 h-20 border-2 border-border">
                        <AvatarImage src={user?.avatarUrl} alt={displayName || shortAddress} />
                        <AvatarFallback className="bg-primary/20 text-2xl">
                            {displayName?.slice(0, 2) || '🐸'}
                        </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
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
                                    href={`https://solscan.io/account/${walletAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                                >
                                    View on solscan
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>

                        {/* Dynamic.xyz email if available */}
                        {dynamicUser?.email && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {dynamicUser.email}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Edit2 className="h-4 w-4" />
                        edit
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
                    <p className="text-sm text-muted-foreground">Coins created</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{user?.tradesCount ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Trades</p>
                </div>
                {user?.isVerified && (
                    <div className="text-center">
                        <p className="text-2xl">✓</p>
                        <p className="text-sm text-primary">Verified</p>
                    </div>
                )}
            </motion.div>



            {/* Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-card border border-border">
                        <TabsTrigger value="balances" className="gap-2">
                            <Coins className="h-4 w-4" />
                            Balances
                        </TabsTrigger>
                        <TabsTrigger value="replies" className="gap-2">
                            <ArrowLeftRight className="h-4 w-4" />
                            Replies
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2">
                            <Bell className="h-4 w-4" />
                            Notifications
                        </TabsTrigger>
                    </TabsList>

                    {/* Balances Tab */}
                    <TabsContent value="balances" className="mt-6">
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 border-b border-border text-sm text-muted-foreground">
                                <span>Coins</span>
                                <span className="text-right">Balance</span>
                                <span className="text-right">Value</span>
                            </div>

                            {MOCK_BALANCES.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                    <p>No tokens found</p>
                                </div>
                            ) : (
                                MOCK_BALANCES.map((balance, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 items-center border-b border-border last:border-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                <span className="text-sm">◎</span>
                                            </div>
                                            <div>
                                                <p className="font-medium">{balance.name}</p>
                                                <p className="text-xs text-muted-foreground">{balance.symbol}</p>
                                            </div>
                                        </div>
                                        <span className="text-right font-medium tabular-nums">
                                            {balance.balance}
                                        </span>
                                        <span className="text-right text-muted-foreground tabular-nums">
                                            {balance.value}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    {/* Replies Tab */}
                    <TabsContent value="replies" className="mt-6">
                        <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No replies yet</p>
                        </div>
                    </TabsContent>

                    {/* Notifications Tab */}
                    <TabsContent value="notifications" className="mt-6">
                        <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No notifications</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </motion.div>

            {/* Created Tokens Section */}
            {MOCK_TOKENS.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8"
                >
                    <h2 className="text-lg font-semibold mb-4">Created Tokens</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {MOCK_TOKENS.map((token) => (
                            <TokenCard key={token.id} token={token} />
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
