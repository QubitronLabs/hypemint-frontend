<script lang="ts">
  import { isAuthenticated } from '$lib/stores'
  import { toasts } from '$lib/stores/toast'
  import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-svelte'

  interface Trade {
    id: string
    type: 'buy' | 'sell'
    tokenId: string
    tokenName: string
    tokenSymbol: string
    tokenAmount: number
    ethAmount: number
    status: 'pending' | 'completed' | 'failed'
    createdAt: string
  }

  let trades: Trade[] = $state([])
  let loading = $state(true)

  $effect(() => {
    loadTrades()
  })

  async function loadTrades() {
    loading = true
    try {
      // Mock data
      trades = [
        { id: '1', type: 'buy', tokenId: '1', tokenName: 'Pepe Token', tokenSymbol: 'PEPE', tokenAmount: 50000, ethAmount: 0.05, status: 'completed', createdAt: '2026-01-15T10:30:00Z' },
        { id: '2', type: 'sell', tokenId: '2', tokenName: 'Doge Coin', tokenSymbol: 'DOGE', tokenAmount: 25000, ethAmount: 0.025, status: 'completed', createdAt: '2026-01-14T15:45:00Z' },
        { id: '3', type: 'buy', tokenId: '3', tokenName: 'Shiba Inu', tokenSymbol: 'SHIB', tokenAmount: 100000, ethAmount: 0.08, status: 'pending', createdAt: '2026-01-15T12:00:00Z' }
      ]
    } finally {
      loading = false
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
</script>

<svelte:head>
  <title>Trades | HypeMint</title>
</svelte:head>

<div class="container">
  <div class="page-header">
    <h1>Trade History</h1>
    <p class="subtitle">View your recent trading activity</p>
  </div>

  {#if !$isAuthenticated}
    <div class="empty-state card">
      <h3>Connect Wallet</h3>
      <p>Please connect your wallet to view trades</p>
    </div>
  {:else if loading}
    <div class="loading-container">
      <div class="loader"></div>
    </div>
  {:else if trades.length === 0}
    <div class="empty-state card">
      <h3>No trades yet</h3>
      <p>Start trading to see your history here</p>
      <a href="/tokens" class="btn btn-primary">Browse Tokens</a>
    </div>
  {:else}
    <div class="trades-table-wrapper card">
      <table class="trades-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Token</th>
            <th>Amount</th>
            <th>Value (ETH)</th>
            <th>Status</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {#each trades as trade}
            <tr>
              <td>
                <span class="trade-type" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
                  <span class="type-dot"></span>
                  {trade.type === 'buy' ? 'Buy' : 'Sell'}
                </span>
              </td>
              <td>
                <a href="/tokens/{trade.tokenId}" class="token-link">
                  <span class="token-symbol">${trade.tokenSymbol}</span>
                  <span class="token-name">{trade.tokenName}</span>
                </a>
              </td>
              <td class="mono">{formatNumber(trade.tokenAmount)}</td>
              <td class="mono">{trade.ethAmount.toFixed(4)}</td>
              <td>
                <span class="badge badge-{trade.status}">
                  {trade.status}
                </span>
              </td>
              <td class="text-secondary">{formatDate(trade.createdAt)}</td>
              <td>
                <a href="/tokens/{trade.tokenId}" class="btn btn-secondary btn-sm">View</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .page-header { padding: 2rem 0; }
  .page-header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .subtitle { color: var(--text-secondary); }

  .trades-table-wrapper { overflow-x: auto; padding: 0; }

  .trades-table {
    width: 100%;
    border-collapse: collapse;
  }

  .trades-table th,
  .trades-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .trades-table th {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 500;
  }

  .trades-table tbody tr:hover {
    background: var(--bg-tertiary);
  }

  .trade-type { 
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

  .token-link {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    color: inherit;
    text-decoration: none;
  }

  .token-link:hover .token-symbol { color: var(--accent); }
  .token-symbol { font-weight: 600; }
  .token-name { font-size: 0.75rem; color: var(--text-muted); }

  .badge-pending { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
  .badge-completed { background: rgba(34, 197, 94, 0.15); color: var(--success); }
  .badge-failed { background: rgba(239, 68, 68, 0.15); color: var(--error); }

  .empty-state { text-align: center; padding: 3rem; }
  .empty-state h3 { margin-bottom: 0.5rem; }
  .empty-state p { color: var(--text-secondary); margin-bottom: 1rem; }
</style>
