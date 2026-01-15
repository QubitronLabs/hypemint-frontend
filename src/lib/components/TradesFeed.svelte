<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Activity, ExternalLink } from 'lucide-svelte';

  interface Trade {
    id: string;
    type: 'buy' | 'sell';
    userAddress: string;
    amount: string;
    price: string;
    totalMatic: string;
    timestamp: string;
    txHash?: string;
  }

  interface Props {
    tokenId?: string;
    symbol?: string;
    tokenSymbol?: string;
    trades?: Trade[];
  }

  let { tokenId = '', symbol = 'TOKEN', tokenSymbol, trades: initialTrades = [] }: Props = $props();
  
  const displaySymbol = tokenSymbol || symbol;

  let trades = $state<Trade[]>([...initialTrades]);
  let autoRefresh = $state(true);
  let refreshInterval: ReturnType<typeof setInterval>;

  // Mock trades for demo
  if (trades.length === 0) {
    const mockAddresses = [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
      '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      '0x1234567890abcdef1234567890abcdef12345678',
    ];

    for (let i = 0; i < 20; i++) {
      const isBuy = Math.random() > 0.4;
      const amount = (Math.random() * 100000 + 1000).toFixed(2);
      const price = (0.00001 + Math.random() * 0.00005).toFixed(8);
      const totalMatic = (parseFloat(amount) * parseFloat(price)).toFixed(4);
      
      trades.push({
        id: String(i),
        type: isBuy ? 'buy' : 'sell',
        userAddress: mockAddresses[Math.floor(Math.random() * mockAddresses.length)],
        amount,
        price,
        totalMatic,
        timestamp: new Date(Date.now() - i * 60000 * (1 + Math.random() * 5)).toISOString(),
        txHash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      });
    }
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatNumber(num: number | string): string {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(2);
  }

  // Simulate new trades coming in
  function simulateNewTrade() {
    if (!autoRefresh) return;
    
    const mockAddresses = [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
      '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    ];
    
    const isBuy = Math.random() > 0.4;
    const amount = (Math.random() * 50000 + 500).toFixed(2);
    const price = (0.00001 + Math.random() * 0.00005).toFixed(8);
    const totalMatic = (parseFloat(amount) * parseFloat(price)).toFixed(4);
    
    const newTrade: Trade = {
      id: String(Date.now()),
      type: isBuy ? 'buy' : 'sell',
      userAddress: mockAddresses[Math.floor(Math.random() * mockAddresses.length)],
      amount,
      price,
      totalMatic,
      timestamp: new Date().toISOString(),
    };
    
    trades = [newTrade, ...trades.slice(0, 49)];
  }

  onMount(() => {
    // Simulate live trades every 5-15 seconds
    refreshInterval = setInterval(() => {
      if (Math.random() > 0.5) {
        simulateNewTrade();
      }
    }, 5000 + Math.random() * 10000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="trades-feed">
  <div class="feed-header">
    <h3><Activity size={18} /> Live Trades</h3>
    <div class="header-actions">
      <label class="auto-refresh">
        <input type="checkbox" bind:checked={autoRefresh} />
        <span class="toggle"></span>
        <span class="label">Live</span>
      </label>
    </div>
  </div>

  <div class="trades-table">
    <div class="table-header">
      <span class="col-type">Type</span>
      <span class="col-amount">Amount</span>
      <span class="col-price">Price</span>
      <span class="col-total">Total</span>
      <span class="col-trader">Trader</span>
      <span class="col-time">Time</span>
    </div>

    <div class="table-body">
      {#each trades as trade (trade.id)}
        <div class="trade-row" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
          <span class="col-type">
            <span class="type-badge" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
              <span class="type-dot"></span>
            </span>
          </span>
          <span class="col-amount">{formatNumber(trade.amount)} {symbol}</span>
          <span class="col-price">${trade.price}</span>
          <span class="col-total">{trade.totalMatic} MATIC</span>
          <span class="col-trader">
            {#if trade.txHash}
              <a href="https://polygonscan.com/tx/{trade.txHash}" target="_blank" rel="noopener">
                {shortenAddress(trade.userAddress)}
              </a>
            {:else}
              {shortenAddress(trade.userAddress)}
            {/if}
          </span>
          <span class="col-time">{formatTimeAgo(trade.timestamp)}</span>
        </div>
      {:else}
        <div class="no-trades">
          <p>No trades yet</p>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .trades-feed {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .feed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .feed-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .auto-refresh {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .auto-refresh input {
    display: none;
  }

  .auto-refresh .toggle {
    width: 36px;
    height: 20px;
    background: var(--bg-tertiary);
    border-radius: 10px;
    position: relative;
    transition: background 0.2s;
  }

  .auto-refresh .toggle::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    background: var(--text-muted);
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: all 0.2s;
  }

  .auto-refresh input:checked + .toggle {
    background: var(--accent);
  }

  .auto-refresh input:checked + .toggle::after {
    transform: translateX(16px);
    background: white;
  }

  .auto-refresh .label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .trades-table {
    overflow-x: auto;
  }

  .table-header {
    display: grid;
    grid-template-columns: 50px 1fr 100px 100px 120px 60px;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .table-body {
    max-height: 400px;
    overflow-y: auto;
  }

  .trade-row {
    display: grid;
    grid-template-columns: 50px 1fr 100px 100px 120px 60px;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .trade-row:hover {
    background: var(--bg-tertiary);
  }

  .trade-row.buy {
    border-left: 2px solid #22c55e;
  }

  .trade-row.sell {
    border-left: 2px solid #ef4444;
  }

  .type-badge {
    font-size: 0.625rem;
  }

  .type-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
  }

  .type-badge.sell .type-dot {
    background: #ef4444;
  }

  .col-amount {
    font-weight: 500;
  }

  .col-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }

  .col-total {
    font-weight: 500;
  }

  .col-trader a {
    color: var(--accent);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }

  .col-trader a:hover {
    text-decoration: underline;
  }

  .col-time {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .no-trades {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  @media (max-width: 768px) {
    .table-header,
    .trade-row {
      grid-template-columns: 40px 1fr 80px 70px;
    }

    .col-trader,
    .col-time {
      display: none;
    }
  }
</style>
