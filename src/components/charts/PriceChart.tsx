'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineSeries, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { cn } from '@/lib/utils';

interface PriceChartProps {
    tokenId: string;
    className?: string;
}

type TimeRange = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * PriceChart - TradingView-style price chart using lightweight-charts
 * 
 * Features:
 * - Candlestick chart with volume overlay
 * - Time range selector
 * - Real-time updates
 * - Responsive sizing
 */
export function PriceChart({ tokenId, className }: PriceChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('1h');
    const [isLoading, setIsLoading] = useState(true);

    // Initialize chart
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#888888',
            },
            grid: {
                vertLines: { color: '#222222' },
                horzLines: { color: '#222222' },
            },
            crosshair: {
                mode: 1, // Normal mode
                vertLine: {
                    color: '#00ff88',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#00ff88',
                },
                horzLine: {
                    color: '#00ff88',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#00ff88',
                },
            },
            rightPriceScale: {
                borderColor: '#222222',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
            },
            timeScale: {
                borderColor: '#222222',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
        });

        // Add candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00ff88',
            downColor: '#ff4444',
            borderUpColor: '#00ff88',
            borderDownColor: '#ff4444',
            wickUpColor: '#00ff88',
            wickDownColor: '#ff4444',
        });

        // Add volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        // Handle resize
        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // Load and update data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);

            try {
                // Generate mock data for demo (replace with API call)
                const now = Math.floor(Date.now() / 1000);
                const mockData: CandleData[] = [];
                let price = 0.00001 + Math.random() * 0.0001;

                const intervals: Record<TimeRange, number> = {
                    '1m': 60,
                    '5m': 300,
                    '15m': 900,
                    '1h': 3600,
                    '4h': 14400,
                    '1D': 86400,
                };

                const interval = intervals[timeRange];
                const count = 100;

                for (let i = count; i >= 0; i--) {
                    const time = now - i * interval;
                    const volatility = 0.05;
                    const open = price;
                    const change = (Math.random() - 0.5) * volatility;
                    price = price * (1 + change);
                    const close = price;
                    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
                    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
                    const volume = Math.random() * 10000;

                    mockData.push({ time, open, high, low, close, volume });
                }

                if (candleSeriesRef.current && volumeSeriesRef.current) {
                    candleSeriesRef.current.setData(
                        mockData.map((d) => ({
                            time: d.time as unknown as any,
                            open: d.open,
                            high: d.high,
                            low: d.low,
                            close: d.close,
                        }))
                    );

                    volumeSeriesRef.current.setData(
                        mockData.map((d) => ({
                            time: d.time as unknown as any,
                            value: d.volume,
                            color: d.close >= d.open ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)',
                        }))
                    );
                }
            } catch (error) {
                console.error('Failed to load chart data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [tokenId, timeRange]);

    const timeRanges: TimeRange[] = ['1m', '5m', '15m', '1h', '4h', '1D'];

    return (
        <div className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
                {timeRanges.map((range) => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={cn(
                            'px-3 py-1 text-xs font-medium rounded transition-colors',
                            timeRange === range
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                    >
                        {range}
                    </button>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                    % log auto
                </span>
            </div>

            {/* Chart Container */}
            <div className="relative" style={{ height: 400 }}>
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
                        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <div ref={containerRef} className="w-full h-full" />
            </div>
        </div>
    );
}
