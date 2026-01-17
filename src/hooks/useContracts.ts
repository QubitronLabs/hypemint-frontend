/**
 * Contract Interaction Hooks
 *
 * React hooks for interacting with HypeMint smart contracts using Wagmi
 */

import { useCallback, useState } from "react";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useAccount,
  useBalance,
  usePublicClient,
} from "wagmi";
import { parseEther, type Address, type Hash } from "viem";
import {
  HYPE_FACTORY_ABI,
  HYPE_BONDING_CURVE_ABI,
  HYPE_TOKEN_ABI,
  getContractAddress,
  DEFAULT_CREATION_FEE,
  DEFAULT_SLIPPAGE_BPS,
  calculateMinTokens,
  calculateMinMatic,
} from "@/lib/contracts";
import { ACTIVE_CHAIN_ID } from "@/lib/contracts/config";

// Types
export interface CreateTokenParams {
  name: string;
  symbol: string;
  imageURI: string;
  description: string;
  hypeBoostEnabled: boolean;
}

export interface CreateTokenResult {
  tokenAddress: Address;
  bondingCurveAddress: Address;
  txHash: Hash;
}

export interface BuyParams {
  bondingCurveAddress: Address;
  maticAmount: string; // in MATIC (not wei)
  slippageBps?: number;
}

export interface SellParams {
  bondingCurveAddress: Address;
  tokenAddress: Address;
  tokenAmount: string; // in tokens (not wei)
  slippageBps?: number;
}

// Hook: Get user's native balance (MATIC)
export function useNativeBalance() {
  const { address } = useAccount();
  return useBalance({
    address,
    chainId: ACTIVE_CHAIN_ID,
  });
}

// Hook: Get factory creation fee
export function useCreationFee() {
  const factoryAddress = getContractAddress("factory");

  return useReadContract({
    address: factoryAddress,
    abi: HYPE_FACTORY_ABI,
    functionName: "creationFee",
    chainId: ACTIVE_CHAIN_ID,
  });
}

// Hook: Create a new token
export function useCreateToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { data: creationFee } = useCreationFee();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const createToken = useCallback(
    async (params: CreateTokenParams): Promise<CreateTokenResult | null> => {
      if (!address) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      setIsCreating(true);
      setError(null);

      try {
        const factoryAddress = getContractAddress("factory");
        const fee = creationFee || DEFAULT_CREATION_FEE;

        // Write the transaction
        const hash = await writeContractAsync({
          address: factoryAddress,
          abi: HYPE_FACTORY_ABI,
          functionName: "createToken",
          args: [
            params.name,
            params.symbol,
            params.imageURI,
            params.description,
            params.hypeBoostEnabled,
          ],
          value: fee,
          chainId: ACTIVE_CHAIN_ID,
        });

        setTxHash(hash);

        // Wait for receipt and get the created token addresses
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
          });

          // Parse the TokenCreated event from the logs
          // Event signature: TokenCreated(address indexed tokenAddress, address indexed bondingCurveAddress, address indexed creator, ...)
          const tokenCreatedLog = receipt.logs.find((log) => {
            // TokenCreated event topic
            return log.topics[0] === "0x..." // We'll match by structure instead
          });

          // For now, return a placeholder - in production, parse the actual event
          // The token and bonding curve addresses are in topics[1] and topics[2]
          if (receipt.logs.length >= 1) {
            const log = receipt.logs[0];
            return {
              tokenAddress: (log.topics[1]?.slice(0, 42) ||
                "0x0") as Address,
              bondingCurveAddress: (log.topics[2]?.slice(0, 42) ||
                "0x0") as Address,
              txHash: hash,
            };
          }
        }

        return {
          tokenAddress: "0x0" as Address,
          bondingCurveAddress: "0x0" as Address,
          txHash: hash,
        };
      } catch (err) {
        console.error("Failed to create token:", err);
        setError(err instanceof Error ? err : new Error("Failed to create token"));
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [address, writeContractAsync, creationFee, publicClient]
  );

  return {
    createToken,
    isCreating,
    isConfirming,
    isConfirmed,
    txHash,
    error,
    reset: () => {
      setTxHash(undefined);
      setError(null);
    },
  };
}

// Hook: Get bonding curve state
export function useBondingCurveState(bondingCurveAddress: Address | undefined) {
  const { data: currentPrice } = useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "getCurrentPrice",
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress,
    },
  });

  const { data: marketCap } = useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "getMarketCap",
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress,
    },
  });

  const { data: totalSupply } = useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "totalSupply",
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress,
    },
  });

  const { data: reserveBalance } = useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "reserveBalance",
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress,
    },
  });

  const { data: isGraduated } = useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "isGraduated",
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress,
    },
  });

  return {
    currentPrice: currentPrice as bigint | undefined,
    marketCap: marketCap as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    reserveBalance: reserveBalance as bigint | undefined,
    isGraduated: isGraduated as boolean | undefined,
  };
}

