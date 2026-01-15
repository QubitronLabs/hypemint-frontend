import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { wallet, signMessage } from "./wallet";
import { api } from "$lib/services/api";

interface User {
  id: string;
  address: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    set,
    update,
    reset: () => {
      set(initialState);
      if (browser) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
      }
    },
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, ($a) => !!$a.token && !!$a.user);

// Create SIWE message
function createSiweMessage(
  address: string,
  nonce: string,
  chainId: number
): string {
  return `Welcome to HypeMint!\n\nPlease sign this message to verify your wallet ownership.\n\nNonce: ${nonce}`;
}

// Automatic login - called right after wallet connects
export async function autoLogin(): Promise<boolean> {
  const walletState = get(wallet);

  if (!walletState.address) {
    console.error("No wallet address found");
    return false;
  }

  // Check if already authenticated
  const authState = get(auth);
  if (authState.token && authState.user) {
    console.log("Already authenticated");
    return true;
  }

  auth.update((s) => ({ ...s, isLoading: true, error: null }));

  try {
    console.log("Requesting nonce from server for:", walletState.address);
    // Get nonce from server
    const nonceResult = await api.auth.getNonce(walletState.address);
    if (!nonceResult.success || !nonceResult.data) {
      throw new Error(nonceResult.error?.message || "Failed to get nonce");
    }

    const { nonce, message: serverMessage } = nonceResult.data;
    console.log("Received nonce:", nonce);

    // Use server-provided message or create one
    const messageToSign =
      serverMessage ||
      createSiweMessage(walletState.address, nonce, walletState.chainId || 1);

    console.log("Message to sign:", messageToSign);

    // Automatically prompt for signature
    const signature = await signMessage(messageToSign);
    if (!signature) {
      throw new Error("Signature rejected");
    }

    console.log("Verifying signature with server...");
    // Verify signature with server
    const verifyResult = await api.auth.verify({
      walletAddress: walletState.address,
      nonce,
      signature,
    });

    if (!verifyResult.success || !verifyResult.data) {
      throw new Error(verifyResult.error?.message || "Verification failed");
    }

    const { token, user } = verifyResult.data;
    console.log("Authentication successful");

    // Save to store and localStorage
    auth.set({
      user: {
        id: user.id,
        address: user.walletAddress,
        username: user.username,
        bio: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      },
      token,
      isLoading: false,
      error: null,
    });

    if (browser) {
      localStorage.setItem("authToken", token);
      localStorage.setItem("authUser", JSON.stringify(user));
    }

    return true;
  } catch (err: any) {
    console.error("Authentication error:", err);
    auth.update((s) => ({
      ...s,
      isLoading: false,
      error: err.message || "Login failed",
    }));
    return false;
  }
}

// Legacy login function (kept for compatibility)
export const login = autoLogin;

// Logout
export function logout() {
  auth.reset();
}

// Initialize auth from localStorage
export function initAuth() {
  if (!browser) return;

  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("authUser");

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      auth.set({
        user: {
          id: user.id,
          address: user.walletAddress || user.address,
          username: user.username,
          bio: user.bio || null,
          avatarUrl: user.avatarUrl || null,
          createdAt: user.createdAt || new Date().toISOString(),
        },
        token,
        isLoading: false,
        error: null,
      });
    } catch {
      auth.reset();
    }
  }
}

// Refresh user data
export async function refreshUser(): Promise<void> {
  const authState = get(auth);
  if (!authState.token) return;

  try {
    const result = await api.auth.getMe();
    if (result.success && result.data) {
      auth.update((s) => ({ ...s, user: result.data }));
      if (browser) {
        localStorage.setItem("authUser", JSON.stringify(result.data));
      }
    }
  } catch (err) {
    console.error("Failed to refresh user:", err);
  }
}
