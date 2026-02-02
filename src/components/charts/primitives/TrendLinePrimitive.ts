import type {
  AutoscaleInfo,
  Coordinate,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesType,
  Time,
} from "lightweight-charts";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

interface Point {
  time: Time;
  price: number;
}

export interface TrendLineOptions {
  lineColor: string;
  width: number;
  showLabels: boolean;
  labelBackgroundColor: string;
  labelTextColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
  extendLeft: boolean;
  extendRight: boolean;
}

const defaultOptions: TrendLineOptions = {
  lineColor: "#00ff88",
  width: 2,
  showLabels: true,
  labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
  labelTextColor: "#ffffff",
  lineStyle: "solid",
  extendLeft: false,
  extendRight: false,
};

class TrendLinePaneRenderer {
  _p1: ViewPoint;
  _p2: ViewPoint;
  _text1: string;
  _text2: string;
  _options: TrendLineOptions;
  _chartWidth: number;

  constructor(
    p1: ViewPoint,
    p2: ViewPoint,
    text1: string,
    text2: string,
    options: TrendLineOptions,
    chartWidth: number
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._text1 = text1;
    this._text2 = text2;
    this._options = options;
    this._chartWidth = chartWidth;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      if (
        this._p1.x === null ||
        this._p1.y === null ||
        this._p2.x === null ||
        this._p2.y === null
      )
        return;

      const ctx = scope.context;
      const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2Scaled = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2Scaled = Math.round(this._p2.y * scope.verticalPixelRatio);

      ctx.lineWidth = this._options.width;
      ctx.strokeStyle = this._options.lineColor;

      // Set line style
      if (this._options.lineStyle === "dashed") {
        ctx.setLineDash([8, 4]);
      } else if (this._options.lineStyle === "dotted") {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();

      // Calculate extended points if needed
      let startX = x1Scaled;
      let startY = y1Scaled;
      let endX = x2Scaled;
      let endY = y2Scaled;

      if (this._options.extendLeft || this._options.extendRight) {
        const slope = (y2Scaled - y1Scaled) / (x2Scaled - x1Scaled);
        const chartWidth = this._chartWidth * scope.horizontalPixelRatio;

        if (this._options.extendLeft) {
          startX = 0;
          startY = y1Scaled - slope * x1Scaled;
        }
        if (this._options.extendRight) {
          endX = chartWidth;
          endY = y2Scaled + slope * (chartWidth - x2Scaled);
        }
      }

      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw anchor points
      ctx.fillStyle = this._options.lineColor;
      ctx.beginPath();
      ctx.arc(x1Scaled, y1Scaled, 4 * scope.horizontalPixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2Scaled, y2Scaled, 4 * scope.horizontalPixelRatio, 0, Math.PI * 2);
      ctx.fill();

      // Draw labels
      if (this._options.showLabels) {
        this._drawTextLabel(scope, this._text1, x1Scaled, y1Scaled, true);
        this._drawTextLabel(scope, this._text2, x2Scaled, y2Scaled, false);
      }
    });
  }

  _drawTextLabel(
    scope: any,
    text: string,
    x: number,
    y: number,
    left: boolean
  ) {
    const ctx = scope.context;
    ctx.font = `${12 * scope.verticalPixelRatio}px Inter, sans-serif`;
    const offset = 5 * scope.horizontalPixelRatio;
    const textWidth = ctx.measureText(text);
    const leftAdjustment = left ? textWidth.width + offset * 4 : 0;

    ctx.fillStyle = this._options.labelBackgroundColor;
    ctx.beginPath();
    ctx.roundRect(
      x + offset - leftAdjustment,
      y - 16 * scope.verticalPixelRatio,
      textWidth.width + offset * 2,
      18 * scope.verticalPixelRatio,
      4
    );
    ctx.fill();

    ctx.fillStyle = this._options.labelTextColor;
    ctx.fillText(text, x + offset * 2 - leftAdjustment, y - 4 * scope.verticalPixelRatio);
  }
}

class TrendLinePaneView {
  _source: TrendLine;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };

  constructor(source: TrendLine) {
    this._source = source;
  }

  update() {
    const series = this._source._series;
    const y1 = series.priceToCoordinate(this._source._p1.price);
    const y2 = series.priceToCoordinate(this._source._p2.price);
    const timeScale = this._source._chart.timeScale();
    const x1 = timeScale.timeToCoordinate(this._source._p1.time);
    const x2 = timeScale.timeToCoordinate(this._source._p2.time);
    this._p1 = { x: x1, y: y1 };
    this._p2 = { x: x2, y: y2 };
  }

  renderer() {
    return new TrendLinePaneRenderer(
      this._p1,
      this._p2,
      this._source._p1.price.toFixed(6),
      this._source._p2.price.toFixed(6),
      this._source._options,
      this._source._chart.timeScale().width()
    );
  }
}

export class TrendLine implements ISeriesPrimitive<Time> {
  _chart: IChartApi;
  _series: ISeriesApi<SeriesType>;
  _p1: Point;
  _p2: Point;
  _paneViews: TrendLinePaneView[];
  _options: TrendLineOptions;
  _minPrice: number;
  _maxPrice: number;
  _id: string;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    p1: Point,
    p2: Point,
    options?: Partial<TrendLineOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._minPrice = Math.min(this._p1.price, this._p2.price);
    this._maxPrice = Math.max(this._p1.price, this._p2.price);
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new TrendLinePaneView(this)];
    this._id = `trendline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    const p1Index = this._pointIndex(this._p1);
    const p2Index = this._pointIndex(this._p2);
    if (p1Index === null || p2Index === null) return null;
    if (endTimePoint < p1Index || startTimePoint > p2Index) return null;
    return {
      priceRange: {
        minValue: this._minPrice,
        maxValue: this._maxPrice,
      },
    };
  }

  updateAllViews() {
    this._paneViews.forEach((pw) => pw.update());
  }

  paneViews() {
    return this._paneViews;
  }

  updatePoints(p1: Point, p2: Point) {
    this._p1 = p1;
    this._p2 = p2;
    this._minPrice = Math.min(this._p1.price, this._p2.price);
    this._maxPrice = Math.max(this._p1.price, this._p2.price);
  }

  updateOptions(options: Partial<TrendLineOptions>) {
    this._options = { ...this._options, ...options };
  }

  _pointIndex(p: Point): number | null {
    const coordinate = this._chart.timeScale().timeToCoordinate(p.time);
    if (coordinate === null) return null;
    const index = this._chart.timeScale().coordinateToLogical(coordinate);
    return index;
  }
}
