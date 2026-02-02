"use client";

import { useState, useEffect } from "react";
import { formatEther, type Address } from "viem";
import { useVestingInfo, useClaimVested } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Unlock, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface VestingCardProps {
    bondingCurveAddress: Address;
    symbol: string;
}

export function VestingCard({ bondingCurveAddress, symbol }: VestingCardProps) {
    const { vestingInfo, claimableAmount, refetch } = useVestingInfo(bondingCurveAddress);
    const { claim, isClaiming, isConfirming, isConfirmed, txHash, error, reset } = useClaimVested();
    const [justClaimed, setJustClaimed] = useState(false);

    // Vesting duration is fixed at 1 hour (3600 seconds) in current contract
    const VESTING_DURATION = 3600;
    
    // All hooks MUST be called before any conditional returns (Rules of Hooks)
    const [elapsed, setElapsed] = useState(0);

    // Get startTime safely (may be undefined if no vestingInfo)
    const startTime = vestingInfo?.startTime ?? 0n;

    // Refetch data after successful claim
    useEffect(() => {
        if (isConfirmed && !justClaimed) {
            setJustClaimed(true);
            // Refetch vesting data after a short delay to allow blockchain to update
            const timer = setTimeout(() => {
                refetch();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isConfirmed, justClaimed, refetch]);

    // Reset justClaimed state when user makes another claim attempt
    useEffect(() => {
        if (isClaiming) {
            setJustClaimed(false);
        }
    }, [isClaiming]);

    useEffect(() => {
        // Only update if we have a valid startTime
        if (!startTime || startTime === 0n) return;

        const updateElapsed = () => {
            const now = Math.floor(Date.now() / 1000);
            const start = Number(startTime);
            setElapsed(Math.min(Math.max(0, now - start), VESTING_DURATION));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [startTime, VESTING_DURATION]);

    // Early return AFTER all hooks
    // Don't show card if no vesting info or totalAmount is 0
    if (!vestingInfo || vestingInfo.totalAmount === 0n) {
        return null;
    }

    const { totalAmount, claimedAmount } = vestingInfo;
    const remaining = totalAmount - claimedAmount;

    // Hide card if everything is claimed (remaining === 0 and no claimable)
    const isFullyClaimed = remaining === 0n && (!claimableAmount || claimableAmount === 0n);
    if (isFullyClaimed) {
        return null;
    }

    const progressPercent = Math.min(100, (elapsed / VESTING_DURATION) * 100);
    const timeRemaining = Math.max(0, VESTING_DURATION - elapsed);
    
    const minutesLeft = Math.floor(timeRemaining / 60);
    const secondsLeft = timeRemaining % 60;

    const handleClaim = async () => {
        reset(); // Reset previous state
        setJustClaimed(false);
        await claim(bondingCurveAddress);
    };

    const hasClaimable = claimableAmount && claimableAmount > 0n;
    const isVestingComplete = elapsed >= VESTING_DURATION;

    return (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    HypeBoost Vesting
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Total Locked</p>
                        <p className="font-mono font-medium">
                            {formatNumber(parseFloat(formatEther(remaining)))} {symbol}
                        </p>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-xs text-green-600 mb-1">Available to Claim</p>
                        <p className="font-mono font-medium text-green-600">
                             {claimableAmount ? formatNumber(parseFloat(formatEther(claimableAmount))) : "0"} {symbol}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{isVestingComplete ? "Fully Unlocked" : "Unlocking..."}</span>
                        <span>{minutesLeft}m {secondsLeft}s left</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                {/* Claim Button */}
                <AnimatePresence mode="wait">
                    {justClaimed && isConfirmed ? (
                        <motion.div
                            key="claimed"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full py-2 px-4 bg-green-500/20 border border-green-500/30 rounded-md flex items-center justify-center gap-2 text-green-500"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">Claimed Successfully!</span>
                        </motion.div>
                    ) : (
                        <motion.div key="button" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Button 
                                onClick={handleClaim}
                                disabled={!hasClaimable || isClaiming || isConfirming}
                                className="w-full"
                                variant={hasClaimable ? "default" : "secondary"}
                            >
                                {isClaiming || isConfirming ? (
                                     <>Processing...</>
                                ) : hasClaimable ? (
                                    <>
                                        <Unlock className="mr-2 h-4 w-4" />
                                        Claim Tokens
                                    </>
                                ) : (
                                    <>
                                        <Clock className="mr-2 h-4 w-4" />
                                        No Tokens to Claim
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <div className="text-xs text-red-500 flex items-center gap-1">
                         <AlertCircle className="h-3 w-3" />
                         <span>{error.message}</span>
                    </div>
                )}
                
                <p className="text-[10px] text-muted-foreground text-center">
                    Tokens unlock linearly over 1 hour to prevent sniping.
                </p>
            </CardContent>
        </Card>
    );
}
