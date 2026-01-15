<script lang="ts">
  import { isAuthenticated } from '$lib/stores'
  import WalletButton from '$lib/components/WalletButton.svelte'
  import { Rocket, TrendingUp, Sparkles, ArrowRight, Zap, Shield, Users, BarChart3, ChevronRight } from 'lucide-svelte'

  interface Token {
    id: string
    name: string
    symbol: string
    imageUrl?: string
    marketCap: number
    priceChange24h: number
  }

  let trendingTokens: Token[] = $state([])
  let newTokens: Token[] = $state([])
  let loading = $state(true)

  $effect(() => {
    loadTokens()
  })

  async function loadTokens() {
    loading = true
    try {
      // Mock data - replace with real API call
      trendingTokens = [
        { id: '1', name: 'Pepe Token', symbol: 'PEPE', marketCap: 1500000, priceChange24h: 15.5 },
        { id: '2', name: 'Doge Coin', symbol: 'DOGE', marketCap: 850000, priceChange24h: -3.2 },
        { id: '3', name: 'Shiba Inu', symbol: 'SHIB', marketCap: 620000, priceChange24h: 8.7 }
      ]
      newTokens = [
        { id: '4', name: 'Moon Token', symbol: 'MOON', marketCap: 50000, priceChange24h: 45.2 },
        { id: '5', name: 'Rocket Coin', symbol: 'RKT', marketCap: 35000, priceChange24h: 22.1 }
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

  const features = [
    { icon: Zap, title: 'Instant Launch', description: 'Deploy your token in seconds with automated bonding curves' },
    { icon: Shield, title: 'Secure Trading', description: 'Anti-bot protection and fair launch mechanisms built-in' },
    { icon: Users, title: 'Community First', description: 'Fair distribution with no pre-sales or team allocations' },
    { icon: BarChart3, title: 'Auto Liquidity', description: 'Automatic graduation to DEX when market cap hits $69K' }
  ]
</script>

<div class="home">
  <!-- Hero Section -->
  <section class="hero">
    <div class="hero-bg">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
    </div>
    <div class="container">
      <div class="hero-content">
        <div class="hero-badge">
          <Sparkles size={14} />
          <span>Built on Polygon</span>
        </div>
        <h1>
          Launch Your Token
          <span class="gradient-text">In Minutes</span>
        </h1>
        <p class="hero-desc">
          Create and trade meme tokens with automated bonding curves. 
          No coding required. Fair launch guaranteed.
        </p>
        <div class="hero-actions">
          {#if $isAuthenticated}
            <a href="/tokens/create" class="btn btn-primary btn-lg">
              <Rocket size={20} />
              <span>Create Token</span>
            </a>
          {:else}
            <WalletButton />
          {/if}
          <a href="/tokens" class="btn btn-secondary btn-lg">
            <span>Explore Tokens</span>
            <ArrowRight size={18} />
          </a>
        </div>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value">$2.4M+</span>
            <span class="stat-label">Total Volume</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">1,234</span>
            <span class="stat-label">Tokens Created</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">8.5K</span>
            <span class="stat-label">Active Traders</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features-section">
    <div class="container">
      <div class="features-grid">
        {#each features as feature}
          <div class="feature-card">
            <div class="feature-icon">
              <feature.icon size={24} />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Trending Section -->
  <section class="tokens-section">
    <div class="container">
      <div class="section-header">
        <div class="section-title">
          <TrendingUp size={22} class="section-icon" />
          <h2>Trending Tokens</h2>
        </div>
        <a href="/tokens?sort=trending" class="view-all">
          <span>View All</span>
          <ChevronRight size={18} />
        </a>
      </div>

      {#if loading}
        <div class="loading-grid">
          {#each [1, 2, 3] as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if trendingTokens.length > 0}
        <div class="token-grid">
          {#each trendingTokens as token}
            <a href="/tokens/{token.id}" class="token-card">
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
                <div class="token-change" class:positive={token.priceChange24h > 0} class:negative={token.priceChange24h < 0}>
                  {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                </div>
              </div>
              <div class="token-footer">
                <div class="market-cap">
                  <span class="label">Market Cap</span>
                  <span class="value">{formatNumber(token.marketCap)}</span>
                </div>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>No trending tokens yet. Be the first to create one!</p>
          <a href="/tokens/create" class="btn btn-primary">
            <Rocket size={18} />
            <span>Create Token</span>
          </a>
        </div>
      {/if}
    </div>
  </section>

  <!-- New Tokens Section -->
  <section class="tokens-section">
    <div class="container">
      <div class="section-header">
        <div class="section-title">
          <Sparkles size={22} class="section-icon" />
          <h2>Newly Launched</h2>
        </div>
        <a href="/tokens?sort=new" class="view-all">
          <span>View All</span>
          <ChevronRight size={18} />
        </a>
      </div>

      {#if loading}
        <div class="loading-grid">
          {#each [1, 2] as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if newTokens.length > 0}
        <div class="token-grid">
          {#each newTokens as token}
            <a href="/tokens/{token.id}" class="token-card">
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
                <div class="token-change" class:positive={token.priceChange24h > 0} class:negative={token.priceChange24h < 0}>
                  {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                </div>
              </div>
              <div class="token-footer">
                <div class="market-cap">
                  <span class="label">Market Cap</span>
                  <span class="value">{formatNumber(token.marketCap)}</span>
                </div>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="empty-state"><p>No new tokens yet.</p></div>
      {/if}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta-section">
    <div class="container">
      <div class="cta-card">
        <div class="cta-content">
          <h2>Ready to launch your token?</h2>
          <p>Join thousands of creators who have launched their tokens on HypeMint</p>
        </div>
        <div class="cta-actions">
          {#if $isAuthenticated}
            <a href="/tokens/create" class="btn btn-primary btn-lg">
              <Rocket size={20} />
              <span>Get Started</span>
            </a>
          {:else}
            <WalletButton />
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .home { padding-bottom: 4rem; }

  /* Hero */
  .hero {
    position: relative;
    min-height: 85vh;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .gradient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.4;
  }

  .orb-1 {
    width: 600px;
    height: 600px;
    background: var(--accent);
    top: -200px;
    right: -100px;
  }

  .orb-2 {
    width: 500px;
    height: 500px;
    background: #ec4899;
    bottom: -150px;
    left: -100px;
  }

  .hero-content {
    position: relative;
    max-width: 720px;
    z-index: 1;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 100px;
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  .hero h1 {
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 1.5rem;
    letter-spacing: -0.02em;
  }

  .gradient-text {
    display: block;
    background: var(--gradient-1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-desc {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin-bottom: 2.5rem;
    line-height: 1.7;
    max-width: 540px;
  }

  .hero-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 3.5rem;
  }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 16px;
    backdrop-filter: blur(10px);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat-divider {
    width: 1px;
    height: 40px;
    background: var(--border);
  }

  /* Features */
  .features-section {
    padding: 5rem 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.01);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    padding: 2rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 20px;
    transition: all 0.3s ease;
  }

  .feature-card:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
  }

  .feature-icon {
    width: 52px;
    height: 52px;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    margin-bottom: 1.25rem;
  }

  .feature-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .feature-card p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  /* Tokens Sections */
  .tokens-section { padding: 4rem 0; }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.75rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.section-icon) { color: var(--accent); }

  .section-title h2 {
    font-size: 1.4rem;
    font-weight: 600;
  }

  .view-all {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .view-all:hover { color: var(--accent); }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .token-card {
    display: block;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 18px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
  }

  .token-card:hover {
    border-color: var(--text-muted);
    transform: translateY(-2px);
  }

  .token-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .token-avatar {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--gradient-1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    flex-shrink: 0;
  }

  .token-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .token-info {
    flex: 1;
    min-width: 0;
  }

  .token-info h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-symbol {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .token-change {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  .token-change.positive {
    background: rgba(34, 197, 94, 0.15);
    color: var(--success);
  }

  .token-change.negative {
    background: rgba(239, 68, 68, 0.15);
    color: var(--error);
  }

  .token-footer {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .market-cap {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .market-cap .label {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .market-cap .value {
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Loading */
  .loading-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .skeleton-card {
    height: 160px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 18px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 3rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 18px;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  /* CTA */
  .cta-section { padding: 4rem 0; }

  .cta-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
    padding: 3rem;
    background: var(--gradient-1);
    border-radius: 24px;
    position: relative;
    overflow: hidden;
  }

  .cta-content {
    position: relative;
    z-index: 1;
  }

  .cta-content h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .cta-content p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1rem;
  }

  .cta-actions {
    position: relative;
    z-index: 1;
  }

  .cta-actions :global(.btn-primary) {
    background: white !important;
    color: var(--accent) !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .hero {
      min-height: auto;
      padding: 3rem 0;
    }

    .hero-stats {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .stat-divider {
      width: 100%;
      height: 1px;
    }

    .cta-card {
      flex-direction: column;
      text-align: center;
      padding: 2rem;
    }

    .token-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
