<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface ChartData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }

  interface Props {
    data?: ChartData[];
    height?: number;
    symbol?: string;
    tokenSymbol?: string;
    showVolume?: boolean;
  }

  let { data = [], height = 300, symbol = 'TOKEN', tokenSymbol, showVolume = true }: Props = $props();
  
  // Use tokenSymbol if provided, otherwise fall back to symbol
  const displaySymbol = tokenSymbol || symbol;

  let chartContainer: HTMLDivElement;
  let chart: any = null;
  let candleSeries: any = null;
  let volumeSeries: any = null;

  // Generate mock data if no data provided
  function generateMockData(days: number = 30): ChartData[] {
    const data: ChartData[] = [];
    const now = Date.now();
    let price = 0.00001 + Math.random() * 0.00005;
    
    for (let i = days; i >= 0; i--) {
      const time = Math.floor((now - i * 24 * 60 * 60 * 1000) / 1000);
      const volatility = 0.1 + Math.random() * 0.2;
      const change = (Math.random() - 0.48) * volatility; // Slight upward bias
      
      const open = price;
      price = price * (1 + change);
      const close = price;
      const high = Math.max(open, close) * (1 + Math.random() * 0.05);
      const low = Math.min(open, close) * (1 - Math.random() * 0.05);
      const volume = Math.random() * 100000 + 10000;
      
      data.push({ time, open, high, low, close, volume });
    }
    
    // Add more recent intraday data
    for (let i = 23; i >= 0; i--) {
      const time = Math.floor((now - i * 60 * 60 * 1000) / 1000);
      const volatility = 0.05 + Math.random() * 0.1;
      const change = (Math.random() - 0.48) * volatility;
      
      const open = price;
      price = price * (1 + change);
      const close = price;
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = Math.random() * 50000 + 5000;
      
      data.push({ time, open, high, low, close, volume });
    }
    
    return data;
  }

  async function initChart() {
    if (!browser || !chartContainer) return;

    // Dynamically import lightweight-charts
    const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

    // Create chart
    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(139, 92, 246, 0.5)',
          labelBackgroundColor: '#8b5cf6',
        },
        horzLine: {
          color: 'rgba(139, 92, 246, 0.5)',
          labelBackgroundColor: '#8b5cf6',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    // Add candlestick series
    candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Add volume series if enabled
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        color: '#8b5cf6',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    // Use provided data or generate mock
    const chartData = data.length > 0 ? data : generateMockData();
    
    // Set candlestick data
    candleSeries.setData(chartData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    })));

    // Set volume data if enabled
    if (showVolume && volumeSeries) {
      volumeSeries.setData(chartData.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      })));
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chart && chartContainer) {
        chart.applyOptions({ width: chartContainer.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
  }

  onMount(() => {
    initChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.remove();
      chart = null;
    }
  });

  // Update data when props change
  $effect(() => {
    if (candleSeries && data.length > 0) {
      candleSeries.setData(data.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
      if (volumeSeries) {
        volumeSeries.setData(data.map(d => ({
          time: d.time,
          value: d.volume || 0,
          color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        })));
      }
    }
  });
</script>

<div class="chart-wrapper">
  <div class="chart-header">
    <span class="chart-title">{symbol}/MATIC</span>
    <div class="chart-timeframes">
      <button class="timeframe active">1H</button>
      <button class="timeframe">1D</button>
      <button class="timeframe">1W</button>
      <button class="timeframe">1M</button>
      <button class="timeframe">All</button>
    </div>
  </div>
  <div class="chart-container" bind:this={chartContainer}></div>
</div>

<style>
  .chart-wrapper {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .chart-title {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .chart-timeframes {
    display: flex;
    gap: 0.25rem;
  }

  .timeframe {
    padding: 0.25rem 0.625rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timeframe:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .timeframe.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .chart-container {
    width: 100%;
    min-height: 300px;
  }
</style>
