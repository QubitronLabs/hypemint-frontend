<script lang="ts">
  import { goto } from '$app/navigation'
  import { wallet, isConnected, shortAddress, disconnectWallet } from '$lib/stores/wallet'
  import { auth, isAuthenticated, logout } from '$lib/stores/auth'
  import { toasts } from '$lib/stores/toast'
  import { LogOut, Plus, Coins, ArrowRight } from 'lucide-svelte'

  interface Token {
    id: string
    name: string
    symbol: string
    imageUrl?: string
    marketCap: number
  }

  interface Trade {
    id: string
    type: 'buy' | 'sell'
    tokenSymbol: string
    tokenAmount: number
    ethAmount: number
    createdAt: string
  }

  let userTokens: Token[] = $state([])
  let recentTrades: Trade[] = $state([])
  let loading = $state(true)

  $effect(() => {
    if ($isAuthenticated) {
      loadUserData()
    }
  })

  async function loadUserData() {
    loading = true
    try {
      userTokens = [
        { id: '1', name: 'My Token', symbol: 'MTK', marketCap: 50000 }
      ]
      recentTrades = [
        { id: '1', type: 'buy', tokenSymbol: 'PEPE', tokenAmount: 10000, ethAmount: 0.01, createdAt: '2026-01-15T10:00:00Z' }
      ]
    } finally {
      loading = false
    }
  }

  function handleDisconnect() {
    disconnectWallet()
    logout()
    toasts.info('Disconnected')
    goto('/')
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }
</script>

<svelte:head>
  <title>Profile | HypeMint</title>
</svelte:head>

<div class="container">
  {#if !$isAuthenticated}
    <div class="empty-state card">
      <h2>Connect Wallet</h2>
      <p>Please connect your wallet to view your profile</p>
    </div>
  {:else}
    <div class="profile-page">
      <div class="profile-header card">
        <div class="profile-avatar">
          {$wallet.address?.slice(2, 4)}
        </div>
        <div class="profile-info">
          <h1>{$auth.user?.username || $shortAddress}</h1>
          <p class="address mono">{$wallet.address}</p>
          {#if $auth.user?.bio}
            <p class="bio">{$auth.user.bio}</p>
          {/if}
        </div>
        <button class="btn btn-secondary" onclick={handleDisconnect}>
          Disconnect
        </button>
      </div>

      <div class="profile-content">
        <div class="section card">
          <div class="section-header">
            <h3>Created Tokens</h3>
            <a href="/tokens?creator={$wallet.address}" class="view-all">View All →</a>
          </div>
          
          {#if loading}
            <div class="loading-container"><div class="loader"></div></div>
          {:else if userTokens.length > 0}
            <div class="tokens-list">
              {#each userTokens as token}
                <a href="/tokens/{token.id}" class="token-item">
                  <div class="token-avatar-sm">
                    <span>{token.symbol.slice(0, 2)}</span>
                  </div>
                  <div class="token-details">
                    <span class="name">{token.name}</span>
                    <span class="symbol">${token.symbol}</span>
                  </div>
                  <span class="market-cap">{formatNumber(token.marketCap)}</span>
                </a>
              {/each}
            </div>
          {:else}
            <div class="empty-section">
              <p>No tokens created</p>
              <a href="/tokens/create" class="btn btn-primary btn-sm">Create Token</a>
            </div>
          {/if}
        </div>

        <div class="section card">
          <div class="section-header">
            <h3>Recent Trades</h3>
            <a href="/trades" class="view-all">View All →</a>
          </div>
          
          {#if loading}
            <div class="loading-container"><div class="loader"></div></div>
          {:else if recentTrades.length > 0}
            <div class="trades-list">
              {#each recentTrades as trade}
                <div class="trade-item">
                  <span class="trade-type" class:buy={trade.type === 'buy'}>
                    <span class="type-dot"></span> {trade.type}
                  </span>
                  <span class="trade-token">{trade.tokenAmount} ${trade.tokenSymbol}</span>
                  <span class="trade-eth">{trade.ethAmount} ETH</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-section">
              <p>No trades yet</p>
              <a href="/tokens" class="btn btn-primary btn-sm">Start Trading</a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page { padding: 2rem 0; }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .profile-avatar {
    width: 80px;
    height: 80px;
    background: var(--gradient-1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .profile-info { flex: 1; }
  .profile-info h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .address { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
  .bio { color: var(--text-secondary); }

  .profile-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .view-all { font-size: 0.875rem; color: var(--text-secondary); }

  .tokens-list, .trades-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .token-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: inherit;
    transition: background 0.2s;
  }

  .token-item:hover { background: var(--border); }

  .token-avatar-sm {
    width: 36px;
    height: 36px;
    background: var(--gradient-1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .token-details { flex: 1; }
  .token-details .name { display: block; font-weight: 500; }
  .token-details .symbol { font-size: 0.75rem; color: var(--text-muted); }
  .market-cap { font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; }

  .trade-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .trade-type { 
    text-transform: capitalize; 
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .type-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
  }

  .trade-type.buy .type-dot {
    background: #22c55e;
  }

  .trade-token { flex: 1; }
  .trade-eth { font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); }

  .empty-section { text-align: center; padding: 2rem; }
  .empty-section p { margin-bottom: 1rem; color: var(--text-secondary); }

  .empty-state { text-align: center; padding: 4rem 2rem; }
  .empty-state h2 { margin-bottom: 0.5rem; }
  .empty-state p { color: var(--text-secondary); }

  @media (max-width: 768px) {
    .profile-content { grid-template-columns: 1fr; }
    .profile-header { flex-wrap: wrap; }
  }
</style>
