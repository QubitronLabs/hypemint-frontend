"use client";

import { useEffect, useRef, useState } from "react";
import {
	createChart,
	ColorType,
	IChartApi,
	ISeriesApi,
	CandlestickSeries,
	HistogramSeries,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { useTokenPriceUpdates } from "@/hooks/useWebSocket";

interface PriceChartProps {
	tokenId: string;
	className?: string;
}

type TimeRange = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";

interface CandleData {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

/**
 * PriceChart - Real-time animated price chart
 */
export function PriceChart({ tokenId, className }: PriceChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
	const [timeRange, setTimeRange] = useState<TimeRange>("1h");
	const [isLoading, setIsLoading] = useState(true);

	// Listen for real-time updates
	useTokenPriceUpdates(tokenId, (update) => {
		if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

		// Backend now sends price as decimal number (already divided by 1e18)
		const price = parseFloat(update.price);
		if (isNaN(price) || !isFinite(price)) return;

		const currentTime = Math.floor(Date.now() / 1000) as unknown as any;

		// Update the last candle with new price data
		const currentData = {
			time: currentTime,
			open: price,
			high: price,
			low: price,
			close: price,
		};

		candleSeriesRef.current.update(currentData);
	});

	// Initialize chart
	useEffect(() => {
		if (!containerRef.current) return;

		const chart = createChart(containerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: "#888888",
			},
			grid: {
				vertLines: { color: "#222222" },
				horzLines: { color: "#222222" },
			},
			crosshair: {
				mode: 1,
				vertLine: {
					color: "#00ff88",
					width: 1,
					style: 2,
					labelBackgroundColor: "#00ff88",
				},
				horzLine: {
					color: "#00ff88",
					width: 1,
					style: 2,
					labelBackgroundColor: "#00ff88",
				},
			},
			rightPriceScale: {
				borderColor: "#222222",
				scaleMargins: { top: 0.1, bottom: 0.2 },
			},
			timeScale: {
				borderColor: "#222222",
				timeVisible: true,
				secondsVisible: false,
			},
		});

		const candleSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#00ff88",
			downColor: "#ff4444",
			borderUpColor: "#00ff88",
			borderDownColor: "#ff4444",
			wickUpColor: "#00ff88",
			wickDownColor: "#ff4444",
		});

		const volumeSeries = chart.addSeries(HistogramSeries, {
			priceFormat: { type: "volume" },
			priceScaleId: "",
		});

		volumeSeries.priceScale().applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
		});

		chartRef.current = chart;
		candleSeriesRef.current = candleSeries;
		volumeSeriesRef.current = volumeSeries;

		const handleResize = () => {
			if (containerRef.current) {
				chart.applyOptions({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight,
				});
			}
		};

		window.addEventListener("resize", handleResize);
		handleResize();

		return () => {
			window.removeEventListener("resize", handleResize);
			chart.remove();
		};
	}, []);

	// Load real data from API
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			try {
				// Determine API interval based on UI selection
				const intervalMap: Record<string, string> = {
					"1m": "1m",
					"5m": "5m",
					"15m": "15m",
					"1h": "1h",
					"4h": "4h",
					"1D": "1d",
				};
				const apiInterval = intervalMap[timeRange] || "1h";

				const res = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/charts/${tokenId}?interval=${apiInterval}&limit=500`,
				);
				const response = await res.json();

				const chartData = response.data || [];

				if (chartData.length === 0) {
					// If no data, maybe show just the current price line or empty
					// For now, let's just initialize with empty
					console.log("No historical data found");
				}

				if (candleSeriesRef.current && volumeSeriesRef.current) {
					// Backend now returns properly formatted decimal values
					const data = chartData.map((d: any) => ({
						time: d.time as unknown as any,
						open: d.open,
						high: d.high,
						low: d.low,
						close: d.close,
					}));
					candleSeriesRef.current.setData(data);

					const volData = chartData.map((d: any) => ({
						time: d.time as unknown as any,
						value: d.volume,
						color:
							d.close >= d.open
								? "rgba(0, 255, 136, 0.3)"
								: "rgba(255, 68, 68, 0.3)",
					}));
					volumeSeriesRef.current.setData(volData);
				}
			} catch (error) {
				console.error("Failed to load chart:", error);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
	}, [tokenId, timeRange]);

	const timeRanges: TimeRange[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

	return (
		<div
			className={cn(
				"bg-card border border-border rounded-xl overflow-hidden",
				className,
			)}
		>
			<div className="flex items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 border-b border-border bg-muted/30 overflow-x-auto scrollbar-hide">
				{timeRanges.map((range) => (
					<button
						key={range}
						onClick={() => setTimeRange(range)}
						className={cn(
							"px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors whitespace-nowrap",
							timeRange === range
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-muted",
						)}
					>
						{range}
					</button>
				))}
			</div>

			<div className="relative h-[280px] sm:h-[350px] md:h-[400px]">
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
						<div className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
					</div>
				)}
				<div ref={containerRef} className="w-full h-full" />
			</div>
		</div>
	);
}
