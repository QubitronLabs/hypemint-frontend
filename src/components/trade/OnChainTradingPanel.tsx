'use client';

/**
 * On-Chain Trading Panel Component
 * Real blockchain trading interface using Wagmi/Viem
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { formatEther, parseEther, type Address } from 'viem';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useBuyTokens,
  useSellTokens,
  useBuyQuote,
  useSellQuote,
  useTokenBalance,
  useNativeBalance,
  useApproveToken,
  useTokenAllowance,
} from '@/hooks';
import { getTxUrl } from '@/lib/wagmi';
import { toast } from 'sonner';

interface OnChainTradingPanelProps {
  tokenAddress: Address;
  bondingCurveAddress: Address;
  tokenSymbol: string;
  tokenName: string;
  currentPrice: string;
  className?: string;
}

type TradeType = 'buy' | 'sell';

// Format number with commas
function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n < 0.0001 && n > 0) return '<0.0001';
  return n.toFixed(4);
}

export function OnChainTradingPanel({
  tokenAddress,
  bondingCurveAddress,
  tokenSymbol,
  tokenName,
  currentPrice,
  className,
}: OnChainTradingPanelProps) {
  const { address, isConnected } = useAccount();
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(5); // 5% default

  // Balances
  const { data: nativeBalance } = useNativeBalance();
  const { data: tokenBalance } = useTokenBalance(tokenAddress);

  // Quotes
  const { data: buyQuote, isLoading: isBuyQuoteLoading } = useBuyQuote(
    bondingCurveAddress,
    tradeType === 'buy' ? amount : ''
  );
  const { data: sellQuote, isLoading: isSellQuoteLoading } = useSellQuote(
    bondingCurveAddress,
    tradeType === 'sell' ? amount : ''
  );

  // Allowance check for selling
  const { data: allowance } = useTokenAllowance(tokenAddress, bondingCurveAddress);

  // Trade hooks
  const {
    buy,
    isBuying,
    isConfirming: isBuyConfirming,
    isConfirmed: isBuyConfirmed,
    txHash: buyTxHash,
    error: buyError,
    reset: resetBuy,
  } = useBuyTokens();

  const {
    sell,
    isSelling,
    isConfirming: isSellConfirming,
    isConfirmed: isSellConfirmed,
    txHash: sellTxHash,
    error: sellError,
    reset: resetSell,
  } = useSellTokens();

  const {
    approve,
    isApproving,
    isConfirming: isApproveConfirming,
    isConfirmed: isApproveConfirmed,
    error: approveError,
    reset: resetApprove,
  } = useApproveToken();

  // Computed values
  const isLoading = isBuying || isSelling || isApproving;
  const isConfirming = isBuyConfirming || isSellConfirming || isApproveConfirming;
  const txHash = buyTxHash || sellTxHash;
  const error = buyError || sellError || approveError;

  // Check if needs approval for sell
  const needsApproval = useMemo(() => {
    if (tradeType !== 'sell' || !amount) return false;
    try {
      const amountWei = parseEther(amount);
      return allowance !== undefined && allowance < amountWei;
    } catch {
      return false;
    }
  }, [tradeType, amount, allowance]);

  // Calculate trade metrics
  const tradeMetrics = useMemo(() => {
    const parsedAmount = parseFloat(amount) || 0;
    const price = parseFloat(currentPrice) || 0.00001;

    if (tradeType === 'buy' && buyQuote) {
      const [tokenAmount, protocolFee, creatorFee] = buyQuote as [bigint, bigint, bigint];
      const tokensOut = parseFloat(formatEther(tokenAmount));
      const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
      const effectivePrice = parsedAmount / tokensOut;
      const priceImpact = ((effectivePrice - price) / price) * 100;

      return {
        outputAmount: tokensOut,
        fees: totalFees,
        effectivePrice,
        priceImpact: Math.abs(priceImpact),
        isHighImpact: Math.abs(priceImpact) > 5,
      };
    }

    if (tradeType === 'sell' && sellQuote) {
      const [maticAmount, protocolFee, creatorFee] = sellQuote as [bigint, bigint, bigint];
      const maticOut = parseFloat(formatEther(maticAmount));
      const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
      const effectivePrice = maticOut / parsedAmount;
      const priceImpact = ((price - effectivePrice) / price) * 100;

      return {
        outputAmount: maticOut,
        fees: totalFees,
        effectivePrice,
        priceImpact: Math.abs(priceImpact),
        isHighImpact: Math.abs(priceImpact) > 5,
      };
    }

    return {
      outputAmount: 0,
      fees: 0,
      effectivePrice: price,
      priceImpact: 0,
      isHighImpact: false,
    };
  }, [amount, tradeType, currentPrice, buyQuote, sellQuote]);

  // Handle approve
  const handleApprove = async () => {
    if (!amount) return;
    try {
      const amountWei = parseEther(amount);
      // Approve max uint256 for convenience
      const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      await approve(tokenAddress, bondingCurveAddress, maxApproval);
      toast.success('Approval successful!');
    } catch (err) {
      console.error('Approve failed:', err);
      toast.error('Approval failed');
    }
  };

  // Handle trade execution
  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected) return;

    resetBuy();
    resetSell();

    try {
      if (tradeType === 'buy') {
        toast.info('Confirm transaction in wallet...', { id: 'trade' });
        const hash = await buy({
          bondingCurveAddress,
          maticAmount: amount,
          slippageBps: slippage * 100,
        });
        if (hash) {
          toast.success('Buy order submitted!', {
            id: 'trade',
            description: `Tx: ${hash.slice(0, 10)}...`,
            action: {
              label: 'View',
              onClick: () => window.open(getTxUrl(hash), '_blank'),
            },
          });
        }
      } else {
        // Check approval first
        if (needsApproval) {
          toast.error('Please approve tokens first');
          return;
        }

        toast.info('Confirm transaction in wallet...', { id: 'trade' });
        const hash = await sell({
          bondingCurveAddress,
          tokenAddress,
          tokenAmount: amount,
          slippageBps: slippage * 100,
        });
        if (hash) {
          toast.success('Sell order submitted!', {
            id: 'trade',
            description: `Tx: ${hash.slice(0, 10)}...`,
            action: {
              label: 'View',
              onClick: () => window.open(getTxUrl(hash), '_blank'),
            },
          });
        }
      }
    } catch (err) {
      console.error('Trade failed:', err);
      toast.error('Trade failed', { id: 'trade' });
    }
  };

  // Quick amount buttons
  const quickAmounts = tradeType === 'buy'
    ? ['0.1', '0.5', '1', '5'] // MATIC amounts
    : ['25%', '50%', '75%', 'MAX']; // Percentage of balance

  const handleQuickAmount = (qa: string) => {
    if (tradeType === 'buy') {
      setAmount(qa);
    } else {
      // Calculate percentage of token balance
      if (!tokenBalance) return;
      const balance = parseFloat(formatEther(tokenBalance as bigint));
      let percentage = 1;
      if (qa === '25%') percentage = 0.25;
      else if (qa === '50%') percentage = 0.5;
      else if (qa === '75%') percentage = 0.75;
      else if (qa === 'MAX') percentage = 1;
      setAmount((balance * percentage).toFixed(6));
    }
  };

  // Reset on trade type change
  useEffect(() => {
    setAmount('');
    resetBuy();
    resetSell();
    resetApprove();
  }, [tradeType]);

  return (
    <div className={cn(
      "bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden",
      className
    )}>
      {/* Trade Type Tabs */}
      <div className="p-4">
        <div className="flex bg-background/50 rounded-lg p-1 gap-1">
          <button
            onClick={() => setTradeType('buy')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium transition-all",
              tradeType === 'buy'
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Buy
          </button>
          <button
            onClick={() => setTradeType('sell')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium transition-all",
              tradeType === 'sell'
                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Sell
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="px-4 pb-4">
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-muted-foreground">
              {tradeType === 'buy' ? 'You Pay (MATIC)' : `You Sell (${tokenSymbol})`}
            </label>
            <span className="text-xs text-muted-foreground">
              Balance:{' '}
              {tradeType === 'buy'
                ? `${nativeBalance?.value ? formatNumber(formatEther(nativeBalance.value)) : '0'} MATIC`
                : `${tokenBalance ? formatNumber(formatEther(tokenBalance as bigint)) : '0'} ${tokenSymbol}`}
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-16 text-lg font-medium bg-background/50"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {tradeType === 'buy' ? 'MATIC' : tokenSymbol}
            </div>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mb-4">
          {quickAmounts.map((qa) => (
            <button
              key={qa}
              onClick={() => handleQuickAmount(qa)}
              className="flex-1 py-1.5 text-xs font-medium bg-background/50 border border-border/50 rounded-md hover:border-primary/30 transition-colors"
            >
              {qa}
            </button>
          ))}
        </div>

        {/* Output Estimate */}
        <AnimatePresence mode="wait">
          {parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 mb-4"
            >
              <div className="p-3 bg-background/30 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You Receive</span>
                  <span className="font-medium">
                    {(isBuyQuoteLoading || isSellQuoteLoading) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {formatNumber(tradeMetrics.outputAmount)}{' '}
                        {tradeType === 'buy' ? tokenSymbol : 'MATIC'}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per Token</span>
                  <span className="font-medium">
                    {tradeMetrics.effectivePrice.toFixed(8)} MATIC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fees (2%)</span>
                  <span className="font-medium">
                    {tradeMetrics.fees.toFixed(6)} MATIC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={cn(
                    "font-medium",
                    tradeMetrics.isHighImpact ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {tradeMetrics.priceImpact.toFixed(2)}%
                    {tradeMetrics.isHighImpact && (
                      <AlertTriangle className="h-3 w-3 inline ml-1" />
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slippage Setting */}
        <div className="flex items-center justify-between mb-4 p-2 bg-background/30 rounded-lg">
          <span className="text-xs text-muted-foreground">Slippage Tolerance</span>
          <div className="flex gap-1">
            {[1, 3, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  slippage === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 hover:bg-background"
                )}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Execute Button */}
        {isConnected ? (
          <>
            {/* Approval Button (for sell) */}
            {tradeType === 'sell' && needsApproval && (
              <Button
                onClick={handleApprove}
                disabled={isApproving || isApproveConfirming}
                className="w-full h-12 mb-2 bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {isApproving || isApproveConfirming ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Approve {tokenSymbol}
                  </>
                )}
              </Button>
            )}

            {/* Trade Button */}
            <Button
              onClick={handleTrade}
              disabled={
                !amount ||
                parseFloat(amount) <= 0 ||
                isLoading ||
                isConfirming ||
                (tradeType === 'sell' && needsApproval)
              }
              className={cn(
                "w-full h-12 text-base font-semibold",
                tradeType === 'buy'
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                  : "bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-90"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Confirm in Wallet...
                </>
              ) : isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  {tradeType === 'buy' ? (
                    <TrendingUp className="h-5 w-5 mr-2" />
                  ) : (
                    <TrendingDown className="h-5 w-5 mr-2" />
                  )}
                  {tradeType === 'buy' ? 'Buy' : 'Sell'} {tokenSymbol}
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            disabled
            className="w-full h-12 bg-muted"
          >
            <Wallet className="h-5 w-5 mr-2" />
            Connect Wallet to Trade
          </Button>
        )}

        {/* Transaction Link */}
        <AnimatePresence>
          {txHash && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Transaction Submitted</span>
                </div>
                <a
                  href={getTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="text-sm text-destructive">
                  {error.message.slice(0, 100)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
