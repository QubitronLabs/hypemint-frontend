<script lang="ts">
  import { wallet, isConnected, shortAddress, chainName, connectWallet, disconnectWallet, SUPPORTED_CHAINS } from '$lib/stores/wallet'
  import { isAuthenticated, autoLogin, logout, auth } from '$lib/stores/auth'
  import { toasts } from '$lib/stores/toast'
  import { Wallet, LogOut, X, Check, AlertTriangle, Loader2, Copy } from 'lucide-svelte'

  let showModal = $state(false)
  let isConnecting = $state(false)
  let copied = $state(false)

  // Automatic connect + sign flow
  async function handleConnect() {
    isConnecting = true
    
    try {
      // Step 1: Connect wallet
      const walletConnected = await connectWallet()
      if (!walletConnected) {
        toasts.error($wallet.error || 'Failed to connect wallet')
        return
      }
      
      toasts.info('Wallet connected! Signing in...')
      
      // Step 2: Automatically sign in (SIWE)
      const authSuccess = await autoLogin()
      if (authSuccess) {
        toasts.success('Signed in successfully!')
      } else {
        // If auth fails, wallet is still connected
        toasts.warning($auth.error || 'Wallet connected but sign-in failed')
      }
    } catch (err: any) {
      toasts.error(err.message || 'Connection failed')
    } finally {
      isConnecting = false
    }
  }

  function handleDisconnect() {
    disconnectWallet()
    logout()
    showModal = false
    toasts.info('Disconnected')
  }

  async function copyAddress() {
    if ($wallet.address) {
      await navigator.clipboard.writeText($wallet.address)
      copied = true
      setTimeout(() => copied = false, 2000)
    }
  }
</script>

{#if $isConnected}
  <button class="wallet-btn connected" onclick={() => showModal = true}>
    <span class="chain-badge">{$chainName}</span>
    <span class="address">{$shortAddress}</span>
    {#if $isAuthenticated}
      <span class="auth-badge"><Check size={10} /></span>
    {:else if $auth.isLoading}
      <span class="spinner-wrap"><Loader2 size={14} class="spin" /></span>
    {/if}
  </button>
{:else}
  <button class="wallet-btn" onclick={handleConnect} disabled={isConnecting || $wallet.isConnecting}>
    {#if isConnecting || $wallet.isConnecting || $auth.isLoading}
      <Loader2 size={16} class="spin" />
      <span>{$auth.isLoading ? 'Signing...' : 'Connecting...'}</span>
    {:else}
      <Wallet size={16} />
      <span>Connect</span>
    {/if}
  </button>
{/if}

{#if showModal}
  <div class="modal-overlay" onclick={() => showModal = false} role="dialog" aria-modal="true" aria-label="Wallet options" tabindex="-1"
    onkeydown={(e) => e.key === 'Escape' && (showModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()} role="document">
      <div class="modal-header">
        <h3>Wallet</h3>
        <button class="close-btn" onclick={() => showModal = false} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      
      <div class="modal-body">
        <div class="wallet-info">
          <div class="avatar">{$wallet.address?.slice(2, 4)}</div>
          <div class="details">
            <button class="address-row" onclick={copyAddress}>
              <span class="address-full">{$wallet.address?.slice(0, 20)}...{$wallet.address?.slice(-8)}</span>
              {#if copied}
                <Check size={14} class="copy-icon" />
              {:else}
                <Copy size={14} class="copy-icon" />
              {/if}
            </button>
            <span class="chain">{$chainName}</span>
          </div>
        </div>

        {#if $wallet.balance}
          <div class="balance">
            <span class="label">Balance</span>
            <span class="value">{parseFloat($wallet.balance).toFixed(4)} {SUPPORTED_CHAINS[$wallet.chainId || 1]?.symbol || 'POL'}</span>
          </div>
        {/if}

        <div class="status-section">
          {#if $isAuthenticated}
            <div class="signed-in">
              <Check size={16} />
              <span>Signed in as {$auth.user?.username || $shortAddress}</span>
            </div>
          {:else}
            <div class="not-signed">
              <AlertTriangle size={16} />
              <span>Not signed in</span>
            </div>
          {/if}
        </div>

        <div class="actions">
          <button class="btn btn-secondary disconnect-btn" onclick={handleDisconnect}>
            <LogOut size={16} />
            <span>Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .wallet-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.125rem;
    background: var(--gradient-1);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .wallet-btn:hover { 
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .wallet-btn:disabled { 
    opacity: 0.6; 
    cursor: not-allowed;
    transform: none;
  }

  .wallet-btn.connected {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
  }

  .wallet-btn.connected:hover {
    background: var(--border);
    border-color: var(--text-muted);
  }

  .chain-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: var(--bg-secondary);
    border-radius: 100px;
    color: var(--text-secondary);
  }

  .address { 
    font-family: 'JetBrains Mono', monospace; 
    font-size: 0.8rem; 
  }

  .auth-badge {
    width: 18px;
    height: 18px;
    background: var(--success);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner-wrap {
    display: flex;
    align-items: center;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 20px;
    width: 90%;
    max-width: 400px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h3 { 
    font-size: 1.125rem;
    font-weight: 600;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .modal-body { padding: 1.5rem; }

  .wallet-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .avatar {
    width: 52px;
    height: 52px;
    background: var(--gradient-1);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 1rem;
  }

  .details { 
    display: flex; 
    flex-direction: column; 
    gap: 0.375rem;
    flex: 1;
  }

  .address-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .address-full {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .copy-icon {
    color: var(--text-muted);
    transition: color 0.2s;
  }

  .address-row:hover .copy-icon {
    color: var(--accent);
  }

  .chain { 
    font-size: 0.8rem; 
    color: var(--accent);
    font-weight: 500;
  }

  .balance {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: var(--bg-tertiary);
    border-radius: 14px;
    margin-bottom: 1.25rem;
    border: 1px solid var(--border);
  }

  .balance .label { 
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .balance .value { 
    font-weight: 600; 
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
  }

  .actions { 
    display: flex; 
    flex-direction: column; 
    gap: 0.75rem; 
  }

  .disconnect-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem;
    border-radius: 12px;
  }

  .status-section { margin-bottom: 1.25rem; }

  .signed-in {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 12px;
    color: var(--success);
    font-size: 0.875rem;
  }

  .not-signed {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 12px;
    color: var(--warning);
    font-size: 0.875rem;
  }
</style>
