<script lang="ts">
  import { api } from '$lib/services/api'
  import { toasts } from '$lib/stores'
  import { Search, Plus, TrendingUp, Clock, BarChart3, Activity } from 'lucide-svelte'

  interface Token {
    id: string
    name: string
    symbol: string
    imageUrl?: string
    marketCap: number
    priceChange24h: number
    volume24h: number
    holders: number
  }

  let tokens: Token[] = $state([])
  let loading = $state(true)
  let searchQuery = $state('')
  let sortBy = $state('trending')

  const sortOptions = [
    { value: 'trending', label: 'Trending', icon: TrendingUp },
    { value: 'new', label: 'Newest', icon: Clock },
    { value: 'marketCap', label: 'Market Cap', icon: BarChart3 },
    { value: 'volume', label: 'Volume', icon: Activity }
  ]

  $effect(() => {
    loadTokens()
  })

  async function loadTokens() {
    loading = true
    try {
      // Mock data - replace with API
      tokens = [
        { id: '1', name: 'Pepe Token', symbol: 'PEPE', marketCap: 1500000, priceChange24h: 15.5, volume24h: 250000, holders: 1240 },
        { id: '2', name: 'Doge Coin', symbol: 'DOGE', marketCap: 850000, priceChange24h: -3.2, volume24h: 150000, holders: 890 },
        { id: '3', name: 'Shiba Inu', symbol: 'SHIB', marketCap: 620000, priceChange24h: 8.7, volume24h: 95000, holders: 654 },
        { id: '4', name: 'Moon Token', symbol: 'MOON', marketCap: 50000, priceChange24h: 45.2, volume24h: 35000, holders: 234 },
        { id: '5', name: 'Rocket Coin', symbol: 'RKT', marketCap: 35000, priceChange24h: 22.1, volume24h: 22000, holders: 156 },
        { id: '6', name: 'Diamond Hands', symbol: 'DMD', marketCap: 280000, priceChange24h: -5.8, volume24h: 45000, holders: 432 }
      ]
    } finally {
      loading = false
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  let filteredTokens = $derived(
    tokens.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )
</script>

<svelte:head>
  <title>Tokens | HypeMint</title>
</svelte:head>

<div class="container">
  <div class="page-header">
    <div>
      <h1>Explore Tokens</h1>
      <p class="subtitle">Discover and trade tokens with automated bonding curves</p>
    </div>
    <a href="/tokens/create" class="btn btn-primary">
      <Plus size={18} />
      <span>Create Token</span>
    </a>
  </div>

  <div class="filters">
    <div class="search-box">
      <Search size={18} class="search-icon" />
      <input 
        type="text" 
        placeholder="Search tokens..."
        bind:value={searchQuery}
      />
    </div>
    <div class="sort-box">
      <select bind:value={sortBy}>
        {#each sortOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if loading}
    <div class="loading-container">
      <div class="loader"></div>
    </div>
  {:else if filteredTokens.length === 0}
    <div class="empty-state">
      <p>No tokens found</p>
      <a href="/tokens/create" class="btn btn-primary">Create Token</a>
    </div>
  {:else}
    <div class="token-grid">
      {#each filteredTokens as token}
        <a href="/tokens/{token.id}" class="token-card card card-clickable">
          <div class="token-header">
            <div class="token-avatar">
              {#if token.imageUrl}
                <img src={token.imageUrl} alt={token.name} />
              {:else}
                <span>{token.symbol.slice(0, 2)}</span>
              {/if}
            </div>
            <div class="token-info">
              <h3>{token.name}</h3>
              <span class="token-symbol">${token.symbol}</span>
            </div>
            <span class="price-change" class:positive={token.priceChange24h > 0} class:negative={token.priceChange24h < 0}>
              {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
            </span>
          </div>
          <div class="token-stats">
            <div class="stat">
              <span class="stat-label">Market Cap</span>
              <span class="stat-value">{formatNumber(token.marketCap)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Volume 24h</span>
              <span class="stat-value">{formatNumber(token.volume24h)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Holders</span>
              <span class="stat-value">{token.holders}</span>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 2rem 0;
  }

  .page-header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .subtitle { color: var(--text-secondary); }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .search-box { 
    flex: 1;
    position: relative;
  }
  
  .search-box :global(.search-icon) {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }
  
  .search-box input {
    padding-left: 44px;
  }
  
  .sort-box { width: 200px; }

  .token-card { display: block; color: inherit; text-decoration: none; }

  .token-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .token-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--gradient-1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    overflow: hidden;
  }

  .token-avatar img { width: 100%; height: 100%; object-fit: cover; }

  .token-info { flex: 1; }
  .token-info h3 { font-size: 1rem; margin-bottom: 0.25rem; }
  .token-symbol { color: var(--text-secondary); font-size: 0.875rem; }

  .price-change {
    font-weight: 600;
    font-size: 0.875rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .positive { color: var(--success); }
  .negative { color: var(--error); }

  .token-stats {
    display: flex;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .stat { display: flex; flex-direction: column; gap: 0.25rem; }
  .stat-label { font-size: 0.75rem; color: var(--text-muted); }
  .stat-value { font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; }
</style>
