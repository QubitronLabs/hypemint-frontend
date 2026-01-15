import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";

// Types
interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
}

// Supported chains - Polygon Amoy Testnet added
export const SUPPORTED_CHAINS: Record<
  number,
  { name: string; symbol: string; rpc: string; testnet?: boolean }
> = {
  1: { name: "Ethereum", symbol: "ETH", rpc: "https://eth.llamarpc.com" },
  137: { name: "Polygon", symbol: "MATIC", rpc: "https://polygon-rpc.com" },
  80002: {
    name: "Polygon Amoy",
    symbol: "MATIC",
    rpc: "https://rpc-amoy.polygon.technology",
    testnet: true,
  },
  56: { name: "BSC", symbol: "BNB", rpc: "https://bsc-dataseed.binance.org" },
  42161: {
    name: "Arbitrum",
    symbol: "ETH",
    rpc: "https://arb1.arbitrum.io/rpc",
  },
  8453: { name: "Base", symbol: "ETH", rpc: "https://mainnet.base.org" },
};

// Main wallet store
const initialState: WalletState = {
  address: null,
  chainId: null,
  balance: null,
  isConnecting: false,
  error: null,
};

function createWalletStore() {
  const { subscribe, set, update } = writable<WalletState>(initialState);

  return {
    subscribe,
    set,
    update,
    reset: () => set(initialState),
  };
}

export const wallet = createWalletStore();

// Derived stores
export const isConnected = derived(wallet, ($w) => !!$w.address);
export const shortAddress = derived(wallet, ($w) =>
  $w.address ? `${$w.address.slice(0, 6)}...${$w.address.slice(-4)}` : null
);
export const chainName = derived(wallet, ($w) =>
  $w.chainId
    ? SUPPORTED_CHAINS[$w.chainId]?.name || `Chain ${$w.chainId}`
    : null
);

// Get ethers dynamically (browser only)
async function getEthers() {
  if (!browser) return null;
  const { BrowserProvider, formatEther } = await import("ethers");
  return { BrowserProvider, formatEther };
}

// Connect wallet
export async function connectWallet(): Promise<boolean> {
  if (!browser) return false;

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    wallet.update((s) => ({
      ...s,
      error: "Please install MetaMask or another Web3 wallet",
    }));
    console.error(
      "MetaMask not found. Please install from https://metamask.io"
    );
    return false;
  }

  wallet.update((s) => ({ ...s, isConnecting: true, error: null }));

  try {
    const ethers = await getEthers();
    if (!ethers) return false;

    const provider = new ethers.BrowserProvider(ethereum);

    // Request accounts - this should trigger MetaMask popup
    console.log("Requesting MetaMask accounts...");
    const accounts = await provider.send("eth_requestAccounts", []);
    console.log("MetaMask accounts received:", accounts);

    if (accounts.length === 0) {
      throw new Error("No accounts found");
    }

    const address = accounts[0];
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(address);

    wallet.set({
      address,
      chainId: Number(network.chainId),
      balance: ethers.formatEther(balance),
      isConnecting: false,
      error: null,
    });

    // Store in localStorage
    localStorage.setItem("walletConnected", "true");

    return true;
  } catch (err: any) {
    console.error("Wallet connection error:", err);
    wallet.update((s) => ({
      ...s,
      isConnecting: false,
      error: err.message || "Failed to connect wallet",
    }));
    return false;
  }
}

// Disconnect wallet
export function disconnectWallet() {
  wallet.reset();
  if (browser) {
    localStorage.removeItem("walletConnected");
  }
}

// Sign message for SIWE
export async function signMessage(message: string): Promise<string | null> {
  if (!browser) return null;

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    console.error("MetaMask not found");
    return null;
  }

  try {
    const ethers = await getEthers();
    if (!ethers) return null;

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    console.log("Requesting signature from MetaMask...");
    const signature = await signer.signMessage(message);
    console.log("Signature received:", signature);

    return signature;
  } catch (err) {
    console.error("Failed to sign message:", err);
    return null;
  }
}

// Auto-reconnect on page load
export async function initWallet() {
  if (!browser) return;

  const wasConnected = localStorage.getItem("walletConnected");
  if (wasConnected === "true") {
    await connectWallet();
  }
}

// Setup event listeners
export function setupWalletListeners() {
  if (!browser) return;

  const ethereum = (window as any).ethereum;
  if (!ethereum) return;

  ethereum.on("accountsChanged", async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      await connectWallet();
    }
  });

  ethereum.on("chainChanged", async () => {
    await connectWallet();
  });
}
