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
	height?: number;
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
	| "text";

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
	x: number;
	y: number;
	price?: number;
	time?: number;
	candleIdx?: number;
}

interface Drawing {
	id: string;
	type: DrawingTool;
	points: DrawingPoint[];
	color: string;
	text?: string;
	selected?: boolean;
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
	height = 450,
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
	});

	// Interaction state
	const [mousePos, setMousePos] = useState({ x: -1, y: -1 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, offsetX: 0 });
	const [drawingInProgress, setDrawingInProgress] = useState<Drawing | null>(
		null,
	);

	// Dimensions
	const [dims, setDims] = useState({ w: 800, h: height });

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
					// Preserve user's manual positioning, only reset candleWidth to default
					setChartState((prev) => ({
						offsetX: prev.offsetX,
						candleWidth: DEFAULT_CANDLE_WIDTH,
					}));
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
	}, [tokenId, timeRange]);

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
		const timeStep = Math.max(1, Math.floor((endIdx - startIdx) / 8));
		for (let i = startIdx; i < endIdx; i += timeStep) {
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
		for (const d of drawings) {
			const isSelected = d.id === selectedDrawingId;
			ctx.strokeStyle = d.color;
			ctx.lineWidth = isSelected ? 3 : 2;

			if (d.type === "hline" && d.points[0]?.price !== undefined) {
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
				const x = getCandleX(
					d.points[0].candleIdx || getIndexAtX(d.points[0].x),
				);
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, chartHeight);
				ctx.stroke();
			} else if (d.type === "trendline" && d.points.length === 2) {
				ctx.beginPath();
				ctx.moveTo(d.points[0].x, d.points[0].y);
				ctx.lineTo(d.points[1].x, d.points[1].y);
				ctx.stroke();
				// Draw handles if selected
				if (isSelected) {
					ctx.fillStyle = d.color;
					ctx.beginPath();
					ctx.arc(d.points[0].x, d.points[0].y, 5, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.arc(d.points[1].x, d.points[1].y, 5, 0, Math.PI * 2);
					ctx.fill();
				}
			} else if (d.type === "ray" && d.points.length === 2) {
				// Ray extends infinitely in one direction
				const dx = d.points[1].x - d.points[0].x;
				const dy = d.points[1].y - d.points[0].y;
				const len = Math.sqrt(dx * dx + dy * dy);
				const ex = d.points[0].x + (dx / len) * chartWidth * 2;
				const ey = d.points[0].y + (dy / len) * chartWidth * 2;
				ctx.beginPath();
				ctx.moveTo(d.points[0].x, d.points[0].y);
				ctx.lineTo(ex, ey);
				ctx.stroke();
			} else if (d.type === "extended" && d.points.length === 2) {
				// Extended line (infinite both directions)
				const dx = d.points[1].x - d.points[0].x;
				const dy = d.points[1].y - d.points[0].y;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const ex1 = d.points[0].x - (dx / len) * chartWidth * 2;
				const ey1 = d.points[0].y - (dy / len) * chartWidth * 2;
				const ex2 = d.points[0].x + (dx / len) * chartWidth * 2;
				const ey2 = d.points[0].y + (dy / len) * chartWidth * 2;
				ctx.beginPath();
				ctx.moveTo(ex1, ey1);
				ctx.lineTo(ex2, ey2);
				ctx.stroke();
			} else if (d.type === "rect" && d.points.length === 2) {
				const x1 = Math.min(d.points[0].x, d.points[1].x);
				const y1 = Math.min(d.points[0].y, d.points[1].y);
				const w = Math.abs(d.points[1].x - d.points[0].x);
				const h = Math.abs(d.points[1].y - d.points[0].y);
				ctx.strokeRect(x1, y1, w, h);
				ctx.fillStyle = d.color + "1a";
				ctx.fillRect(x1, y1, w, h);
			} else if (d.type === "ellipse" && d.points.length === 2) {
				const cx = (d.points[0].x + d.points[1].x) / 2;
				const cy = (d.points[0].y + d.points[1].y) / 2;
				const rx = Math.abs(d.points[1].x - d.points[0].x) / 2;
				const ry = Math.abs(d.points[1].y - d.points[0].y) / 2;
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.fillStyle = d.color + "1a";
				ctx.fill();
			} else if (d.type === "fibonacci" && d.points.length === 2) {
				const y1 = d.points[0].y;
				const y2 = d.points[1].y;
				const price1 =
					d.points[0].price ||
					getPriceAtY(y1, priceMin, priceMax, priceHeight);
				const price2 =
					d.points[1].price ||
					getPriceAtY(y2, priceMin, priceMax, priceHeight);
				const priceDiff = price1 - price2;

				ctx.font = "10px -apple-system, system-ui, sans-serif";
				ctx.textAlign = "left";

				for (const level of FIB_LEVELS) {
					const price = price2 + priceDiff * level;
					const y = getPriceY(price, priceMin, priceMax, priceHeight);

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
				ctx.fillStyle = d.color + "0d";
				ctx.fillRect(
					0,
					Math.min(y1, y2),
					chartWidth,
					Math.abs(y2 - y1),
				);
			} else if (d.type === "pitchfork" && d.points.length === 3) {
				const p0 = d.points[0];
				const p1 = d.points[1];
				const p2 = d.points[2];

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
				const offsetX = p2.x - midX;
				const offsetY = p2.y - midY;

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
				const p0 = d.points[0];
				const p1 = d.points[1];
				const p2 = d.points[2];

				// Main line
				const dx = p1.x - p0.x;
				const dy = p1.y - p0.y;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;

				ctx.beginPath();
				ctx.moveTo(p0.x - (dx / len) * 500, p0.y - (dy / len) * 500);
				ctx.lineTo(p1.x + (dx / len) * 500, p1.y + (dy / len) * 500);
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
				const p1 = d.points[0];
				const p2 = d.points[1];
				const price1 =
					p1.price ||
					getPriceAtY(p1.y, priceMin, priceMax, priceHeight);
				const price2 =
					p2.price ||
					getPriceAtY(p2.y, priceMin, priceMax, priceHeight);
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
				ctx.fillStyle = d.color;
				ctx.font = "12px -apple-system, system-ui, sans-serif";
				ctx.textAlign = "left";
				ctx.fillText(d.text, d.points[0].x, d.points[0].y);
			}
		}

		// Drawing in progress
		if (drawingInProgress) {
			ctx.strokeStyle = drawingColor;
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);

			const pts = drawingInProgress.points;
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

				ctx.beginPath();
				ctx.moveTo(mousePos.x, 0);
				ctx.lineTo(mousePos.x, chartHeight);
				ctx.stroke();

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

				// Time label on X-axis
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
		ctx.font = "10px -apple-system, system-ui, sans-serif";
		ctx.textAlign = "center";

		for (let i = startIdx; i < endIdx; i += timeStep) {
			const x = getCandleX(i);
			if (x >= 0 && x <= chartWidth && candles[i]) {
				ctx.fillText(
					formatTime(candles[i].time, timeRange),
					x,
					chartHeight + 15,
				);
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

			if (isDragging && activeTool === "cursor") {
				const dx = e.clientX - dragStart.x;
				setChartState((prev) => ({
					...prev,
					offsetX: dragStart.offsetX + dx,
				}));
			}
		},
		[isDragging, dragStart, activeTool],
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
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

			// Single-click tools
			const singleClickTools: DrawingTool[] = ["hline", "vline"];
			// Two-click tools
			const twoClickTools: DrawingTool[] = [
				"trendline",
				"ray",
				"extended",
				"rect",
				"ellipse",
				"fibonacci",
				"measure",
			];
			// Three-click tools
			const threeClickTools: DrawingTool[] = ["pitchfork", "channel"];

			if (activeTool === "cursor") {
				setIsDragging(true);
				setDragStart({ x: e.clientX, offsetX: chartState.offsetX });
				return;
			}

			if (activeTool === "text") {
				const text = prompt("Enter text:");
				if (text) {
					setDrawings((prev) => [
						...prev,
						{
							id: Date.now().toString(),
							type: "text",
							points: [{ x, y }],
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
						points: [{ x, y, price, candleIdx }],
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
						points: [{ x, y, price, candleIdx }],
						color: drawingColor,
					});
				} else {
					const completed: Drawing = {
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ x, y, price, candleIdx },
						],
					};
					setDrawings((prev) => [...prev, completed]);
					setDrawingInProgress(null);
				}
				return;
			}

			if (threeClickTools.includes(activeTool)) {
				if (!drawingInProgress) {
					setDrawingInProgress({
						id: Date.now().toString(),
						type: activeTool,
						points: [{ x, y, price, candleIdx }],
						color: drawingColor,
					});
				} else if (drawingInProgress.points.length < 2) {
					setDrawingInProgress({
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ x, y, price, candleIdx },
						],
					});
				} else {
					const completed: Drawing = {
						...drawingInProgress,
						points: [
							...drawingInProgress.points,
							{ x, y, price, candleIdx },
						],
					};
					setDrawings((prev) => [...prev, completed]);
					setDrawingInProgress(null);
				}
				return;
			}
		},
		[
			activeTool,
			chartState,
			drawingInProgress,
			drawingColor,
			getChartMetrics,
			getPriceAtY,
			getIndexAtX,
		],
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
		setMousePos({ x: -1, y: -1 });
	}, []);

	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		// Hold Shift for pan, otherwise zoom
		if (e.shiftKey) {
			// Pan horizontally when Shift is held
			const panSpeed = 1.5;
			const delta = -e.deltaY * panSpeed;

			setChartState((prev) => ({
				...prev,
				offsetX: prev.offsetX + delta,
			}));
		} else {
			// Zoom behavior (default)
			const mx = e.clientX - rect.left;
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
	}, []);

	// Escape key to cancel drawing, Delete to remove selected
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setDrawingInProgress(null);
				setSelectedDrawingId(null);
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedDrawingId) {
					setDrawings((prev) =>
						prev.filter((d) => d.id !== selectedDrawingId),
					);
					setSelectedDrawingId(null);
				}
			}
			if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
				setDrawings((prev) => prev.slice(0, -1));
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedDrawingId]);

	// Prevent page scroll when mouse is over the chart component
	useEffect(() => {
		const chartRoot = chartRootRef.current;
		if (!chartRoot) return;

		const handleWheel = (e: WheelEvent) => {
			// Only prevent default to stop page scroll, but let the event bubble to canvas handler
			e.preventDefault();
		};

		// Add listener with passive: false to allow preventDefault
		chartRoot.addEventListener("wheel", handleWheel, { passive: false });
		return () => chartRoot.removeEventListener("wheel", handleWheel);
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
		});
	}, [candles.length, dims.w]);

	const clearDrawings = useCallback(() => {
		setDrawings([]);
		setDrawingInProgress(null);
	}, []);

	const undoLastDrawing = useCallback(() => {
		setDrawings((prev) => prev.slice(0, -1));
	}, []);

	const deleteSelectedDrawing = useCallback(() => {
		if (selectedDrawingId) {
			setDrawings((prev) =>
				prev.filter((d) => d.id !== selectedDrawingId),
			);
			setSelectedDrawingId(null);
		}
	}, [selectedDrawingId]);

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
					tip: "Pan / Select",
				},
				{
					id: "crosshair" as DrawingTool,
					icon: Crosshair,
					tip: "Crosshair",
				},
			],
		},
		{
			label: "Lines",
			tools: [
				{
					id: "trendline" as DrawingTool,
					icon: TrendingUp,
					tip: "Trend Line",
				},
				{
					id: "ray" as DrawingTool,
					icon: ArrowUpRight,
					tip: "Ray (infinite one direction)",
				},
				{
					id: "extended" as DrawingTool,
					icon: Slash,
					tip: "Extended Line (infinite)",
				},
				{
					id: "hline" as DrawingTool,
					icon: Minus,
					tip: "Horizontal Line",
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
				{ id: "rect" as DrawingTool, icon: Square, tip: "Rectangle" },
				{ id: "ellipse" as DrawingTool, icon: Circle, tip: "Ellipse" },
			],
		},
		{
			label: "Advanced",
			tools: [
				{
					id: "fibonacci" as DrawingTool,
					icon: Activity,
					tip: "Fibonacci Retracement",
				},
				{
					id: "pitchfork" as DrawingTool,
					icon: GitFork,
					tip: "Andrews Pitchfork (3 points)",
				},
				{
					id: "channel" as DrawingTool,
					icon: Triangle,
					tip: "Parallel Channel (3 points)",
				},
				{
					id: "measure" as DrawingTool,
					icon: Ruler,
					tip: "Price Range / Measure",
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
			style={{ height }}
		>
			{/* Toolbar */}
			{showToolbar && (
				<div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 bg-black/40 flex-shrink-0 flex-wrap">
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
								}}
								title={id}
								className={cn(
									"p-1.5 rounded transition-all",
									activeTool === id
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
							activeTool === "cursor"
								? isDragging
									? "grabbing"
									: "grab"
								: "crosshair",
					}}
					onMouseMove={handleMouseMove}
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onWheel={handleWheel}
				/>

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
