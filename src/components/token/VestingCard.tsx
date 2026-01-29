import { useState, useEffect } from "react";
import { formatEther, type Address } from "viem";
import { useVestingInfo, useClaimVested } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Unlock, Clock, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface VestingCardProps {
    bondingCurveAddress: Address;
    symbol: string;
}

export function VestingCard({ bondingCurveAddress, symbol }: VestingCardProps) {
    const { vestingInfo, claimableAmount } = useVestingInfo(bondingCurveAddress);
    const { claim, isClaiming, isConfirming, isConfirmed, txHash, error } = useClaimVested();

    // Vesting duration is fixed at 1 hour (3600 seconds) in current contract
    const VESTING_DURATION = 3600;
    
    // All hooks MUST be called before any conditional returns (Rules of Hooks)
    const [elapsed, setElapsed] = useState(0);

    // Get startTime safely (may be undefined if no vestingInfo)
    const startTime = vestingInfo?.startTime ?? 0n;

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
    if (!vestingInfo || vestingInfo.totalAmount === 0n) {
        return null;
    }

    const { totalAmount, claimedAmount } = vestingInfo;
    const remaining = totalAmount - claimedAmount;

    const progressPercent = Math.min(100, (elapsed / VESTING_DURATION) * 100);
    const timeRemaining = Math.max(0, VESTING_DURATION - elapsed);
    
    const minutesLeft = Math.floor(timeRemaining / 60);
    const secondsLeft = timeRemaining % 60;

    const handleClaim = async () => {
        await claim(bondingCurveAddress);
    };

    const hasClaimable = claimableAmount && claimableAmount > 0n;

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
                        <span>Unlocking...</span>
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
                <Button 
                    onClick={handleClaim}
                    disabled={!hasClaimable || isClaiming || isConfirming}
                    className="w-full"
                    variant={hasClaimable ? "default" : "secondary"}
                >
                    {isClaiming || isConfirming ? (
                         <>Processing...</>
                    ) : (
                        <>
                            <Unlock className="mr-2 h-4 w-4" />
                            Claim Tokens
                        </>
                    )}
                </Button>

                {/* Status Messages */}
                {isConfirmed && (
                    <div className="text-xs text-green-500 flex items-center gap-1">
                        <span className="font-bold">✓ Claimed successfully!</span>
                    </div>
                )}
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
