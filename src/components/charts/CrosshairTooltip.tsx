"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { IChartApi, MouseEventParams, Time } from "lightweight-charts";
import { cn } from "@/lib/utils";

interface CrosshairTooltipProps {
  chart: IChartApi | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  formatPrice?: (price: number) => string;
  formatVolume?: (volume: number) => string;
}

interface TooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

export function CrosshairTooltip({
  chart,
  containerRef,
  className,
  formatPrice = (p) => p.toFixed(8),
  formatVolume = (v) => v.toLocaleString(),
}: CrosshairTooltipProps) {
  const [data, setData] = useState<TooltipData | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!chart) return;

    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!param.point || !param.time) {
        setVisible(false);
        return;
      }

      // Get candlestick data from the series
      const seriesData = param.seriesData;
      if (!seriesData || seriesData.size === 0) {
        setVisible(false);
        return;
      }

      // Get the first series data (candlestick)
      const candleData = seriesData.entries().next().value;
      if (!candleData || !candleData[1]) {
        setVisible(false);
        return;
      }

      const candle = candleData[1] as any;
      if (!candle.open || !candle.close) {
        setVisible(false);
        return;
      }

      const change = candle.close - candle.open;
      const changePercent = (change / candle.open) * 100;

      // Format time
      const timeValue = param.time as number;
      const date = new Date(timeValue * 1000);
      const timeStr = date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      setData({
        time: timeStr,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        change,
        changePercent,
      });

      // Position tooltip
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const x = Math.min(
          param.point.x + 15,
          containerRect.width - 180
        );
        const y = Math.max(param.point.y - 100, 10);
        setPosition({ x, y });
      }

      setVisible(true);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [chart, containerRef, formatPrice]);

  if (!visible || !data) return null;

  const isPositive = data.change >= 0;

  return (
    <div
      className={cn(
        "absolute z-20 pointer-events-none bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2.5 min-w-[160px]",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="text-xs text-muted-foreground mb-1.5">{data.time}</div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">O:</span>
          <span className="font-mono">{formatPrice(data.open)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">H:</span>
          <span className="font-mono text-[#00ff88]">{formatPrice(data.high)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">L:</span>
          <span className="font-mono text-destructive">{formatPrice(data.low)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">C:</span>
          <span className={cn("font-mono", isPositive ? "text-[#00ff88]" : "text-destructive")}>
            {formatPrice(data.close)}
          </span>
        </div>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Change:</span>
        <span
          className={cn(
            "text-xs font-medium",
            isPositive ? "text-[#00ff88]" : "text-destructive"
          )}
        >
          {isPositive ? "+" : ""}
          {data.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default CrosshairTooltip;
