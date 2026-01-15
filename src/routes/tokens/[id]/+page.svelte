<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { isAuthenticated, wallet } from '$lib/stores'
  import { toasts } from '$lib/stores/toast'
  import { blockchain, type TokenInfo, type CurveAnalytics, type TradeQuote } from '$lib/contracts'
  import PriceChart from '$lib/components/PriceChart.svelte'
  import Comments from '$lib/components/Comments.svelte'
  import TradesFeed from '$lib/components/TradesFeed.svelte'
  import { ArrowLeft, AlertTriangle, RefreshCw, Copy, ExternalLink, TrendingUp, BarChart3, Users, Activity, Globe, Twitter, Send, User, ChevronRight, Loader2, LineChart, MessageSquare, ArrowUpDown } from 'lucide-svelte'

  let tokenAddress = $derived($page.params.id)
  let token = $state<TokenInfo | null>(null)
  let analytics = $state<CurveAnalytics | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Trading state
  let tradeType = $state<'buy' | 'sell'>('buy')
  let amount = $state('')
  let quote = $state<TradeQuote | null>(null)
  let tradeLoading = $state(false)
  let quoteLoading = $state(false)
  let userBalance = $state('0')

  // Tab state
  let activeTab = $state<'chart' | 'trades' | 'comments'>('chart')

  onMount(async () => {
    await loadToken()
  })

  async function loadToken() {
    if (!tokenAddress) {
      error = 'No token address provided'
      loading = false
      return
    }
    loading = true
    error = null
    try {
      token = await blockchain.getTokenInfo(tokenAddress)
      if (token?.curveAddress) {
        analytics = await blockchain.getCurveAnalytics(token.curveAddress)
      }
      if ($wallet.address && token?.tokenAddress) {
        userBalance = await blockchain.getTokenBalance(token.tokenAddress, $wallet.address)
      }
    } catch (err: any) {
      console.error('Failed to load token:', err)
      error = err.message || 'Failed to load token data'
    } finally {
      loading = false
    }
  }

  async function updateQuote() {
    if (!token?.curveAddress || !amount || parseFloat(amount) <= 0) {
      quote = null
      return
    }

    quoteLoading = true
    try {
      if (tradeType === 'buy') {
        quote = await blockchain.getBuyQuote(token.curveAddress, amount)
      } else {
        quote = await blockchain.getSellQuote(token.curveAddress, amount)
      }
    } catch (err) {
      console.error('Quote error:', err)
      quote = null
    } finally {
      quoteLoading = false
    }
  }

  // Debounced quote update
  let quoteTimeout: ReturnType<typeof setTimeout>
  $effect(() => {
    amount; tradeType;
    clearTimeout(quoteTimeout)
    quoteTimeout = setTimeout(updateQuote, 300)
  })

  async function handleTrade() {
    if (!$isAuthenticated || !$wallet.address) {
      toasts.warning('Please connect wallet first')
      return
    }

    if (!token?.curveAddress || !token?.tokenAddress) {
      toasts.error('Invalid token')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toasts.error('Enter a valid amount')
      return
    }

    tradeLoading = true
    try {
      let txHash: string
      if (tradeType === 'buy') {
        const minTokens = quote?.tokensOut 
          ? (parseFloat(quote.tokensOut) * 0.95).toString()
          : '0'
        txHash = await blockchain.buyTokens(token.curveAddress, amount, minTokens)
        toasts.success(`Bought ${token.symbol}! Tx: ${txHash.slice(0, 10)}...`)
      } else {
        const minEth = quote?.ethOut
          ? (parseFloat(quote.ethOut) * 0.95).toString()
          : '0'
        txHash = await blockchain.sellTokens(token.tokenAddress, token.curveAddress, amount, minEth)
        toasts.success(`Sold ${token.symbol}! Tx: ${txHash.slice(0, 10)}...`)
      }
      
      amount = ''
      quote = null
      await loadToken()
    } catch (err: any) {
      console.error('Trade failed:', err)
      toasts.error(err.message || 'Trade failed')
    } finally {
      tradeLoading = false
    }
  }

  function formatNumber(num: string | number, decimals: number = 2): string {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(n)) return '0'
    if (n >= 1000000) return `${(n / 1000000).toFixed(decimals)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(decimals)}K`
    return n.toFixed(decimals)
  }

  function formatPrice(price: string | number): string {
    const p = typeof price === 'string' ? parseFloat(price) : price
    if (isNaN(p) || p === 0) return '$0.000000'
    if (p < 0.000001) return `$${p.toExponential(2)}`
    if (p < 0.01) return `$${p.toFixed(6)}`
    return `$${p.toFixed(4)}`
  }

  function shortenAddress(addr: string): string {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  function copyAddress(addr: string) {
    navigator.clipboard.writeText(addr)
    toasts.success('Address copied!')
  }
</script>

<svelte:head>
  <title>{token?.name || 'Loading...'} | HypeMint</title>
</svelte:head>

<div class="container">
  <div class="back-nav">
    <a href="/tokens" class="back-link">
      <ArrowLeft size={18} />
      <span>Back to Tokens</span>
    </a>
  </div>

  {#if loading}
    <div class="loading-state">
      <Loader2 size={32} class="spin" />
      <p>Loading token data...</p>
    </div>
  {:else if error}
    <div class="error-state card">
      <div class="error-icon">
        <AlertTriangle size={32} />
      </div>
      <h2>Failed to Load Token</h2>
      <p>{error}</p>
      <button class="btn btn-primary" onclick={loadToken}>
        <RefreshCw size={16} />
        <span>Try Again</span>
      </button>
    </div>
  {:else if token}
    <div class="token-page">
      <div class="main-content">
        <div class="token-header card">
          <div class="header-left">
            <div class="token-avatar">
              {#if token.imageUrl}
                <img src={token.imageUrl} alt={token.name} />
              {:else}
                <span class="avatar-text">{token.symbol.slice(0, 2)}</span>
              {/if}
            </div>
            <div class="token-info">
              <div class="token-name-row">
                <h1>{token.name}</h1>
                <span class="symbol">${token.symbol}</span>
                {#if token.graduated}
                  <span class="badge graduated">Graduated</span>
                {/if}
              </div>
              <div class="token-address">
                <button class="copy-address" onclick={() => copyAddress(token?.tokenAddress || '')}>
                  <span>{shortenAddress(token.tokenAddress)}</span>
                  <Copy size={14} />
                </button>
                <a href={`https://polygonscan.com/token/${token.tokenAddress}`} target="_blank" rel="noopener" class="external-link">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
          <div class="header-right">
            <div class="current-price">{formatPrice(token.currentPrice)}</div>
            <div class="price-change positive">+0.00%</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card card">
            <div class="stat-icon"><TrendingUp size={20} /></div>
            <div class="stat-content">
              <span class="stat-label">Market Cap</span>
              <span class="stat-value">${formatNumber(token.marketCap)}</span>
            </div>
          </div>
          <div class="stat-card card">
            <div class="stat-icon">💹</div>
            <div class="stat-content">
              <span class="stat-label">Volume</span>
              <span class="stat-value">${formatNumber(analytics?.totalVolume || '0')}</span>
            </div>
          </div>
          <div class="stat-card card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <span class="stat-label">Holders</span>
              <span class="stat-value">{analytics?.uniqueHolders || 0}</span>
            </div>
          </div>
          <div class="stat-card card">
            <div class="stat-icon">🔄</div>
            <div class="stat-content">
              <span class="stat-label">Trades</span>
              <span class="stat-value">{(analytics?.buyCount || 0) + (analytics?.sellCount || 0)}</span>
            </div>
          </div>
        </div>

        <div class="content-tabs">
          <button class="tab" class:active={activeTab === 'chart'} onclick={() => activeTab = 'chart'}>
            <LineChart size={16} />
            <span>Chart</span>
          </button>
          <button class="tab" class:active={activeTab === 'trades'} onclick={() => activeTab = 'trades'}>
            <ArrowUpDown size={16} />
            <span>Trades</span>
          </button>
          <button class="tab" class:active={activeTab === 'comments'} onclick={() => activeTab = 'comments'}>
            <MessageSquare size={16} />
            <span>Comments</span>
          </button>
        </div>

        <div class="tab-content">
          {#if activeTab === 'chart'}
            <div class="chart-container card">
              <PriceChart tokenSymbol={token.symbol} />
            </div>
          {:else if activeTab === 'trades'}
            <div class="trades-container">
              <TradesFeed tokenSymbol={token.symbol} />
            </div>
          {:else if activeTab === 'comments'}
            <Comments tokenId={token.tokenAddress} />
          {/if}
        </div>

        {#if token.description}
          <div class="about-section card">
            <h3>About {token.name}</h3>
            <p class="description">{token.description}</p>
            
            <div class="social-links">
              {#if token.twitterUrl}
                <a href={token.twitterUrl} target="_blank" rel="noopener" class="social-link twitter">
                  <Twitter size={16} />
                  <span>Twitter</span>
                </a>
              {/if}
              {#if token.telegramUrl}
                <a href={token.telegramUrl} target="_blank" rel="noopener" class="social-link telegram">
                  <Send size={16} />
                  <span>Telegram</span>
                </a>
              {/if}
              {#if token.websiteUrl}
                <a href={token.websiteUrl} target="_blank" rel="noopener" class="social-link website">
                  <Globe size={16} />
                  <span>Website</span>
                </a>
              {/if}
            </div>
          </div>
        {/if}

        <div class="creator-section card">
          <h3><User size={18} /> Creator</h3>
          <div class="creator-address">
            <button class="copy-address" onclick={() => copyAddress(token?.creator || '')}>
              <span>{shortenAddress(token.creator)}</span>
              <Copy size={14} />
            </button>
            <a href={`https://polygonscan.com/address/${token.creator}`} target="_blank" rel="noopener" class="external-link">
              <span>View on Polygonscan</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      <div class="trade-sidebar">
        <div class="trade-panel card sticky">
          <h3>Trade {token.symbol}</h3>
          
          <div class="trade-tabs">
            <button class="trade-tab buy" class:active={tradeType === 'buy'} onclick={() => { tradeType = 'buy'; amount = ''; quote = null; }}>
              <span class="tab-dot buy"></span>
              <span>Buy</span>
            </button>
            <button class="trade-tab sell" class:active={tradeType === 'sell'} onclick={() => { tradeType = 'sell'; amount = ''; quote = null; }}>
              <span class="tab-dot sell"></span>
              <span>Sell</span>
            </button>
          </div>

          <div class="trade-form">
            <div class="form-group">
              <div class="input-header">
                <label>{tradeType === 'buy' ? 'POL Amount' : `${token.symbol} Amount`}</label>
                {#if tradeType === 'sell'}
                  <span class="balance">Balance: {formatNumber(userBalance, 4)}</span>
                {/if}
              </div>
              <div class="input-wrapper">
                <input type="number" placeholder="0.0" bind:value={amount} step="0.001" min="0" />
                <span class="input-suffix">{tradeType === 'buy' ? 'POL' : token.symbol}</span>
              </div>
              {#if tradeType === 'sell'}
                <div class="quick-amounts">
                  <button onclick={() => amount = (parseFloat(userBalance) * 0.25).toString()}>25%</button>
                  <button onclick={() => amount = (parseFloat(userBalance) * 0.5).toString()}>50%</button>
                  <button onclick={() => amount = (parseFloat(userBalance) * 0.75).toString()}>75%</button>
                  <button onclick={() => amount = userBalance}>Max</button>
                </div>
              {/if}
            </div>

            {#if quote}
              <div class="quote-details">
                <div class="quote-row">
                  <span>You'll {tradeType === 'buy' ? 'receive' : 'get'}</span>
                  <span class="quote-value">
                    {tradeType === 'buy' 
                      ? `${formatNumber(quote.tokensOut || '0', 4)} ${token.symbol}`
                      : `${formatNumber(quote.ethOut || '0', 6)} POL`
                    }
                  </span>
                </div>
                <div class="quote-row">
                  <span>Fee (1%)</span>
                  <span class="quote-value">{formatNumber(quote.fee, 6)} POL</span>
                </div>
                <div class="quote-row">
                  <span>Price Impact</span>
                  <span class="quote-value" class:high-impact={quote.priceImpact > 5}>{quote.priceImpact.toFixed(2)}%</span>
                </div>
              </div>
            {/if}

            <button class="btn btn-trade {tradeType}" onclick={handleTrade} disabled={tradeLoading || !$isAuthenticated || !amount || parseFloat(amount) <= 0}>
              {#if tradeLoading}
                <Loader2 size={16} class="spin" />
                <span>Processing...</span>
              {:else if !$isAuthenticated}
                Connect Wallet
              {:else if quoteLoading}
                Getting quote...
              {:else}
                <span class="btn-dot {tradeType}"></span>
                <span>{tradeType === 'buy' ? 'Buy' : 'Sell'} {token.symbol}</span>
              {/if}
            </button>
          </div>

          {#if !token.graduated}
            <div class="graduation-progress">
              <div class="progress-header">
                <span class="progress-title">
                  <TrendingUp size={16} />
                  <span>Graduation Progress</span>
                </span>
                <span class="progress-percent">{Math.min(100, (parseFloat(token.marketCap) / 69000 * 100)).toFixed(1)}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {Math.min(100, (parseFloat(token.marketCap) / 69000 * 100))}%"></div>
              </div>
              <p class="progress-text">${formatNumber(token.marketCap)} / $69K to DEX listing</p>
            </div>
          {:else}
            <div class="graduated-badge">
              <span class="badge-icon"><TrendingUp size={20} /></span>
              <span>Listed on DEX!</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1400px; margin: 0 auto; padding: 0 1rem; }
  .back-nav { padding: 1rem 0; }
  .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); text-decoration: none; transition: color 0.2s; }
  .back-link:hover { color: var(--accent); }

  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 1rem; }
  .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-state { text-align: center; padding: 3rem; }
  .error-icon { font-size: 3rem; margin-bottom: 1rem; }
  .error-state h2 { margin-bottom: 0.5rem; }
  .error-state p { color: var(--text-secondary); margin-bottom: 1.5rem; }

  .token-page { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; padding-bottom: 3rem; }
  .token-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .header-left { display: flex; align-items: center; gap: 1rem; }
  .token-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--gradient-1); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
  .token-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-text { font-size: 1.5rem; font-weight: 700; color: white; }
  .token-name-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .token-name-row h1 { font-size: 1.75rem; margin: 0; }
  .symbol { color: var(--text-secondary); font-size: 1rem; }
  .badge { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); background: var(--success); color: white; }
  .token-address { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; color: var(--text-secondary); font-size: 0.875rem; font-family: 'JetBrains Mono', monospace; }
  .token-address span { cursor: pointer; }
  .token-address span:hover { color: var(--accent); }
  .external-link { color: var(--accent); text-decoration: none; }
  .header-right { text-align: right; }
  .current-price { font-size: 1.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
  .price-change { font-size: 0.875rem; font-weight: 600; }
  .positive { color: var(--success); }
  .negative { color: var(--error); }

  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
  .stat-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; }
  .stat-icon { font-size: 1.5rem; }
  .stat-label { display: block; font-size: 0.75rem; color: var(--text-muted); }
  .stat-value { font-size: 1.125rem; font-weight: 600; font-family: 'JetBrains Mono', monospace; }

  .content-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tab { padding: 0.75rem 1.25rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-weight: 500; font-size: 0.875rem; }
  .tab:hover { background: var(--border); }
  .tab.active { background: var(--accent); color: white; border-color: var(--accent); }
  .chart-container { padding: 0; overflow: hidden; }

  .about-section h3 { margin-bottom: 1rem; }
  .description { color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; }
  .social-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .social-link { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; transition: all 0.2s; }
  .social-link:hover { background: var(--border); color: var(--text-primary); }
  .social-link.twitter:hover { color: #1DA1F2; }
  .social-link.telegram:hover { color: #0088cc; }

  .creator-section h3 { margin-bottom: 0.75rem; }
  .creator-address { display: flex; align-items: center; gap: 1rem; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); }
  .creator-address span { cursor: pointer; }
  .creator-address span:hover { color: var(--accent); }

  .trade-sidebar { position: relative; }
  .trade-panel.sticky { position: sticky; top: 1rem; }
  .trade-panel h3 { margin-bottom: 1rem; text-align: center; }
  .trade-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem; }
  .trade-tab { padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-tertiary); cursor: pointer; font-weight: 600; transition: all 0.2s; }
  .trade-tab.buy:hover, .trade-tab.buy.active { border-color: var(--success); background: rgba(16, 185, 129, 0.1); }
  .trade-tab.sell:hover, .trade-tab.sell.active { border-color: var(--error); background: rgba(239, 68, 68, 0.1); }

  .trade-form { display: flex; flex-direction: column; gap: 1rem; }
  .input-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .balance { font-size: 0.75rem; color: var(--text-muted); }
  .input-wrapper { display: flex; align-items: center; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
  .input-wrapper input { flex: 1; background: transparent; border: none; padding: 0.75rem; font-size: 1.125rem; font-family: 'JetBrains Mono', monospace; }
  .input-wrapper input:focus { outline: none; }
  .input-suffix { padding: 0.75rem; color: var(--text-muted); font-weight: 500; border-left: 1px solid var(--border); background: var(--bg-secondary); }
  .quick-amounts { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .quick-amounts button { flex: 1; padding: 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
  .quick-amounts button:hover { background: var(--border); color: var(--text-primary); }

  .quote-details { background: var(--bg-tertiary); border-radius: var(--radius-sm); padding: 1rem; }
  .quote-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.875rem; color: var(--text-secondary); }
  .quote-value { font-weight: 500; font-family: 'JetBrains Mono', monospace; color: var(--text-primary); }
  .high-impact { color: var(--warning) !important; }

  .btn-trade { width: 100%; padding: 1rem; font-size: 1rem; font-weight: 600; border: none; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .btn-trade.buy { background: var(--success); color: white; }
  .btn-trade.buy:hover:not(:disabled) { background: #059669; }
  .btn-trade.sell { background: var(--error); color: white; }
  .btn-trade.sell:hover:not(:disabled) { background: #dc2626; }
  .btn-trade:disabled { opacity: 0.5; cursor: not-allowed; }
  .spinner-sm { width: 16px; height: 16px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; }

  .graduation-progress { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem; }
  .progress-percent { font-weight: 600; color: var(--accent); }
  .progress-bar { height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--gradient-1); border-radius: 4px; transition: width 0.3s ease; }
  .progress-text { margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-align: center; }
  .graduated-badge { margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--success); font-weight: 600; }
  .badge-icon { font-size: 1.25rem; }

  @media (max-width: 1024px) { .token-page { grid-template-columns: 1fr; } .trade-panel.sticky { position: static; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .token-header { flex-direction: column; align-items: flex-start; } .header-right { text-align: left; } .stats-grid { grid-template-columns: 1fr; } .content-tabs { overflow-x: auto; } }
</style>
