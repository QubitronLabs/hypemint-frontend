"use client";

import { useState, useCallback } from "react";
import {
  TrendingUp,
  Minus,
  Square,
  Activity,
  ChevronDown,
  Settings,
  MousePointer2,
  Crosshair,
  Trash2,
  Eye,
  EyeOff,
  Palette,
  RotateCcw,
  Maximize2,
  Camera,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  type IndicatorType,
  getIndicatorDisplayName,
  indicatorDefaults,
} from "./indicators";

export type DrawingTool =
  | "cursor"
  | "crosshair"
  | "trendline"
  | "horizontalline"
  | "rectangle"
  | "fibonacci";

export interface ActiveIndicator {
  id: string;
  type: IndicatorType;
  period: number;
  color: string;
  visible: boolean;
}

interface ChartToolbarProps {
  className?: string;
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (type: IndicatorType) => void;
  onRemoveIndicator: (id: string) => void;
  onToggleIndicator: (id: string) => void;
  onClearDrawings: () => void;
  onResetChart: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitContent: () => void;
  onScreenshot: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

const drawingTools: { tool: DrawingTool; label: string; icon: React.ReactNode }[] = [
  { tool: "cursor", label: "Cursor", icon: <MousePointer2 className="h-4 w-4" /> },
  { tool: "crosshair", label: "Crosshair", icon: <Crosshair className="h-4 w-4" /> },
  { tool: "trendline", label: "Trend Line", icon: <TrendingUp className="h-4 w-4" /> },
  { tool: "horizontalline", label: "Horizontal Line", icon: <Minus className="h-4 w-4" /> },
  { tool: "rectangle", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
  { tool: "fibonacci", label: "Fibonacci Retracement", icon: <Activity className="h-4 w-4" /> },
];

const indicatorCategories = {
  "Moving Averages": ["sma", "ema", "wma", "vwma"] as IndicatorType[],
  Oscillators: ["rsi", "macd", "stochastic", "williams", "cci"] as IndicatorType[],
  Volatility: ["bollinger", "atr", "keltner"] as IndicatorType[],
  Volume: ["vwap", "obv"] as IndicatorType[],
  Trend: ["adx", "psar", "ichimoku"] as IndicatorType[],
  Momentum: ["momentum", "roc"] as IndicatorType[],
};

export function ChartToolbar({
  className,
  activeTool,
  onToolChange,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  onClearDrawings,
  onResetChart,
  onZoomIn,
  onZoomOut,
  onFitContent,
  onScreenshot,
  onToggleFullscreen,
  isFullscreen,
}: ChartToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  const getToolIcon = (tool: DrawingTool) => {
    const found = drawingTools.find((t) => t.tool === tool);
    return found?.icon || <MousePointer2 className="h-4 w-4" />;
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-1 p-1.5 bg-muted/50 border-b border-border",
          className
        )}
      >
        {/* Drawing Tools Section */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
          {drawingTools.slice(0, 2).map(({ tool, label, icon }) => (
            <Tooltip key={tool}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    activeTool === tool && "bg-primary/20 text-primary"
                  )}
                  onClick={() => onToolChange(tool)}
                >
                  {icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Drawing Tools Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-1.5 gap-0.5",
                      ["trendline", "horizontalline", "rectangle", "fibonacci"].includes(
                        activeTool
                      ) && "bg-primary/20 text-primary"
                    )}
                  >
                    {getToolIcon(
                      ["trendline", "horizontalline", "rectangle", "fibonacci"].includes(
                        activeTool
                      )
                        ? activeTool
                        : "trendline"
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Drawing Tools</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {drawingTools.slice(2).map(({ tool, label, icon }) => (
                <DropdownMenuItem
                  key={tool}
                  onClick={() => onToolChange(tool)}
                  className={cn(
                    "gap-2",
                    activeTool === tool && "bg-primary/10 text-primary"
                  )}
                >
                  {icon}
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Indicators Section */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Indicators</span>
                    {activeIndicators.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
                        {activeIndicators.length}
                      </span>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Technical Indicators</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-[280px]">
              {/* Active Indicators */}
              {activeIndicators.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Active Indicators
                  </div>
                  {activeIndicators.map((indicator) => (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: indicator.color }}
                        />
                        <span className="text-sm">
                          {getIndicatorDisplayName(indicator.type)}
                          {indicator.period > 0 && ` (${indicator.period})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onToggleIndicator(indicator.id)}
                        >
                          {indicator.visible ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onRemoveIndicator(indicator.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Add Indicators by Category */}
              {Object.entries(indicatorCategories).map(([category, indicators]) => (
                <DropdownMenuSub key={category}>
                  <DropdownMenuSubTrigger className="text-sm">
                    {category}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[200px]">
                    {indicators.map((type) => {
                      const isActive = activeIndicators.some((i) => i.type === type);
                      return (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={isActive}
                          onCheckedChange={() => {
                            if (isActive) {
                              const indicator = activeIndicators.find((i) => i.type === type);
                              if (indicator) onRemoveIndicator(indicator.id);
                            } else {
                              onAddIndicator(type);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: indicatorDefaults[type].color }}
                            />
                            <span>{getIndicatorDisplayName(type)}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitContent}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Fit Content</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClearDrawings}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Clear Drawings</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetChart}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Reset Chart</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onScreenshot}>
                <Camera className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Screenshot</p>
            </TooltipContent>
          </Tooltip>

          {onToggleFullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleFullscreen}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ChartToolbar;
