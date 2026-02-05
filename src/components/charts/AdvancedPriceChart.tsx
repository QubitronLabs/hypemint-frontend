"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTokenPriceUpdates } from "@/hooks/useWebSocket";
import {
	MousePointer2,
	Crosshair,
	TrendingUp,
	Minus,
	Square,
	Plus,
	Maximize2,
	Trash2,
	Loader2,
	MoveVertical,
	Slash,
	Circle,
	Triangle,
	ArrowUpRight,
	Ruler,
	Type,
	GitFork,
	ChevronDown,
	Settings2,
	LineChart,
	Undo2,
	Activity,
	Lock,
	LockOpen,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// Types
// ============================================================================

interface AdvancedPriceChartProps {
	tokenId: string;
	className?: string;
	showToolbar?: boolean;
}

type TimeRange = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";
type DrawingTool =
	| "cursor"
	| "crosshair"
	| "trendline"
	| "ray"
	| "extended"
	| "hline"
	| "vline"
	| "rect"
	| "ellipse"
	| "fibonacci"
	| "pitchfork"
	| "channel"
	| "measure"
	| "text"
	| "lock";

type Indicator = "sma" | "ema" | "bb" | "rsi" | "macd";

interface Candle {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

interface DrawingPoint {
	// Store in data coordinates for sync with chart transformations
	candleIdx: number;
	price: number;
}

interface Drawing {
	id: string;
	type: DrawingTool;
	points: DrawingPoint[];
	color: string;
	text?: string;
	selected?: boolean;
	locked?: boolean;
}

interface IndicatorConfig {
	type: Indicator;
	period: number;
	color: string;
	enabled: boolean;
}

interface ChartState {
	offsetX: number;
	candleWidth: number;
	priceZoomFactor: number; // 1.0 = default, >1.0 = zoomed in (narrower price range), <1.0 = zoomed out (wider price range)
}

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGES: TimeRange[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

const DRAWING_COLORS = [
	"#3b82f6", // blue
	"#22c55e", // green
	"#ef4444", // red
	"#f59e0b", // amber
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#06b6d4", // cyan
	"#ffffff", // white
];

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

const COLORS = {
	bg: "#0f0f0f",
	gridLine: "rgba(255,255,255,0.03)",
	text: "#52525b",
	textLight: "#a1a1aa",
	bullish: "#22c55e",
	bearish: "#ef4444",
	bullishAlpha: "rgba(34,197,94,0.15)",
	bearishAlpha: "rgba(239,68,68,0.15)",
	crosshair: "rgba(255,255,255,0.4)",
	priceLine: "#fbbf24",
	drawing: "#3b82f6",
	sma: "#f59e0b",
	ema: "#8b5cf6",
	bb: "#22d3ee",
};

const MIN_CANDLE_WIDTH = 3;
const MAX_CANDLE_WIDTH = 40;
const DEFAULT_CANDLE_WIDTH = 8;
const PRICE_AXIS_WIDTH = 65;
const TIME_AXIS_HEIGHT = 24;

// ============================================================================
// Utility Functions
// ============================================================================

function formatPrice(price: number): string {
	if (!isFinite(price) || price === 0) return "0.00";
	if (price < 0.0000001) return price.toExponential(2);
	if (price < 0.00001) return price.toFixed(10);
	if (price < 0.001) return price.toFixed(8);
	if (price < 0.1) return price.toFixed(6);
	if (price < 10) return price.toFixed(4);
	if (price < 1000) return price.toFixed(2);
	return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatTime(ts: number, range: TimeRange): string {
	const d = new Date(ts * 1000);
	if (range === "1D") {
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	}
	return d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function formatVol(v: number): string {
	if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
	if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
	if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
	return v.toFixed(0);
}

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

// ============================================================================
// Indicator Calculations
// ============================================================================

function calculateSMA(data: Candle[], period: number): (number | null)[] {
	const result: (number | null)[] = [];
	for (let i = 0; i < data.length; i++) {
		if (i < period - 1) {
			result.push(null);
		} else {
			let sum = 0;
			for (let j = 0; j < period; j++) {
				sum += data[i - j].close;
			}
			result.push(sum / period);
		}
	}
	return result;
}

function calculateEMA(data: Candle[], period: number): (number | null)[] {
	const result: (number | null)[] = [];
	const multiplier = 2 / (period + 1);

	for (let i = 0; i < data.length; i++) {
		if (i < period - 1) {
			result.push(null);
		} else if (i === period - 1) {
			let sum = 0;
			for (let j = 0; j < period; j++) {
				sum += data[i - j].close;
			}
			result.push(sum / period);
		} else {
			const prev = result[i - 1];
			if (prev !== null) {
				result.push((data[i].close - prev) * multiplier + prev);
			} else {
				result.push(null);
			}
		}
	}
	return result;
}

function calculateBollingerBands(
	data: Candle[],
	period: number = 20,
	stdDev: number = 2,
): {
	upper: (number | null)[];
	middle: (number | null)[];
	lower: (number | null)[];
} {
	const middle = calculateSMA(data, period);
	const upper: (number | null)[] = [];
	const lower: (number | null)[] = [];

	for (let i = 0; i < data.length; i++) {
		if (i < period - 1 || middle[i] === null) {
			upper.push(null);
			lower.push(null);
		} else {
			let sumSq = 0;
			for (let j = 0; j < period; j++) {
				const diff = data[i - j].close - middle[i]!;
				sumSq += diff * diff;
			}
			const std = Math.sqrt(sumSq / period);
			upper.push(middle[i]! + stdDev * std);
			lower.push(middle[i]! - stdDev * std);
		}
	}

	return { upper, middle, lower };
}

// ============================================================================
// Component
// ============================================================================

export function AdvancedPriceChart({
	tokenId,
	className,
	showToolbar = true,
}: AdvancedPriceChartProps) {
	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRootRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number>(0);

	// State
	const [candles, setCandles] = useState<Candle[]>([]);
	const [timeRange, setTimeRange] = useState<TimeRange>("1h");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTool, setActiveTool] = useState<DrawingTool>("crosshair");
	const [drawings, setDrawings] = useState<Drawing[]>([]);
	const [drawingColor, setDrawingColor] = useState(DRAWING_COLORS[0]);
	const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
		null,
	);
	const [allDrawingsLocked, setAllDrawingsLocked] = useState(false);
	const [isPanning, setIsPanning] = useState(false);

	// Indicators
	const [indicators, setIndicators] = useState<IndicatorConfig[]>([
		{ type: "sma", period: 20, color: COLORS.sma, enabled: false },
		{ type: "ema", period: 9, color: COLORS.ema, enabled: false },
		{ type: "bb", period: 20, color: COLORS.bb, enabled: false },
	]);

	// Chart state
	const [chartState, setChartState] = useState<ChartState>({
		offsetX: 0,
		candleWidth: DEFAULT_CANDLE_WIDTH,
		priceZoomFactor: 1.0,
	});

	// Interaction state
	const [mousePos, setMousePos] = useState({ x: -1, y: -1 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0, offsetX: 0 });
	const [drawingInProgress, setDrawingInProgress] = useState<Drawing | null>(
		null,
	);
	const [dragThreshold] = useState(5); // pixels to move before it's considered a drag

	// Context menu state
	const [contextMenu, setContextMenu] = useState<{
		visible: boolean;
		x: number;
		y: number;
		price: number;
		candleIdx?: number;
		exactX?: number; // Exact mouse X position relative to the chart
	}>({ visible: false, x: 0, y: 0, price: 0 });
	const [hideMarksOnBar, setHideMarksOnBar] = useState(false);
	const [lockedCursorPosition, setLockedCursorPosition] = useState<{
		candleIdx: number;
		offsetFromCandleCenter: number; // Store exact offset from candle center
	} | null>(null);

	// Dimensions
	const [dims, setDims] = useState({ w: 800, h: 450 });

	// Touch state
	const [touchStart, setTouchStart] = useState<{
		x: number;
		y: number;
		time: number;
	} | null>(null);
	const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(
		null,
	);
	const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

	// ============================================================================
	// Fetch Candles
	// ============================================================================

	useEffect(() => {
		let cancelled = false;

		async function fetchCandles() {
			setIsLoading(true);
			setError(null);

			try {
				const apiUrl =
					process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
				const intervalMap: Record<TimeRange, string> = {
					"1m": "1m",
					"5m": "5m",
					"15m": "15m",
					"1h": "1h",
					"4h": "4h",
					"1D": "1d",
				};

				const res = await fetch(
					`${apiUrl}/api/v1/charts/${tokenId}?interval=${intervalMap[timeRange]}&limit=500`,
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				const json = await res.json();
				if (cancelled) return;

				const rawData = json.data || json.candles || [];
				const processed: Candle[] = [];
				const seen = new Set<number>();

				for (const d of rawData) {
					let time = d.time ?? d.timestamp ?? d.t;
					if (typeof time !== "number") continue;
					if (time > 1e12) time = Math.floor(time / 1000);
					if (seen.has(time)) continue;
					seen.add(time);

					let o = parseFloat(d.open ?? d.o) || 0;
					let h = parseFloat(d.high ?? d.h) || 0;
					let l = parseFloat(d.low ?? d.l) || 0;
					let c = parseFloat(d.close ?? d.c) || 0;
					const v = Math.max(0, parseFloat(d.volume ?? d.v) || 0);

					// Fix zero values
					const validPrice = h || c || o || l;
					if (!validPrice || validPrice <= 0) continue;
					if (o <= 0) o = validPrice;
					if (h <= 0) h = validPrice;
					if (l <= 0) l = validPrice;
					if (c <= 0) c = validPrice;

					// Ensure OHLC consistency
					h = Math.max(o, h, l, c);
					l = Math.min(o, h, l, c);

					processed.push({
						time,
						open: o,
						high: h,
						low: l,
						close: c,
						volume: v,
					});
				}

				processed.sort((a, b) => a.time - b.time);

				if (!cancelled) {
					setCandles(processed);
					setIsLoading(false);

					// Center the chart on initial load, preserve position on timeframe changes
					setChartState((prev) => {
						// If this is the first load (offsetX is still 0), position chart to show most recent candles
						if (prev.offsetX === 0 && processed.length > 0) {
							const spacing = DEFAULT_CANDLE_WIDTH + 2;
							const chartWidth = dims.w - PRICE_AXIS_WIDTH;
							const visibleCandles = Math.floor(
								chartWidth / spacing,
							);

							// Position chart so most recent candles are visible on the right
							// Leave ~15% empty space on the right for future candles
							const rightPadding = Math.floor(
								visibleCandles * 0.15,
							);
							const totalWidth = processed.length * spacing;

							// If all candles fit in view, center them
							if (totalWidth <= chartWidth) {
								const targetOffset =
									(chartWidth - totalWidth) / 2;
								return {
									offsetX: targetOffset,
									candleWidth: DEFAULT_CANDLE_WIDTH,
									priceZoomFactor: 1.0,
								};
							}
							// If more candles than fit in view, show the most recent ones
							// Position = rightmost position - right padding
							const targetOffset =
								chartWidth -
								totalWidth +
								rightPadding * spacing;
							return {
								offsetX: targetOffset,
								candleWidth: DEFAULT_CANDLE_WIDTH,
								priceZoomFactor: prev.priceZoomFactor,
							};
						}
						return prev;
					});
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to load",
					);
					setIsLoading(false);
				}
			}
		}

		fetchCandles();
		return () => {
			cancelled = true;
		};
	}, [tokenId, timeRange, dims.w]);

	// ============================================================================
	// Resize Observer
	// ============================================================================

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setDims({
					w: entry.contentRect.width,
					h: entry.contentRect.height,
				});
			}
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// ============================================================================
	// Calculate Visible Range & Price Bounds
	// ============================================================================

	const getChartMetrics = useCallback(() => {
		const chartWidth = dims.w - PRICE_AXIS_WIDTH;
		const chartHeight = dims.h - TIME_AXIS_HEIGHT;
		const volumeHeight = chartHeight * 0.12;
		const priceHeight = chartHeight - volumeHeight;

		const spacing = chartState.candleWidth + 2;
		const visibleCount = Math.ceil(chartWidth / spacing) + 2;

		// Calculate which candles are visible
		const rawStartIdx = Math.floor(-chartState.offsetX / spacing);
		const startIdx = clamp(rawStartIdx, 0, Math.max(0, candles.length - 1));
		const endIdx = clamp(startIdx + visibleCount, 0, candles.length);

		const visible = candles.slice(startIdx, endIdx);

		// Price range from visible candles
		let pMin = Infinity,
			pMax = -Infinity,
			vMax = 0;
		for (const c of visible) {
			if (c.low < pMin) pMin = c.low;
			if (c.high > pMax) pMax = c.high;
			if (c.volume > vMax) vMax = c.volume;
		}

		if (!isFinite(pMin)) pMin = 0;
		if (!isFinite(pMax)) pMax = 1;
		if (pMin === pMax) {
			pMin *= 0.99;
			pMax *= 1.01;
		}

		const padding = (pMax - pMin) * 0.08;
		pMin -= padding;
		pMax += padding;

		// Apply price zoom factor
		// Higher factor = zoomed in (narrower range), lower = zoomed out (wider range)
		if (chartState.priceZoomFactor !== 1.0) {
			const center = (pMin + pMax) / 2;
			const range = (pMax - pMin) / chartState.priceZoomFactor;
			pMin = center - range / 2;
			pMax = center + range / 2;
		}

		return {
			chartWidth,
			chartHeight,
			priceHeight,
			volumeHeight,
			spacing,
			startIdx,
			endIdx,
			visible,
			priceMin: pMin,
			priceMax: pMax,
			volumeMax: vMax || 1,
		};
	}, [dims, chartState, candles]);

	// ============================================================================
	// Coordinate Helpers
	// ============================================================================

	const getCandleX = useCallback(
		(index: number) => {
			const spacing = chartState.candleWidth + 2;
			return index * spacing + chartState.offsetX + spacing / 2;
		},
		[chartState],
	);

	const getPriceY = useCallback(
		(
			price: number,
			priceMin: number,
			priceMax: number,
			priceHeight: number,
		) => {
			const range = priceMax - priceMin || 1;
			return priceHeight - ((price - priceMin) / range) * priceHeight;
		},
		[],
	);

	const getIndexAtX = useCallback(
		(x: number) => {
			const spacing = chartState.candleWidth + 2;
			return Math.floor((x - chartState.offsetX) / spacing);
		},
		[chartState],
	);

	const getPriceAtY = useCallback(
		(
			y: number,
			priceMin: number,
			priceMax: number,
			priceHeight: number,
		) => {
			const range = priceMax - priceMin || 1;
			return priceMax - (y / priceHeight) * range;
		},
		[],
	);

	// ============================================================================
	// Render
	// ============================================================================

	const render = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = dims.w * dpr;
		canvas.height = dims.h * dpr;
		ctx.scale(dpr, dpr);

		const metrics = getChartMetrics();
		const {
			chartWidth,
			chartHeight,
			priceHeight,
			volumeHeight,
			startIdx,
			endIdx,
			priceMin,
			priceMax,
			volumeMax,
		} = metrics;
		const priceRange = priceMax - priceMin;

		// Background
		ctx.fillStyle = COLORS.bg;
		ctx.fillRect(0, 0, dims.w, dims.h);

		if (candles.length === 0) {
			ctx.fillStyle = COLORS.text;
			ctx.font = "13px -apple-system, system-ui, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(
				isLoading ? "Loading..." : "No data",
				dims.w / 2,
				dims.h / 2,
			);
			return;
		}

		// Clip to chart area
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, chartWidth, chartHeight);
		ctx.clip();

		// Grid - horizontal
		ctx.strokeStyle = COLORS.gridLine;
		ctx.lineWidth = 1;
		const priceSteps = 6;
		for (let i = 0; i <= priceSteps; i++) {
			const y = Math.floor((priceHeight / priceSteps) * i) + 0.5;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(chartWidth, y);
			ctx.stroke();
		}

		// Grid - vertical (time)
		// Calculate minimum pixel distance between grid lines to prevent clutter
		const gridSpacing = chartState.candleWidth + 2;
		const minGridSpacing = 60; // Minimum 60px between grid lines
		const minGridStep = Math.max(
			1,
			Math.ceil(minGridSpacing / gridSpacing),
		);
		const gridTimeStep = Math.max(
			minGridStep,
			Math.floor((endIdx - startIdx) / 8),
		);

		// Extend grid beyond visible candles to fill the entire width
		const maxGridIdx = Math.ceil(chartWidth / gridSpacing);
		const extendedGridEndIdx = Math.max(endIdx, startIdx + maxGridIdx);

		for (let i = startIdx; i < extendedGridEndIdx; i += gridTimeStep) {
			const x = Math.floor(getCandleX(i)) + 0.5;
			if (x >= 0 && x <= chartWidth) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, chartHeight);
				ctx.stroke();
			}
		}

		// Volume bars
		for (let i = startIdx; i < endIdx; i++) {
			const c = candles[i];
			const x = getCandleX(i);
			const barH = (c.volume / volumeMax) * volumeHeight;
			const barY = priceHeight + volumeHeight - barH;

			ctx.fillStyle =
				c.close >= c.open ? COLORS.bullishAlpha : COLORS.bearishAlpha;
			ctx.fillRect(
				x - chartState.candleWidth / 2,
				barY,
				chartState.candleWidth,
				barH,
			);
		}

		// Candles
		for (let i = startIdx; i < endIdx; i++) {
			const c = candles[i];
			const x = getCandleX(i);
			const bullish = c.close >= c.open;
			const color = bullish ? COLORS.bullish : COLORS.bearish;

			const oY = getPriceY(c.open, priceMin, priceMax, priceHeight);
			const cY = getPriceY(c.close, priceMin, priceMax, priceHeight);
			const hY = getPriceY(c.high, priceMin, priceMax, priceHeight);
			const lY = getPriceY(c.low, priceMin, priceMax, priceHeight);

			// Wick
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, hY);
			ctx.lineTo(x, lY);
			ctx.stroke();

			// Body
			const bodyTop = Math.min(oY, cY);
			const bodyH = Math.max(1, Math.abs(cY - oY));

			ctx.fillStyle = color;
			ctx.fillRect(
				x - chartState.candleWidth / 2,
				bodyTop,
				chartState.candleWidth,
				bodyH,
			);
		}

		// Current price line
		if (candles.length > 0) {
			const last = candles[candles.length - 1];
			const y = getPriceY(last.close, priceMin, priceMax, priceHeight);
			const color =
				last.close >= last.open ? COLORS.bullish : COLORS.bearish;

			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(chartWidth, y);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// ========== INDICATORS ==========
		for (const ind of indicators) {
			if (!ind.enabled) continue;

			ctx.strokeStyle = ind.color;
			ctx.lineWidth = 1.5;

			if (ind.type === "sma") {
				const smaData = calculateSMA(candles, ind.period);
				ctx.beginPath();
				let started = false;
				for (let i = startIdx; i < endIdx; i++) {
					const val = smaData[i];
					if (val === null) continue;
					const x = getCandleX(i);
					const y = getPriceY(val, priceMin, priceMax, priceHeight);
					if (!started) {
						ctx.moveTo(x, y);
						started = true;
					} else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}

			if (ind.type === "ema") {
				const emaData = calculateEMA(candles, ind.period);
				ctx.beginPath();
				let started = false;
				for (let i = startIdx; i < endIdx; i++) {
					const val = emaData[i];
					if (val === null) continue;
					const x = getCandleX(i);
					const y = getPriceY(val, priceMin, priceMax, priceHeight);
					if (!started) {
						ctx.moveTo(x, y);
						started = true;
					} else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}

			if (ind.type === "bb") {
				const bb = calculateBollingerBands(candles, ind.period);
				// Upper
				ctx.beginPath();
				let started = false;
				for (let i = startIdx; i < endIdx; i++) {
					const val = bb.upper[i];
					if (val === null) continue;
					const x = getCandleX(i);
					const y = getPriceY(val, priceMin, priceMax, priceHeight);
					if (!started) {
						ctx.moveTo(x, y);
						started = true;
					} else ctx.lineTo(x, y);
				}
				ctx.stroke();
				// Lower
				ctx.beginPath();
				started = false;
				for (let i = startIdx; i < endIdx; i++) {
					const val = bb.lower[i];
					if (val === null) continue;
					const x = getCandleX(i);
					const y = getPriceY(val, priceMin, priceMax, priceHeight);
					if (!started) {
						ctx.moveTo(x, y);
						started = true;
					} else ctx.lineTo(x, y);
				}
				ctx.stroke();
				// Middle (dashed)
				ctx.setLineDash([3, 3]);
				ctx.beginPath();
				started = false;
				for (let i = startIdx; i < endIdx; i++) {
					const val = bb.middle[i];
					if (val === null) continue;
					const x = getCandleX(i);
					const y = getPriceY(val, priceMin, priceMax, priceHeight);
					if (!started) {
						ctx.moveTo(x, y);
						started = true;
					} else ctx.lineTo(x, y);
				}
				ctx.stroke();
				ctx.setLineDash([]);
			}
		}

		// ========== DRAWINGS ==========
		if (!hideMarksOnBar) {
			for (const d of drawings) {
				const isSelected = d.id === selectedDrawingId;
				ctx.strokeStyle = d.color;
				ctx.lineWidth = isSelected ? 3 : 2;

				// Helper to convert drawing point to screen coordinates
				const toScreen = (point: DrawingPoint) => ({
					x: getCandleX(point.candleIdx),
					y: getPriceY(point.price, priceMin, priceMax, priceHeight),
				});

				if (d.type === "hline" && d.points[0]) {
					const y = getPriceY(
						d.points[0].price,
						priceMin,
						priceMax,
						priceHeight,
					);
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(chartWidth, y);
					ctx.stroke();
					ctx.fillStyle = d.color;
					ctx.font = "10px -apple-system, system-ui, sans-serif";
					ctx.textAlign = "left";
					ctx.fillText(formatPrice(d.points[0].price), 5, y - 5);
				} else if (d.type === "vline" && d.points[0]) {
					const x = getCandleX(d.points[0].candleIdx);
					ctx.beginPath();
					ctx.moveTo(x, 0);
					ctx.lineTo(x, chartHeight);
					ctx.stroke();
				} else if (d.type === "trendline" && d.points.length === 2) {
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					ctx.beginPath();
					ctx.moveTo(p0.x, p0.y);
					ctx.lineTo(p1.x, p1.y);
					ctx.stroke();
					// Draw handles if selected
					if (isSelected) {
						ctx.fillStyle = d.color;
						ctx.beginPath();
						ctx.arc(p0.x, p0.y, 5, 0, Math.PI * 2);
						ctx.fill();
						ctx.beginPath();
						ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
						ctx.fill();
					}
				} else if (d.type === "ray" && d.points.length === 2) {
					// Ray extends infinitely in one direction
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const dx = p1.x - p0.x;
					const dy = p1.y - p0.y;
					const len = Math.sqrt(dx * dx + dy * dy);
					const ex = p0.x + (dx / len) * chartWidth * 2;
					const ey = p0.y + (dy / len) * chartWidth * 2;
					ctx.beginPath();
					ctx.moveTo(p0.x, p0.y);
					ctx.lineTo(ex, ey);
					ctx.stroke();
				} else if (d.type === "extended" && d.points.length === 2) {
					// Extended line (infinite both directions)
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const dx = p1.x - p0.x;
					const dy = p1.y - p0.y;
					const len = Math.sqrt(dx * dx + dy * dy) || 1;
					const ex1 = p0.x - (dx / len) * chartWidth * 2;
					const ey1 = p0.y - (dy / len) * chartWidth * 2;
					const ex2 = p0.x + (dx / len) * chartWidth * 2;
					const ey2 = p0.y + (dy / len) * chartWidth * 2;
					ctx.beginPath();
					ctx.moveTo(ex1, ey1);
					ctx.lineTo(ex2, ey2);
					ctx.stroke();
				} else if (d.type === "rect" && d.points.length === 2) {
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const x1 = Math.min(p0.x, p1.x);
					const y1 = Math.min(p0.y, p1.y);
					const w = Math.abs(p1.x - p0.x);
					const h = Math.abs(p1.y - p0.y);
					ctx.strokeRect(x1, y1, w, h);
					ctx.fillStyle = d.color + "1a";
					ctx.fillRect(x1, y1, w, h);
				} else if (d.type === "ellipse" && d.points.length === 2) {
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const cx = (p0.x + p1.x) / 2;
					const cy = (p0.y + p1.y) / 2;
					const rx = Math.abs(p1.x - p0.x) / 2;
					const ry = Math.abs(p1.y - p0.y) / 2;
					ctx.beginPath();
					ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
					ctx.stroke();
					ctx.fillStyle = d.color + "1a";
					ctx.fill();
				} else if (d.type === "fibonacci" && d.points.length === 2) {
					const price1 = d.points[0].price;
					const price2 = d.points[1].price;
					const priceDiff = price1 - price2;

					ctx.font = "10px -apple-system, system-ui, sans-serif";
					ctx.textAlign = "left";

					for (const level of FIB_LEVELS) {
						const price = price2 + priceDiff * level;
						const y = getPriceY(
							price,
							priceMin,
							priceMax,
							priceHeight,
						);

						ctx.globalAlpha = level === 0 || level === 1 ? 1 : 0.6;
						ctx.beginPath();
						ctx.moveTo(0, y);
						ctx.lineTo(chartWidth, y);
						ctx.stroke();

						ctx.fillStyle = d.color;
						ctx.fillText(
							`${(level * 100).toFixed(1)}% - ${formatPrice(price)}`,
							5,
							y - 3,
						);
					}
					ctx.globalAlpha = 1;

					// Highlight zone
					const y1 = getPriceY(
						price1,
						priceMin,
						priceMax,
						priceHeight,
					);
					const y2 = getPriceY(
						price2,
						priceMin,
						priceMax,
						priceHeight,
					);
					ctx.fillStyle = d.color + "0d";
					ctx.fillRect(
						0,
						Math.min(y1, y2),
						chartWidth,
						Math.abs(y2 - y1),
					);
				} else if (d.type === "pitchfork" && d.points.length === 3) {
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const p2 = toScreen(d.points[2]);

					// Median line (from p0 to midpoint of p1-p2)
					const midX = (p1.x + p2.x) / 2;
					const midY = (p1.y + p2.y) / 2;

					ctx.beginPath();
					ctx.moveTo(p0.x, p0.y);
					const dx = midX - p0.x;
					const dy = midY - p0.y;
					const extX = p0.x + dx * 5;
					const extY = p0.y + dy * 5;
					ctx.lineTo(extX, extY);
					ctx.stroke();

					// Upper and lower prongs
					ctx.setLineDash([4, 4]);
					ctx.beginPath();
					ctx.moveTo(p1.x, p1.y);
					ctx.lineTo(p1.x + dx * 5, p1.y + dy * 5);
					ctx.stroke();

					ctx.beginPath();
					ctx.moveTo(p2.x, p2.y);
					ctx.lineTo(p2.x + dx * 5, p2.y + dy * 5);
					ctx.stroke();
					ctx.setLineDash([]);

					// Draw points
					[p0, p1, p2].forEach((p) => {
						ctx.fillStyle = d.color;
						ctx.beginPath();
						ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
						ctx.fill();
					});
				} else if (d.type === "channel" && d.points.length === 3) {
					const p0 = toScreen(d.points[0]);
					const p1 = toScreen(d.points[1]);
					const p2 = toScreen(d.points[2]);

					// Main line
					const dx = p1.x - p0.x;
					const dy = p1.y - p0.y;
					const len = Math.sqrt(dx * dx + dy * dy) || 1;

					ctx.beginPath();
					ctx.moveTo(
						p0.x - (dx / len) * 500,
						p0.y - (dy / len) * 500,
					);
					ctx.lineTo(
						p1.x + (dx / len) * 500,
						p1.y + (dy / len) * 500,
					);
					ctx.stroke();

					// Parallel line through p2
					const offsetY = p2.y - p0.y;
					ctx.beginPath();
					ctx.moveTo(
						p0.x - (dx / len) * 500,
						p0.y + offsetY - (dy / len) * 500,
					);
					ctx.lineTo(
						p1.x + (dx / len) * 500,
						p1.y + offsetY + (dy / len) * 500,
					);
					ctx.stroke();

					// Fill channel
					ctx.fillStyle = d.color + "1a";
					ctx.beginPath();
					ctx.moveTo(p0.x, p0.y);
					ctx.lineTo(p1.x, p1.y);
					ctx.lineTo(p1.x, p1.y + offsetY);
					ctx.lineTo(p0.x, p0.y + offsetY);
					ctx.closePath();
					ctx.fill();
				} else if (d.type === "measure" && d.points.length === 2) {
					const p1 = toScreen(d.points[0]);
					const p2 = toScreen(d.points[1]);
					const price1 = d.points[0].price;
					const price2 = d.points[1].price;
					const priceDiff = price2 - price1;
					const pctChange = (priceDiff / price1) * 100;

					// Draw rectangle
					ctx.strokeRect(
						Math.min(p1.x, p2.x),
						Math.min(p1.y, p2.y),
						Math.abs(p2.x - p1.x),
						Math.abs(p2.y - p1.y),
					);
					ctx.fillStyle =
						priceDiff >= 0
							? "rgba(34,197,94,0.1)"
							: "rgba(239,68,68,0.1)";
					ctx.fillRect(
						Math.min(p1.x, p2.x),
						Math.min(p1.y, p2.y),
						Math.abs(p2.x - p1.x),
						Math.abs(p2.y - p1.y),
					);

					// Draw info box
					const infoX = Math.max(p1.x, p2.x) + 5;
					const infoY = Math.min(p1.y, p2.y);

					ctx.fillStyle = "rgba(0,0,0,0.9)";
					ctx.fillRect(infoX, infoY, 100, 50);
					ctx.strokeRect(infoX, infoY, 100, 50);

					ctx.fillStyle =
						priceDiff >= 0 ? COLORS.bullish : COLORS.bearish;
					ctx.font = "bold 11px -apple-system, system-ui, sans-serif";
					ctx.textAlign = "left";
					ctx.fillText(
						`${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%`,
						infoX + 8,
						infoY + 18,
					);
					ctx.fillStyle = COLORS.textLight;
					ctx.font = "10px -apple-system, system-ui, sans-serif";
					ctx.fillText(
						`${formatPrice(priceDiff)}`,
						infoX + 8,
						infoY + 35,
					);
				} else if (d.type === "text" && d.points[0] && d.text) {
					const p0 = toScreen(d.points[0]);
					ctx.fillStyle = d.color;
					ctx.font = "12px -apple-system, system-ui, sans-serif";
					ctx.textAlign = "left";
					ctx.fillText(d.text, p0.x, p0.y);
				}
			}
		} // End hide marks on bar check

		// Drawing in progress
		if (drawingInProgress) {
			ctx.strokeStyle = drawingColor;
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);

			// Helper to convert drawing point to screen coordinates
			const toScreen = (point: DrawingPoint) => ({
				x: getCandleX(point.candleIdx),
				y: getPriceY(point.price, priceMin, priceMax, priceHeight),
			});

			const pts = drawingInProgress.points.map(toScreen);
			const mp = { x: mousePos.x, y: mousePos.y };

			if (drawingInProgress.type === "hline" && pts[0]) {
				ctx.beginPath();
				ctx.moveTo(0, pts[0].y);
				ctx.lineTo(chartWidth, pts[0].y);
				ctx.stroke();
			} else if (drawingInProgress.type === "vline" && pts[0]) {
				ctx.beginPath();
				ctx.moveTo(pts[0].x, 0);
				ctx.lineTo(pts[0].x, chartHeight);
				ctx.stroke();
			} else if (
				(drawingInProgress.type === "trendline" ||
					drawingInProgress.type === "ray" ||
					drawingInProgress.type === "extended") &&
				pts.length >= 1
			) {
				const p2 = pts[1] || mp;
				ctx.beginPath();
				ctx.moveTo(pts[0].x, pts[0].y);
				ctx.lineTo(p2.x, p2.y);
				ctx.stroke();
			} else if (
				(drawingInProgress.type === "rect" ||
					drawingInProgress.type === "ellipse" ||
					drawingInProgress.type === "measure") &&
				pts.length >= 1
			) {
				const p2 = pts[1] || mp;
				const x1 = Math.min(pts[0].x, p2.x);
				const y1 = Math.min(pts[0].y, p2.y);
				const w = Math.abs(p2.x - pts[0].x);
				const h = Math.abs(p2.y - pts[0].y);

				if (drawingInProgress.type === "ellipse") {
					ctx.beginPath();
					ctx.ellipse(
						x1 + w / 2,
						y1 + h / 2,
						w / 2,
						h / 2,
						0,
						0,
						Math.PI * 2,
					);
					ctx.stroke();
				} else {
					ctx.strokeRect(x1, y1, w, h);
				}
			} else if (
				drawingInProgress.type === "fibonacci" &&
				pts.length >= 1
			) {
				const p2 = pts[1] || mp;
				ctx.beginPath();
				ctx.moveTo(0, pts[0].y);
				ctx.lineTo(chartWidth, pts[0].y);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(0, p2.y);
				ctx.lineTo(chartWidth, p2.y);
				ctx.stroke();
			} else if (
				drawingInProgress.type === "pitchfork" ||
				drawingInProgress.type === "channel"
			) {
				// Draw existing points
				for (const p of pts) {
					ctx.fillStyle = drawingColor;
					ctx.beginPath();
					ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
					ctx.fill();
				}
				// Draw lines between points
				if (pts.length >= 1) {
					ctx.beginPath();
					ctx.moveTo(pts[0].x, pts[0].y);
					if (pts.length >= 2) {
						ctx.lineTo(pts[1].x, pts[1].y);
					} else {
						ctx.lineTo(mp.x, mp.y);
					}
					ctx.stroke();
				}
				if (pts.length >= 2) {
					ctx.beginPath();
					ctx.moveTo(pts[1].x, pts[1].y);
					ctx.lineTo(mp.x, mp.y);
					ctx.stroke();
				}
			}
			ctx.setLineDash([]);
		}

		ctx.restore();

		// ========== CROSSHAIR ==========
		if (
			mousePos.x >= 0 &&
			mousePos.x < chartWidth &&
			mousePos.y >= 0 &&
			mousePos.y < chartHeight
		) {
			if (activeTool !== "cursor") {
				ctx.strokeStyle = COLORS.crosshair;
				ctx.lineWidth = 1;
				ctx.setLineDash([4, 4]);

				// Only draw vertical line if cursor is not locked
				if (!lockedCursorPosition) {
					ctx.beginPath();
					ctx.moveTo(mousePos.x, 0);
					ctx.lineTo(mousePos.x, chartHeight);
					ctx.stroke();
				}

				// Always draw horizontal line
				ctx.beginPath();
				ctx.moveTo(0, mousePos.y);
				ctx.lineTo(chartWidth, mousePos.y);
				ctx.stroke();
				ctx.setLineDash([]);

				// Crosshair labels
				const crossPrice = getPriceAtY(
					mousePos.y,
					priceMin,
					priceMax,
					priceHeight,
				);

				// Price label on Y-axis
				ctx.fillStyle = COLORS.priceLine;
				ctx.fillRect(chartWidth, mousePos.y - 10, PRICE_AXIS_WIDTH, 20);
				ctx.fillStyle = "#000";
				ctx.font = "10px -apple-system, system-ui, sans-serif";
				ctx.textAlign = "right";
				ctx.fillText(
					formatPrice(crossPrice),
					dims.w - 4,
					mousePos.y + 4,
				);

				// Time label on X-axis (only if cursor is not locked)
				if (!lockedCursorPosition) {
					const idx = getIndexAtX(mousePos.x);
					if (idx >= 0 && idx < candles.length) {
						const c = candles[idx];
						const timeStr = formatTime(c.time, timeRange);
						const labelW = ctx.measureText(timeStr).width + 12;

						ctx.fillStyle = COLORS.priceLine;
						ctx.fillRect(
							mousePos.x - labelW / 2,
							chartHeight,
							labelW,
							TIME_AXIS_HEIGHT,
						);
						ctx.fillStyle = "#000";
						ctx.textAlign = "center";
						ctx.fillText(timeStr, mousePos.x, chartHeight + 15);
					}
				}
			}
		}

		// ========== LOCKED VERTICAL CURSOR ==========
		// Only show locked cursor when mouse is over the chart canvas
		if (lockedCursorPosition && mousePos) {
			const lockedIdx = lockedCursorPosition.candleIdx;
			if (lockedIdx >= 0 && lockedIdx < candles.length) {
				const spacing = chartState.candleWidth + 2;
				const candleCenterX =
					chartState.offsetX +
					lockedIdx * spacing +
					chartState.candleWidth / 2;
				const lockedX =
					candleCenterX + lockedCursorPosition.offsetFromCandleCenter;

				if (lockedX >= 0 && lockedX <= chartWidth) {
					ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // White color for locked cursor
					ctx.lineWidth = 1;
					ctx.setLineDash([5, 5]); // Dotted line

					ctx.beginPath();
					ctx.moveTo(lockedX, 0);
					ctx.lineTo(lockedX, chartHeight);
					ctx.stroke();

					ctx.setLineDash([]); // Reset to solid

					// Time label for locked cursor
					const c = candles[lockedIdx];
					const timeStr = formatTime(c.time, timeRange);
					const labelW = ctx.measureText(timeStr).width + 12;

					ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
					ctx.fillRect(
						lockedX - labelW / 2,
						chartHeight,
						labelW,
						TIME_AXIS_HEIGHT,
					);
					ctx.fillStyle = "#fff";
					ctx.textAlign = "center";
					ctx.font = "10px -apple-system, system-ui, sans-serif";
					ctx.fillText(timeStr, lockedX, chartHeight + 15);
				}
			}
		}

		// ========== PRICE AXIS ==========
		ctx.fillStyle = "rgba(15,15,15,0.95)";
		ctx.fillRect(chartWidth, 0, PRICE_AXIS_WIDTH, dims.h);

		ctx.fillStyle = COLORS.text;
		ctx.font = "10px -apple-system, system-ui, sans-serif";
		ctx.textAlign = "right";

		for (let i = 0; i <= priceSteps; i++) {
			const price = priceMax - (priceRange / priceSteps) * i;
			const y = (priceHeight / priceSteps) * i;
			ctx.fillText(formatPrice(price), dims.w - 4, y + 4);
		}

		// Current price on axis
		if (candles.length > 0) {
			const last = candles[candles.length - 1];
			const y = getPriceY(last.close, priceMin, priceMax, priceHeight);
			const color =
				last.close >= last.open ? COLORS.bullish : COLORS.bearish;

			ctx.fillStyle = color;
			ctx.fillRect(chartWidth, y - 10, PRICE_AXIS_WIDTH, 20);
			ctx.fillStyle = "#000";
			ctx.font = "bold 10px -apple-system, system-ui, sans-serif";
			ctx.fillText(formatPrice(last.close), dims.w - 4, y + 4);
		}

		// ========== TIME AXIS ==========
		ctx.fillStyle = "rgba(15,15,15,0.95)";
		ctx.fillRect(0, chartHeight, dims.w, TIME_AXIS_HEIGHT);

		ctx.fillStyle = COLORS.text;
		// Responsive font size - larger on mobile
		const isMobile = dims.w < 768;
		const fontSize = isMobile ? 11 : 10;
		ctx.font = `${fontSize}px -apple-system, system-ui, sans-serif`;
		ctx.textAlign = "center";

		// Calculate time interval in seconds based on timeRange
		const timeIntervalSeconds: Record<TimeRange, number> = {
			"1m": 60,
			"5m": 300,
			"15m": 900,
			"1h": 3600,
			"4h": 14400,
			"1D": 86400,
		};
		const intervalSec = timeIntervalSeconds[timeRange];

		// Calculate minimum pixel distance between labels to prevent overlap
		const sampleLabel = candles[startIdx]
			? formatTime(candles[startIdx].time, timeRange)
			: "00:00";
		const labelWidth = ctx.measureText(sampleLabel).width;
		// Increase spacing on mobile to prevent overcrowding
		const minLabelSpacing = isMobile ? labelWidth + 30 : labelWidth + 20;

		// Calculate how many candles we need to skip to maintain minimum spacing
		const labelSpacing = chartState.candleWidth + 2;
		const minCandleStep = Math.max(
			1,
			Math.ceil(minLabelSpacing / labelSpacing),
		);

		// Adjust timeStep to ensure labels don't overlap
		const baseTimeStep = Math.max(1, Math.floor((endIdx - startIdx) / 8));
		const timeStep = Math.max(minCandleStep, baseTimeStep);

		// Extend the timeline beyond visible candles
		// Calculate how many extra "virtual" candles to show on the right
		const maxVisibleIdx = Math.ceil(chartWidth / labelSpacing);
		const extendedEndIdx = Math.max(endIdx, startIdx + maxVisibleIdx);

		let lastLabelX = -Infinity; // Track last drawn label position
		for (let i = startIdx; i < extendedEndIdx; i += timeStep) {
			const x = getCandleX(i);

			// Only draw label if it's within visible bounds and far enough from the last label
			if (
				x >= 0 &&
				x <= chartWidth &&
				x - lastLabelX >= minLabelSpacing
			) {
				let timeToDisplay: number;

				// If we have a real candle at this index, use its time
				if (i < candles.length && candles[i]) {
					timeToDisplay = candles[i].time;
				} else {
					// For virtual candles beyond available data, calculate projected time
					const lastCandle = candles[candles.length - 1];
					if (lastCandle) {
						const candlesBeyond = i - (candles.length - 1);
						timeToDisplay =
							lastCandle.time + candlesBeyond * intervalSec;
					} else {
						continue; // Skip if no candles at all
					}
				}

				ctx.fillText(
					formatTime(timeToDisplay, timeRange),
					x,
					chartHeight + 15,
				);
				lastLabelX = x;
			}
		}

		// ========== OHLCV OVERLAY ==========
		const idx = getIndexAtX(mousePos.x);
		if (idx >= 0 && idx < candles.length && mousePos.x >= 0) {
			const c = candles[idx];
			const bullish = c.close >= c.open;

			ctx.font = "11px -apple-system, system-ui, sans-serif";
			ctx.textAlign = "left";

			let tx = 8;
			const ty = 14;

			ctx.fillStyle = COLORS.textLight;
			ctx.fillText("O", tx, ty);
			tx += 12;
			ctx.fillStyle = bullish ? COLORS.bullish : COLORS.bearish;
			ctx.fillText(formatPrice(c.open), tx, ty);
			tx += ctx.measureText(formatPrice(c.open)).width + 10;

			ctx.fillStyle = COLORS.textLight;
			ctx.fillText("H", tx, ty);
			tx += 12;
			ctx.fillStyle = COLORS.bullish;
			ctx.fillText(formatPrice(c.high), tx, ty);
			tx += ctx.measureText(formatPrice(c.high)).width + 10;

			ctx.fillStyle = COLORS.textLight;
			ctx.fillText("L", tx, ty);
			tx += 10;
			ctx.fillStyle = COLORS.bearish;
			ctx.fillText(formatPrice(c.low), tx, ty);
			tx += ctx.measureText(formatPrice(c.low)).width + 10;

			ctx.fillStyle = COLORS.textLight;
			ctx.fillText("C", tx, ty);
			tx += 12;
			ctx.fillStyle = bullish ? COLORS.bullish : COLORS.bearish;
			ctx.fillText(formatPrice(c.close), tx, ty);
			tx += ctx.measureText(formatPrice(c.close)).width + 10;

			ctx.fillStyle = COLORS.textLight;
			ctx.fillText("V", tx, ty);
			tx += 12;
			ctx.fillStyle = COLORS.textLight;
			ctx.fillText(formatVol(c.volume), tx, ty);
		}
	}, [
		dims,
		candles,
		chartState,
		mousePos,
		drawings,
		drawingInProgress,
		activeTool,
		isLoading,
		timeRange,
		indicators,
		selectedDrawingId,
		drawingColor,
		getChartMetrics,
		getCandleX,
		getPriceY,
		getIndexAtX,
		getPriceAtY,
		hideMarksOnBar,
		lockedCursorPosition,
	]);

	// Animation loop
	useEffect(() => {
		const loop = () => {
			render();
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [render]);

	// ============================================================================
	// Mouse Handlers
	// ============================================================================

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			setMousePos({ x, y });

			// Handle panning when dragging
			if (isDragging) {
				const dx = e.clientX - dragStart.x;
				const dy = e.clientY - dragStart.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				// If we've moved past the threshold, start panning
				if (distance > dragThreshold || isPanning) {
					if (!isPanning) {
						setIsPanning(true);
					}
					setChartState((prev) => ({
						...prev,
						offsetX: dragStart.offsetX + dx,
					}));
				}
			}
		},
		[isDragging, isPanning, dragStart, dragThreshold],
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			// Close context menu if it's visible
			if (contextMenu.visible) {
				setContextMenu({ visible: false, x: 0, y: 0, price: 0 });
			}

			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const metrics = getChartMetrics();

			if (x > metrics.chartWidth || y > metrics.chartHeight) return;

			// Start drag for all interactions - we'll determine if it's a pan or draw based on movement
			setIsDragging(true);
			setDragStart({
				x: e.clientX,
				y: e.clientY,
				offsetX: chartState.offsetX,
			});

			// Don't allow drawing when drawings are locked
			if (
				allDrawingsLocked &&
				activeTool !== "crosshair" &&
				activeTool !== "cursor"
			) {
				return;
			}

			// Cursor tool always pans immediately
			if (activeTool === "cursor") {
				setIsPanning(true);
				return;
			}

			// Middle mouse button always pans
			if (e.button === 1) {
				e.preventDefault();
				setIsPanning(true);
				return;
			}

			// Drawing logic has been moved to handleMouseUp for click-to-draw behavior
		},
		[
			activeTool,
			chartState,
			allDrawingsLocked,
			getChartMetrics,
			contextMenu.visible,
		],
	);

	const handleMouseUp = useCallback(
		(e: React.MouseEvent) => {
			const wasPanning = isPanning;
			setIsDragging(false);
			setIsPanning(false);

			// If we were panning, don't process as a drawing action
			if (wasPanning) {
				return;
			}

			// If we didn't pan, process drawing actions
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const metrics = getChartMetrics();
			const candleIdx = getIndexAtX(x);
			const price = getPriceAtY(
				y,
				metrics.priceMin,
				metrics.priceMax,
				metrics.priceHeight,
			);

			if (x > metrics.chartWidth || y > metrics.chartHeight) return;

			// Check if this was a click (not a drag)
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance > dragThreshold) {
				// This was a drag, not a click
				return;
			}

			// This was a click - handle drawing
			const singleClickTools: DrawingTool[] = ["hline", "vline"];
			const twoClickTools: DrawingTool[] = [
				"trendline",
				"ray",
				"extended",
				"rect",
				"ellipse",
				"fibonacci",
				"measure",
			];
			const threeClickTools: DrawingTool[] = ["pitchfork", "channel"];

			if (activeTool === "text") {
				const text = prompt("Enter text:");
				if (text) {
					setDrawings((prev) => [
						...prev,
						{
							id: Date.now().toString(),
							type: "text",
							points: [{ candleIdx, price }],
							color: drawingColor,
							text,
						},
					]);
				}
				return;
			}

			if (singleClickTools.includes(activeTool)) {
				setDrawings((prev) => [
					...prev,
					{
						id: Date.now().toString(),
						type: activeTool as "hline" | "vline",
						points: [{ candleIdx, price }],
						color: drawingColor,
					},
				]);
				return;
			}

			if (twoClickTools.includes(activeTool)) {
				if (!drawingInProgress) {
					setDrawingInProgress({
						id: Date.now().toString(),
						type: activeTool,
						points: [{ candleIdx, price }],
						color: drawingColor,
					});
				} else {
					const completed: Drawing = {
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ candleIdx, price },
						],
					};
				// For measure tool, only keep one measure at a time
				if (completed.type === 'measure') {
					setDrawings((prev) => [...prev.filter(d => d.type !== 'measure'), completed]);
				} else {
					setDrawings((prev) => [...prev, completed]);
				}
					setDrawingInProgress(null);
				}
				return;
			}

			if (threeClickTools.includes(activeTool)) {
				if (!drawingInProgress) {
					setDrawingInProgress({
						id: Date.now().toString(),
						type: activeTool,
						points: [{ candleIdx, price }],
						color: drawingColor,
					});
				} else if (drawingInProgress.points.length < 2) {
					setDrawingInProgress({
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ candleIdx, price },
						],
					});
				} else {
					const completed: Drawing = {
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ candleIdx, price },
						],
					};
					setDrawings((prev) => [...prev, completed]);
					setDrawingInProgress(null);
				}
				return;
			}
		},
		[
			isPanning,
			dragStart,
			dragThreshold,
			activeTool,
			drawingInProgress,
			drawingColor,
			getChartMetrics,
			getPriceAtY,
			getIndexAtX,
		],
	);

	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
		setIsPanning(false);
		setMousePos({ x: -1, y: -1 });
	}, []);

	// ============================================================================
	// Touch Handlers for Mobile
	// ============================================================================

	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const chartWidth = dims.w - PRICE_AXIS_WIDTH;

			// Close context menu on touch
			if (contextMenu.visible) {
				setContextMenu({ visible: false, x: 0, y: 0, price: 0 });
			}

			if (e.touches.length === 1) {
				// Single touch
				const touch = e.touches[0];
				const x = touch.clientX - rect.left;
				const y = touch.clientY - rect.top;

				// Check if touch is on Y-axis (price axis)
				const isOnYAxis = x >= chartWidth;

				if (isOnYAxis) {
					// Y-axis scrolling mode
					setTouchStart({
						x: touch.clientX,
						y: touch.clientY,
						time: Date.now(),
					});
					setIsDragging(true);
					return;
				}

				setMousePos({ x, y });
				setTouchStart({
					x: touch.clientX,
					y: touch.clientY,
					time: Date.now(),
				});

				// Start drag
				setIsDragging(true);
				setDragStart({
					x: touch.clientX,
					y: touch.clientY,
					offsetX: chartState.offsetX,
				});

				// Start long press timer for context menu
				longPressTimerRef.current = setTimeout(() => {
					const metrics = getChartMetrics();
					const price = getPriceAtY(
						y,
						metrics.priceMin,
						metrics.priceMax,
						metrics.priceHeight,
					);
					const candleIdx = getIndexAtX(x);
					const boundedIdx = Math.max(
						0,
						Math.min(candleIdx, candles.length - 1),
					);

					setContextMenu({
						visible: true,
						x: touch.clientX,
						y: touch.clientY,
						price,
						candleIdx: boundedIdx,
						exactX: x,
					});

					// Haptic feedback if available
					if ("vibrate" in navigator) {
						navigator.vibrate(50);
					}
				}, 500); // 500ms long press

				// Always pan on mobile with cursor tool
				if (activeTool === "cursor") {
					setIsPanning(true);
				}
			} else if (e.touches.length === 2) {
				// Two finger pinch/pan
				const touch1 = e.touches[0];
				const touch2 = e.touches[1];
				const distance = Math.hypot(
					touch2.clientX - touch1.clientX,
					touch2.clientY - touch1.clientY,
				);
				setLastTouchDistance(distance);
				setIsPanning(true);

				// Clear long press timer
				if (longPressTimerRef.current) {
					clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
				}
			}
		},
		[
			activeTool,
			chartState,
			contextMenu.visible,
			getChartMetrics,
			getPriceAtY,
			getIndexAtX,
			candles,
			dims.w,
		],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault(); // Prevent page scroll

			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const chartWidth = dims.w - PRICE_AXIS_WIDTH;
			const chartHeight = dims.h - TIME_AXIS_HEIGHT;

			// Clear long press timer on move
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}

			if (e.touches.length === 1) {
				// Single touch drag
				const touch = e.touches[0];
				const x = touch.clientX - rect.left;
				const y = touch.clientY - rect.top;

				// Check if this is Y-axis scrolling
				if (touchStart && x >= chartWidth) {
					// Y-axis price scrolling
					const deltaY = touch.clientY - touchStart.y;
					const scrollFactor = 0.002; // Adjust sensitivity

					setChartState((prev) => {
						const newZoom = clamp(
							prev.priceZoomFactor * (1 - deltaY * scrollFactor),
							0.3, // Min zoom out (wider range)
							5.0, // Max zoom in (narrower range)
						);
						return {
							...prev,
							priceZoomFactor: newZoom,
						};
					});

					// Update touch start for continuous scrolling
					setTouchStart({
						x: touch.clientX,
						y: touch.clientY,
						time: touchStart.time,
					});
					return;
				}

				setMousePos({ x, y });

				if (isDragging && touchStart) {
					const dx = touch.clientX - touchStart.x;
					const dy = touch.clientY - touchStart.y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					// Check if moved beyond threshold
					if (distance > dragThreshold && !isPanning) {
						// Start panning for cursor tool or crosshair with significant movement
						if (
							activeTool === "cursor" ||
							activeTool === "crosshair"
						) {
							setIsPanning(true);
						}
					}

					// Handle panning
					if (isPanning) {
						const deltaX = touch.clientX - dragStart.x;
						setChartState((prev) => ({
							...prev,
							offsetX: dragStart.offsetX + deltaX,
						}));
					}
				}
			} else if (e.touches.length === 2) {
				// Two finger pinch zoom
				const touch1 = e.touches[0];
				const touch2 = e.touches[1];
				const distance = Math.hypot(
					touch2.clientX - touch1.clientX,
					touch2.clientY - touch1.clientY,
				);

				if (lastTouchDistance) {
					const centerX =
						(touch1.clientX + touch2.clientX) / 2 - rect.left;
					const scale = distance / lastTouchDistance;

					setChartState((prev) => {
						const oldW = prev.candleWidth;
						const newW = clamp(
							oldW * scale,
							MIN_CANDLE_WIDTH,
							MAX_CANDLE_WIDTH,
						);

						// Zoom centered on pinch center
						const oldSpacing = oldW + 2;
						const newSpacing = newW + 2;
						const candleIdx = (centerX - prev.offsetX) / oldSpacing;
						const newOffsetX = centerX - candleIdx * newSpacing;

						return {
							...prev,
							candleWidth: newW,
							offsetX: newOffsetX,
						};
					});
				}

				setLastTouchDistance(distance);
			}
		},
		[
			isDragging,
			isPanning,
			touchStart,
			dragStart,
			dragThreshold,
			lastTouchDistance,
			activeTool,
			dims.w,
			dims.h,
		],
	);

	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			// Clear long press timer
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}

			const wasPanning = isPanning;
			setIsDragging(false);
			setIsPanning(false);
			setLastTouchDistance(null);

			// If we were panning, don't process as a drawing action
			if (wasPanning || !touchStart) {
				setTouchStart(null);
				return;
			}

			// Check if this was a tap (not a drag)
			const timeDiff = Date.now() - touchStart.time;
			if (timeDiff < 300 && e.changedTouches.length > 0) {
				// This was a quick tap - handle as click for drawing
				const touch = e.changedTouches[0];
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;

				const x = touch.clientX - rect.left;
				const y = touch.clientY - rect.top;
				const metrics = getChartMetrics();
				const candleIdx = getIndexAtX(x);
				const price = getPriceAtY(
					y,
					metrics.priceMin,
					metrics.priceMax,
					metrics.priceHeight,
				);

				if (x > metrics.chartWidth || y > metrics.chartHeight) {
					setTouchStart(null);
					return;
				}

				// Handle drawing tools on tap
				const singleClickTools: DrawingTool[] = ["hline", "vline"];
				const twoClickTools: DrawingTool[] = [
					"trendline",
					"ray",
					"extended",
					"rect",
					"ellipse",
					"fibonacci",
					"measure",
				];

				if (singleClickTools.includes(activeTool)) {
					const newDrawing: Drawing = {
						id: Date.now().toString(),
						type: activeTool,
						points: [{ candleIdx, price }],
						color: drawingColor,
					};
					setDrawings((prev) => [...prev, newDrawing]);
					setActiveTool("crosshair");
				}

				if (twoClickTools.includes(activeTool)) {
					if (!drawingInProgress) {
						setDrawingInProgress({
							id: Date.now().toString(),
							type: activeTool,
							points: [{ candleIdx, price }],
							color: drawingColor,
						});
					} else {
						const completed = {
							...drawingInProgress,
							points: [
								...drawingInProgress.points,
								{ candleIdx, price },
							],
						};
					// For measure tool, only keep one measure at a time
					if (completed.type === 'measure') {
						setDrawings((prev) => [...prev.filter(d => d.type !== 'measure'), completed]);
					} else {
						setDrawings((prev) => [...prev, completed]);
					}
						setDrawingInProgress(null);
						setActiveTool("crosshair");
					}
				}
			}

			setTouchStart(null);
		},
		[
			isPanning,
			touchStart,
			activeTool,
			drawingInProgress,
			drawingColor,
			getChartMetrics,
			getPriceAtY,
			getIndexAtX,
		],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const metrics = getChartMetrics();
			const price = getPriceAtY(
				y,
				metrics.priceMin,
				metrics.priceMax,
				metrics.priceHeight,
			);
			const candleIdx = getIndexAtX(x);

			// Ensure candle index is within bounds
			const boundedIdx = Math.max(
				0,
				Math.min(candleIdx, candles.length - 1),
			);

			setContextMenu({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				price,
				candleIdx: boundedIdx,
				exactX: x,
			});
		},
		[getChartMetrics, getPriceAtY, getIndexAtX, candles],
	);

	const resetChartView = useCallback(() => {
		// Reset to the default position (same as initial load)
		if (candles.length > 0) {
			const spacing = DEFAULT_CANDLE_WIDTH + 2;
			const chartWidth = dims.w - PRICE_AXIS_WIDTH;
			const visibleCandles = Math.floor(chartWidth / spacing);

			// Position chart so most recent candles are visible on the right
			// Leave ~15% empty space on the right for future candles
			const rightPadding = Math.floor(visibleCandles * 0.15);
			const totalWidth = candles.length * spacing;

			let targetOffset: number;

			// If all candles fit in view, center them
			if (totalWidth <= chartWidth) {
				targetOffset = (chartWidth - totalWidth) / 2;
			} else {
				// If more candles than fit in view, show the most recent ones
				// Position = rightmost position - right padding
				targetOffset = chartWidth - totalWidth + rightPadding * spacing;
			}

			setChartState({
				offsetX: targetOffset,
				candleWidth: DEFAULT_CANDLE_WIDTH,
				priceZoomFactor: 1.0,
			});
		} else {
			setChartState({
				offsetX: 0,
				candleWidth: DEFAULT_CANDLE_WIDTH,
				priceZoomFactor: 1.0,
			});
		}
		setContextMenu({ visible: false, x: 0, y: 0, price: 0 });
	}, [candles.length, dims.w]);

	const copyPriceToClipboard = useCallback((price: number) => {
		const formattedPrice = formatPrice(price);
		navigator.clipboard.writeText(formattedPrice);
		setContextMenu({ visible: false, x: 0, y: 0, price: 0 });
	}, []);

	const clearAllDrawings = useCallback(() => {
		setDrawings([]);
		setContextMenu({ visible: false, x: 0, y: 0, price: 0 });
	}, []);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();

			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const mx = e.clientX - rect.left;
			const chartWidth = dims.w - PRICE_AXIS_WIDTH;

			// Check if mouse is over the Y-axis (price axis)
			const isOverYAxis = mx >= chartWidth;

			if (isOverYAxis) {
				// Scroll over Y-axis: zoom price (Y-axis)
				const factor = e.deltaY < 0 ? 1.15 : 0.87; // Scroll up = zoom in, scroll down = zoom out

				setChartState((prev) => {
					const newZoom = clamp(
						prev.priceZoomFactor * factor,
						0.1,
						10.0,
					); // Limit zoom range
					return {
						...prev,
						priceZoomFactor: newZoom,
					};
				});
			} else if (e.shiftKey) {
				// Hold Shift for pan
				const panSpeed = 1.5;
				const delta = -e.deltaY * panSpeed;

				setChartState((prev) => ({
					...prev,
					offsetX: prev.offsetX + delta,
				}));
			} else {
				// Zoom behavior over chart (default)
				const factor = e.deltaY < 0 ? 1.15 : 0.87;

				setChartState((prev) => {
					const oldW = prev.candleWidth;
					const newW = clamp(
						oldW * factor,
						MIN_CANDLE_WIDTH,
						MAX_CANDLE_WIDTH,
					);

					// Zoom centered on mouse
					const oldSpacing = oldW + 2;
					const newSpacing = newW + 2;
					const candleIdx = (mx - prev.offsetX) / oldSpacing;
					const newOffsetX = mx - candleIdx * newSpacing;

					return {
						...prev,
						candleWidth: newW,
						offsetX: newOffsetX,
					};
				});
			}
		},
		[dims.w],
	);

	// Escape key to cancel drawing, Delete to remove selected
	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger shortcuts if user is typing in an input
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;

			switch (e.key.toLowerCase()) {
				case "escape":
					e.preventDefault();
					if (drawingInProgress) {
						setDrawingInProgress(null);
					} else if (selectedDrawingId) {
						setSelectedDrawingId(null);
					} else {
						setActiveTool("crosshair");
					}
					break;
				case "delete":
				case "backspace":
					if (selectedDrawingId) {
						e.preventDefault();
						setDrawings((prev) =>
							prev.filter((d) => d.id !== selectedDrawingId),
						);
						setSelectedDrawingId(null);
					}
					break;
				case "c":
					if (e.ctrlKey || e.metaKey) break; // Allow copy
					e.preventDefault();
					setActiveTool("crosshair");
					break;
				case "v":
					if (e.ctrlKey || e.metaKey) break; // Allow paste
					e.preventDefault();
					setActiveTool("cursor");
					break;
				case "t":
					e.preventDefault();
					setActiveTool("trendline");
					break;
				case "r":
					if (e.ctrlKey || e.metaKey) break;
					if (e.altKey) {
						e.preventDefault();
						resetChartView();
					} else if (e.shiftKey) {
						e.preventDefault();
						setActiveTool("rect");
					} else {
						e.preventDefault();
						setActiveTool("ray");
					}
					break;
				case "e":
					e.preventDefault();
					setActiveTool("ellipse");
					break;
				case "h":
					e.preventDefault();
					setActiveTool("hline");
					break;
				case "l":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						setAllDrawingsLocked((prev) => !prev);
					} else {
						e.preventDefault();
						setActiveTool("extended");
					}
					break;
				case "f":
					if (e.ctrlKey || e.metaKey) break; // Allow find
					e.preventDefault();
					setActiveTool("fibonacci");
					break;
				case "p":
					e.preventDefault();
					setActiveTool("pitchfork");
					break;
				case "m":
					e.preventDefault();
					setActiveTool("measure");
					break;
				case "z":
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						setDrawings((prev) => prev.slice(0, -1));
					}
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedDrawingId, drawingInProgress, resetChartView]);

	// Prevent page scroll when mouse is over the chart component (only if we have data)
	useEffect(() => {
		const chartRoot = chartRootRef.current;
		if (!chartRoot) return;

		const handleWheel = (e: WheelEvent) => {
			// Only prevent default if we have candle data
			if (candles.length > 0) {
				e.preventDefault();
			}
		};

		// Add listener with passive: false to allow preventDefault
		chartRoot.addEventListener("wheel", handleWheel, { passive: false });
		return () => chartRoot.removeEventListener("wheel", handleWheel);
	}, [candles.length]);

	// Cleanup long press timer on unmount
	useEffect(() => {
		return () => {
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
			}
		};
	}, []);

	// ============================================================================
	// Controls
	// ============================================================================

	const zoomIn = useCallback(() => {
		setChartState((prev) => ({
			...prev,
			candleWidth: clamp(
				prev.candleWidth * 1.3,
				MIN_CANDLE_WIDTH,
				MAX_CANDLE_WIDTH,
			),
		}));
	}, []);

	const zoomOut = useCallback(() => {
		setChartState((prev) => ({
			...prev,
			candleWidth: clamp(
				prev.candleWidth * 0.7,
				MIN_CANDLE_WIDTH,
				MAX_CANDLE_WIDTH,
			),
		}));
	}, []);

	const fitContent = useCallback(() => {
		if (candles.length === 0) return;

		const chartWidth = dims.w - PRICE_AXIS_WIDTH;
		const spacing = chartWidth / candles.length;
		const candleW = clamp(spacing - 2, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH);
		const actualSpacing = candleW + 2;

		setChartState({
			candleWidth: candleW,
			offsetX: chartWidth - candles.length * actualSpacing,
			priceZoomFactor: 1.0,
		});
	}, [candles.length, dims.w]);

	const clearDrawings = useCallback(() => {
		setDrawings([]);
		setDrawingInProgress(null);
	}, []);

	const undoLastDrawing = useCallback(() => {
		setDrawings((prev) => prev.slice(0, -1));
	}, []);

	const toggleLockAllDrawings = useCallback(() => {
		setAllDrawingsLocked(!allDrawingsLocked);
		if (!allDrawingsLocked) {
			// Lock all drawings
			setDrawings((prev) => prev.map((d) => ({ ...d, locked: true })));
			setSelectedDrawingId(null);
		} else {
			// Unlock all drawings
			setDrawings((prev) => prev.map((d) => ({ ...d, locked: false })));
		}
	}, [allDrawingsLocked]);

	const toggleIndicator = useCallback((type: Indicator) => {
		setIndicators((prev) =>
			prev.map((ind) =>
				ind.type === type ? { ...ind, enabled: !ind.enabled } : ind,
			),
		);
	}, []);

	// Real-time updates
	useTokenPriceUpdates(tokenId, (update) => {
		const price = parseFloat(update.price);
		if (!isFinite(price) || price <= 0) return;

		setCandles((prev) => {
			if (prev.length === 0) return prev;

			const intervalSec = {
				"1m": 60,
				"5m": 300,
				"15m": 900,
				"1h": 3600,
				"4h": 14400,
				"1D": 86400,
			}[timeRange];
			const now = Math.floor(Date.now() / 1000);
			const currentBar = Math.floor(now / intervalSec) * intervalSec;

			const last = prev[prev.length - 1];
			if (last.time === currentBar) {
				const updated = [...prev];
				updated[updated.length - 1] = {
					...last,
					high: Math.max(last.high, price),
					low: Math.min(last.low, price),
					close: price,
				};
				return updated;
			} else if (currentBar > last.time) {
				return [
					...prev,
					{
						time: currentBar,
						open: price,
						high: price,
						low: price,
						close: price,
						volume: 0,
					},
				];
			}
			return prev;
		});
	});

	// Last candle info
	const lastCandle = candles[candles.length - 1];
	const priceChange = lastCandle
		? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
		: 0;

	// ============================================================================
	// Render UI
	// ============================================================================

	const toolGroups = [
		{
			label: "Navigation",
			tools: [
				{
					id: "cursor" as DrawingTool,
					icon: MousePointer2,
					tip: "Pan / Select (V)",
				},
				{
					id: "crosshair" as DrawingTool,
					icon: Crosshair,
					tip: "Crosshair (C)",
				},
			],
		},
		{
			label: "Lines",
			tools: [
				{
					id: "trendline" as DrawingTool,
					icon: TrendingUp,
					tip: "Trend Line (T)",
				},
				{
					id: "ray" as DrawingTool,
					icon: ArrowUpRight,
					tip: "Ray (R)",
				},
				{
					id: "extended" as DrawingTool,
					icon: Slash,
					tip: "Extended Line (L)",
				},
				{
					id: "hline" as DrawingTool,
					icon: Minus,
					tip: "Horizontal Line (H)",
				},
				{
					id: "vline" as DrawingTool,
					icon: MoveVertical,
					tip: "Vertical Line",
				},
			],
		},
		{
			label: "Shapes",
			tools: [
				{
					id: "rect" as DrawingTool,
					icon: Square,
					tip: "Rectangle (Shift+R)",
				},
				{
					id: "ellipse" as DrawingTool,
					icon: Circle,
					tip: "Ellipse (E)",
				},
			],
		},
		{
			label: "Advanced",
			tools: [
				{
					id: "fibonacci" as DrawingTool,
					icon: Activity,
					tip: "Fibonacci Retracement (F)",
				},
				{
					id: "pitchfork" as DrawingTool,
					icon: GitFork,
					tip: "Andrews Pitchfork (P)",
				},
				{
					id: "channel" as DrawingTool,
					icon: Triangle,
					tip: "Parallel Channel",
				},
				{
					id: "measure" as DrawingTool,
					icon: Ruler,
					tip: "Price Range / Measure (M)",
				},
				{
					id: "text" as DrawingTool,
					icon: Type,
					tip: "Text Annotation",
				},
			],
		},
	];

	return (
		<div
			ref={chartRootRef}
			className={cn(
				"flex flex-col bg-[#0f0f0f] rounded-lg overflow-hidden",
				className,
			)}
		>
			{/* Toolbar */}
			{showToolbar && (
				<div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 bg-black/40 shrink-0 flex-wrap">
					{/* Tool Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all text-xs">
								<Settings2 className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Tools</span>
								<ChevronDown className="w-3 h-3" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-zinc-900 border-zinc-700">
							{toolGroups.map((group, gi) => (
								<div key={group.label}>
									{gi > 0 && (
										<DropdownMenuSeparator className="bg-zinc-700" />
									)}
									<DropdownMenuLabel className="text-zinc-500 text-[10px]">
										{group.label}
									</DropdownMenuLabel>
									{group.tools.map(
										({ id, icon: Icon, tip }) => (
											<DropdownMenuItem
												key={id}
												onClick={() => {
													setActiveTool(id);
													setDrawingInProgress(null);
													setContextMenu({
														visible: false,
														x: 0,
														y: 0,
														price: 0,
													});
												}}
												className={cn(
													"flex items-center gap-2 cursor-pointer",
													activeTool === id
														? "bg-[#22c55e]/20 text-[#22c55e]"
														: "text-zinc-300",
												)}
											>
												<Icon className="w-4 h-4" />
												<span>{tip}</span>
											</DropdownMenuItem>
										),
									)}
								</div>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Quick Tools */}
					<div className="flex items-center bg-white/5 rounded p-0.5">
						{[
							{
								id: "cursor" as DrawingTool,
								icon: MousePointer2,
							},
							{ id: "crosshair" as DrawingTool, icon: Crosshair },
							{
								id: "trendline" as DrawingTool,
								icon: TrendingUp,
							},
							{ id: "hline" as DrawingTool, icon: Minus },
							{ id: "fibonacci" as DrawingTool, icon: Activity },
							{ id: "measure" as DrawingTool, icon: Ruler },
						].map(({ id, icon: Icon }) => (
							<button
								key={id}
								onClick={() => {
									setActiveTool(id);
									setDrawingInProgress(null);
									setContextMenu({
										visible: false,
										x: 0,
										y: 0,
										price: 0,
									});
								}}
								title={id}
								className={cn(
									"p-1.5 rounded transition-all",
									activeTool === id ||
										(id === "cursor" && isPanning)
										? "bg-[#22c55e] text-black"
										: "text-zinc-500 hover:text-white hover:bg-white/10",
								)}
							>
								<Icon className="w-3.5 h-3.5" />
							</button>
						))}
					</div>

					{/* Color Picker */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								className="p-1.5 rounded hover:bg-white/10 transition-all"
								title="Drawing Color"
							>
								<div
									className="w-4 h-4 rounded-sm border border-white/20"
									style={{ backgroundColor: drawingColor }}
								/>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-zinc-900 border-zinc-700 p-2">
							<div className="grid grid-cols-4 gap-1">
								{DRAWING_COLORS.map((color) => (
									<button
										key={color}
										onClick={() => setDrawingColor(color)}
										className={cn(
											"w-6 h-6 rounded border-2 transition-all",
											drawingColor === color
												? "border-white scale-110"
												: "border-transparent hover:scale-105",
										)}
										style={{ backgroundColor: color }}
									/>
								))}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="w-px h-5 bg-white/10 mx-1" />

					{/* Indicators Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all text-xs">
								<LineChart className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">
									Indicators
								</span>
								<ChevronDown className="w-3 h-3" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-zinc-900 border-zinc-700">
							{indicators.map((ind) => (
								<DropdownMenuItem
									key={ind.type}
									onClick={() => toggleIndicator(ind.type)}
									className={cn(
										"flex items-center justify-between gap-4 cursor-pointer",
										ind.enabled
											? "text-white"
											: "text-zinc-400",
									)}
								>
									<div className="flex items-center gap-2">
										<div
											className="w-3 h-3 rounded"
											style={{
												backgroundColor: ind.color,
											}}
										/>
										<span>
											{ind.type.toUpperCase()} (
											{ind.period})
										</span>
									</div>
									{ind.enabled && (
										<span className="text-[#22c55e] text-xs">
											✓
										</span>
									)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="w-px h-5 bg-white/10 mx-1" />

					{/* Price display */}
					{lastCandle && (
						<div className="flex items-center gap-2 px-2">
							<span className="text-white font-mono text-sm font-medium">
								{formatPrice(lastCandle.close)}
							</span>
							<span
								className={cn(
									"text-xs font-semibold px-1.5 py-0.5 rounded",
									priceChange >= 0
										? "text-[#22c55e] bg-[#22c55e]/10"
										: "text-[#ef4444] bg-[#ef4444]/10",
								)}
							>
								{priceChange >= 0 ? "+" : ""}
								{priceChange.toFixed(2)}%
							</span>
						</div>
					)}

					<div className="flex-1" />

					{/* Time ranges */}
					<div className="flex items-center bg-white/5 rounded p-0.5">
						{TIME_RANGES.map((r) => (
							<button
								key={r}
								onClick={() => setTimeRange(r)}
								className={cn(
									"px-2 py-1 text-[10px] font-semibold rounded transition-all",
									timeRange === r
										? "bg-[#22c55e] text-black"
										: "text-zinc-500 hover:text-white",
								)}
							>
								{r}
							</button>
						))}
					</div>

					<div className="w-px h-5 bg-white/10 mx-1" />

					{/* Actions */}
					<div className="flex items-center gap-0.5">
						<button
							onClick={zoomIn}
							title="Zoom In"
							className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded transition-all"
						>
							<Plus className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={zoomOut}
							title="Zoom Out"
							className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded transition-all"
						>
							<Minus className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={fitContent}
							title="Fit All"
							className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded transition-all"
						>
							<Maximize2 className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={undoLastDrawing}
							title="Undo (Ctrl+Z)"
							className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded transition-all"
						>
							<Undo2 className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={toggleLockAllDrawings}
							title={
								allDrawingsLocked
									? "Unlock All Drawings (Ctrl+L)"
									: "Lock All Drawings (Ctrl+L)"
							}
							className={cn(
								"p-1.5 rounded transition-all",
								allDrawingsLocked
									? "text-amber-400 bg-amber-500/20 hover:bg-amber-500/30"
									: "text-zinc-500 hover:text-white hover:bg-white/10",
							)}
						>
							{allDrawingsLocked ? (
								<Lock className="w-3.5 h-3.5" />
							) : (
								<LockOpen className="w-3.5 h-3.5" />
							)}
						</button>
						<button
							onClick={clearDrawings}
							title="Clear All Drawings"
							className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-white/10 rounded transition-all"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</button>
					</div>

					<div className="text-[10px] text-zinc-600 ml-2">
						{candles.length} candles • {drawings.length} drawings
					</div>
				</div>
			)}

			{/* Chart Canvas */}
			<div ref={containerRef} className="relative flex-1 min-h-0">
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
						<Loader2 className="w-6 h-6 text-[#22c55e] animate-spin" />
					</div>
				)}

				{error && !isLoading && (
					<div className="absolute inset-0 flex flex-col items-center justify-center z-10">
						<p className="text-zinc-400 text-sm">
							Failed to load chart
						</p>
						<p className="text-zinc-600 text-xs mt-1">{error}</p>
					</div>
				)}

				<canvas
					ref={canvasRef}
					className="absolute inset-0 w-full h-full"
					style={{
						cursor:
							isPanning || (activeTool === "cursor" && isDragging)
								? "grabbing"
								: activeTool === "cursor"
									? "grab"
									: "crosshair",
						touchAction: "none", // Disable default touch behaviors
					}}
					onMouseMove={handleMouseMove}
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onWheel={handleWheel}
					onContextMenu={handleContextMenu}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				/>

				{/* Context Menu */}
				{contextMenu.visible && (
					<div
						className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 z-50 min-w-50"
						style={{
							left: `${contextMenu.x}px`,
							top: `${contextMenu.y}px`,
						}}
					>
						<button
							onClick={(e) => {
								e.stopPropagation();
								resetChartView();
							}}
							className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center justify-between"
						>
							<span>Reset Chart View</span>
							<span className="text-xs text-zinc-500">Alt+R</span>
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								copyPriceToClipboard(contextMenu.price);
							}}
							className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
						>
							Copy Price {formatPrice(contextMenu.price)}
						</button>
						<div className="border-t border-zinc-700 my-1" />
						<button
							onClick={(e) => {
								e.stopPropagation();
								if (lockedCursorPosition) {
									// Unlock
									setLockedCursorPosition(null);
								} else {
									// Lock at current position
									if (
										contextMenu.candleIdx !== undefined &&
										contextMenu.exactX !== undefined
									) {
										// Calculate the candle center position
										const spacing =
											chartState.candleWidth + 2;
										const candleCenterX =
											chartState.offsetX +
											contextMenu.candleIdx * spacing +
											chartState.candleWidth / 2;
										// Store the offset from candle center
										const offset =
											contextMenu.exactX - candleCenterX;

										setLockedCursorPosition({
											candleIdx: contextMenu.candleIdx,
											offsetFromCandleCenter: offset,
										});
									}
								}
								setContextMenu({
									visible: false,
									x: 0,
									y: 0,
									price: 0,
								});
							}}
							className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center justify-between"
						>
							<span>
								{lockedCursorPosition ? "Unlock" : "Lock"}{" "}
								Vertical Cursor
							</span>
							{lockedCursorPosition && (
								<Lock className="w-3 h-3" />
							)}
						</button>
						{drawings.length > 0 && (
							<>
								<div className="border-t border-zinc-700 my-1" />
								<button
									onClick={(e) => {
										e.stopPropagation();
										clearAllDrawings();
									}}
									className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
								>
									Remove {drawings.length} Drawing
									{drawings.length !== 1 ? "s" : ""}
								</button>
							</>
						)}
						<div className="border-t border-zinc-700 my-1" />
						<button
							onClick={(e) => {
								e.stopPropagation();
								setHideMarksOnBar((prev) => !prev);
								setContextMenu({
									visible: false,
									x: 0,
									y: 0,
									price: 0,
								});
							}}
							className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
						>
							{hideMarksOnBar ? "Show" : "Hide"} Marks on Bar
						</button>
					</div>
				)}

				{/* Locked Cursor Icon */}
				{lockedCursorPosition &&
					mousePos &&
					candles.length > 0 &&
					(() => {
						const metrics = getChartMetrics();
						const spacing = chartState.candleWidth + 2;
						const candleCenterX =
							chartState.offsetX +
							lockedCursorPosition.candleIdx * spacing +
							chartState.candleWidth / 2;
						const lockedX =
							candleCenterX +
							lockedCursorPosition.offsetFromCandleCenter;
						const chartHeight = dims.h - TIME_AXIS_HEIGHT;

						if (lockedX >= 0 && lockedX <= metrics.chartWidth) {
							return (
								<div
									className="absolute pointer-events-none"
									style={{
										left: `${lockedX}px`,
										top: `${chartHeight - 25}px`,
										transform: "translateX(-50%)",
									}}
								>
									<div className="bg-white/90 rounded-sm p-0.5">
										<Lock className="w-3 h-3 text-black" />
									</div>
								</div>
							);
						}
						return null;
					})()}

				{/* Tool hint */}
				{drawingInProgress && (
					<div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 text-zinc-300 text-xs px-3 py-1.5 rounded-full border border-white/10 pointer-events-none">
						{drawingInProgress.type === "pitchfork" ||
						drawingInProgress.type === "channel"
							? `Click point ${drawingInProgress.points.length + 1} of 3 • ESC to cancel`
							: "Click to complete • ESC to cancel"}
					</div>
				)}

				{/* Active indicators legend */}
				{indicators.some((i) => i.enabled) && (
					<div className="absolute top-2 right-20 flex flex-col gap-1 pointer-events-none">
						{indicators
							.filter((i) => i.enabled)
							.map((ind) => (
								<div
									key={ind.type}
									className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded text-[10px]"
								>
									<div
										className="w-2 h-2 rounded-full"
										style={{ backgroundColor: ind.color }}
									/>
									<span className="text-zinc-400">
										{ind.type.toUpperCase()}({ind.period})
									</span>
								</div>
							))}
					</div>
				)}
			</div>
		</div>
	);
}

export default AdvancedPriceChart;