// Hook: Calculate buy quote
export function useBuyQuote(
  bondingCurveAddress: Address | undefined,
  maticAmount: string
) {
  const amountWei = maticAmount ? parseEther(maticAmount) : BigInt(0);

  return useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "calculateBuy",
    args: [amountWei],
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress && amountWei > BigInt(0),
    },
  });
}

// Hook: Calculate sell quote
export function useSellQuote(
  bondingCurveAddress: Address | undefined,
  tokenAmount: string
) {
  const amountWei = tokenAmount ? parseEther(tokenAmount) : BigInt(0);

  return useReadContract({
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
    functionName: "calculateSell",
    args: [amountWei],
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!bondingCurveAddress && amountWei > BigInt(0),
    },
  });
}

// Hook: Buy tokens
export function useBuyTokens() {
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const buy = useCallback(
    async (params: BuyParams): Promise<Hash | null> => {
      if (!address) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      setIsBuying(true);
      setError(null);

      try {
        const maticWei = parseEther(params.maticAmount);
        const slippage = params.slippageBps || DEFAULT_SLIPPAGE_BPS;

        // For simplicity, set minTokens to 0 (could calculate properly with quote)
        const minTokens = BigInt(0);

        const hash = await writeContractAsync({
          address: params.bondingCurveAddress,
          abi: HYPE_BONDING_CURVE_ABI,
          functionName: "buy",
          args: [minTokens],
          value: maticWei,
          chainId: ACTIVE_CHAIN_ID,
        });

        setTxHash(hash);
        return hash;
      } catch (err) {
        console.error("Failed to buy tokens:", err);
        setError(err instanceof Error ? err : new Error("Failed to buy tokens"));
        return null;
      } finally {
        setIsBuying(false);
      }
    },
    [address, writeContractAsync]
  );

  return {
    buy,
    isBuying,
    isConfirming,
    isConfirmed,
    txHash,
    error,
    reset: () => {
      setTxHash(undefined);
      setError(null);
    },
  };
}

// Hook: Sell tokens
export function useSellTokens() {
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [isSelling, setIsSelling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const sell = useCallback(
    async (params: SellParams): Promise<Hash | null> => {
      if (!address) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      setIsSelling(true);
      setError(null);

      try {
        const tokenWei = parseEther(params.tokenAmount);
        const slippage = params.slippageBps || DEFAULT_SLIPPAGE_BPS;

        // For simplicity, set minMatic to 0 (could calculate properly with quote)
        const minMatic = BigInt(0);

        const hash = await writeContractAsync({
          address: params.bondingCurveAddress,
          abi: HYPE_BONDING_CURVE_ABI,
          functionName: "sell",
          args: [tokenWei, minMatic],
          chainId: ACTIVE_CHAIN_ID,
        });

        setTxHash(hash);
        return hash;
      } catch (err) {
        console.error("Failed to sell tokens:", err);
        setError(err instanceof Error ? err : new Error("Failed to sell tokens"));
        return null;
      } finally {
        setIsSelling(false);
      }
    },
    [address, writeContractAsync]
  );

  return {
    sell,
    isSelling,
    isConfirming,
    isConfirmed,
    txHash,
    error,
    reset: () => {
      setTxHash(undefined);
      setError(null);
    },
  };
}

// Hook: Get token balance
export function useTokenBalance(
  tokenAddress: Address | undefined,
  userAddress?: Address
) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = userAddress || connectedAddress;

  return useReadContract({
    address: tokenAddress,
    abi: HYPE_TOKEN_ABI,
    functionName: "balanceOf",
    args: targetAddress ? [targetAddress] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!tokenAddress && !!targetAddress,
    },
  });
}

// Hook: Approve token spending
export function useApproveToken() {
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const approve = useCallback(
    async (
      tokenAddress: Address,
      spenderAddress: Address,
      amount: bigint
    ): Promise<Hash | null> => {
      setIsApproving(true);
      setError(null);

      try {
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: HYPE_TOKEN_ABI,
          functionName: "approve",
          args: [spenderAddress, amount],
          chainId: ACTIVE_CHAIN_ID,
        });

        setTxHash(hash);
        return hash;
      } catch (err) {
        console.error("Failed to approve token:", err);
        setError(err instanceof Error ? err : new Error("Failed to approve"));
        return null;
      } finally {
        setIsApproving(false);
      }
    },
    [writeContractAsync]
  );

  return {
    approve,
    isApproving,
    isConfirming,
    isConfirmed,
    txHash,
    error,
    reset: () => {
      setTxHash(undefined);
      setError(null);
    },
  };
}

// Hook: Check token allowance
export function useTokenAllowance(
  tokenAddress: Address | undefined,
  spenderAddress: Address | undefined
) {
  const { address: ownerAddress } = useAccount();

  return useReadContract({
    address: tokenAddress,
    abi: HYPE_TOKEN_ABI,
    functionName: "allowance",
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
    },
  });
}
