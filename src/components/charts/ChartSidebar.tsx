"use client";

import { useState } from "react";
import {
  MousePointer2,
  Crosshair,
  TrendingUp,
  Minus,
  Square,
  Activity,
  ArrowUpRight,
  Type,
  Circle,
  Triangle,
  PenLine,
  Ruler,
  GitBranch,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Settings,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  type IndicatorType,
  getIndicatorDisplayName,
  indicatorDefaults,
} from "./indicators";

export type DrawingTool =
  | "cursor"
  | "crosshair"
  | "trendline"
  | "horizontalline"
  | "verticalline"
  | "ray"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "fibonacci"
  | "pitchfork"
  | "text"
  | "measure";

export interface ActiveIndicator {
  id: string;
  type: IndicatorType;
  period: number;
  color: string;
  visible: boolean;
}

interface ChartSidebarProps {
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
}

// Tool groups for sidebar
const toolGroups = [
  {
    name: "Selection",
    tools: [
      { tool: "cursor" as DrawingTool, label: "Cursor", icon: MousePointer2, shortcut: "V" },
      { tool: "crosshair" as DrawingTool, label: "Crosshair", icon: Crosshair, shortcut: "C" },
    ],
  },
  {
    name: "Lines",
    tools: [
      { tool: "trendline" as DrawingTool, label: "Trend Line", icon: TrendingUp, shortcut: "T" },
      { tool: "horizontalline" as DrawingTool, label: "Horizontal Line", icon: Minus, shortcut: "H" },
      { tool: "verticalline" as DrawingTool, label: "Vertical Line", icon: Ruler, shortcut: "L" },
      { tool: "ray" as DrawingTool, label: "Ray", icon: ArrowUpRight, shortcut: "R" },
      { tool: "arrow" as DrawingTool, label: "Arrow", icon: PenLine, shortcut: "A" },
    ],
  },
  {
    name: "Shapes",
    tools: [
      { tool: "rectangle" as DrawingTool, label: "Rectangle", icon: Square, shortcut: "S" },
      { tool: "ellipse" as DrawingTool, label: "Ellipse", icon: Circle, shortcut: "E" },
      { tool: "pitchfork" as DrawingTool, label: "Pitchfork", icon: GitBranch, shortcut: "P" },
    ],
  },
  {
    name: "Fibonacci",
    tools: [
      { tool: "fibonacci" as DrawingTool, label: "Fib Retracement", icon: Activity, shortcut: "F" },
    ],
  },
  {
    name: "Annotation",
    tools: [
      { tool: "text" as DrawingTool, label: "Text", icon: Type, shortcut: "X" },
      { tool: "measure" as DrawingTool, label: "Measure", icon: Ruler, shortcut: "M" },
    ],
  },
];

const indicatorCategories = {
  "Moving Averages": ["sma", "ema", "wma", "vwma"] as IndicatorType[],
  Oscillators: ["rsi", "macd", "stochastic", "williams", "cci"] as IndicatorType[],
  Volatility: ["bollinger", "atr", "keltner"] as IndicatorType[],
  Volume: ["vwap", "obv"] as IndicatorType[],
  Trend: ["adx", "psar", "ichimoku"] as IndicatorType[],
  Momentum: ["momentum", "roc"] as IndicatorType[],
};

export function ChartSidebar({
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
}: ChartSidebarProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const isDrawingTool = activeTool !== "cursor" && activeTool !== "crosshair";

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "flex flex-col w-12 bg-card border-r border-border",
          className
        )}
      >
        {/* Tool Groups */}
        <div className="flex-1 py-2 space-y-1 overflow-y-auto scrollbar-hide">
          {toolGroups.map((group) => (
            <div key={group.name} className="px-1">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.tool;
                return (
                  <Tooltip key={tool.tool}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onToolChange(tool.tool)}
                        className={cn(
                          "w-full flex items-center justify-center p-2 rounded-md transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <span>{tool.label}</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded">
                        {tool.shortcut}
                      </kbd>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {group.name !== "Annotation" && (
                <div className="h-px bg-border my-2" />
              )}
            </div>
          ))}
        </div>

        {/* Indicators Dropdown */}
        <div className="border-t border-border p-1">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Layers className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Indicators</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Add Indicator
              </div>
              {Object.entries(indicatorCategories).map(([category, indicators]) => (
                <DropdownMenuSub key={category}>
                  <DropdownMenuSubTrigger>{category}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {indicators.map((type) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => onAddIndicator(type)}
                      >
                        {getIndicatorDisplayName(type)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}

              {activeIndicators.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Active Indicators
                  </div>
                  {activeIndicators.map((indicator) => (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: indicator.color }}
                        />
                        <span className="text-sm">
                          {getIndicatorDisplayName(indicator.type)}
                          {indicator.period > 0 && ` (${indicator.period})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleIndicator(indicator.id)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          {indicator.visible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => onRemoveIndicator(indicator.id)}
                          className="p-1 rounded hover:bg-muted text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="border-t border-border p-1 space-y-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onZoomIn}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom In</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onZoomOut}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom Out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onFitContent}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Fit Content</TooltipContent>
          </Tooltip>

          <div className="h-px bg-border my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClearDrawings}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Clear Drawings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onResetChart}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Reset Chart</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onScreenshot}
                className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Screenshot</TooltipContent>
          </Tooltip>
        </div>

        {/* Drawing Mode Indicator */}
        {isDrawingTool && (
          <div className="p-2 bg-primary/10 border-t border-primary/30">
            <div className="text-[10px] text-center text-primary font-medium">
              Drawing Mode
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ChartSidebar;
