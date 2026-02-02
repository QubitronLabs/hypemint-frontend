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

interface FibPoint {
  time: Time;
  price: number;
}

export interface FibonacciOptions {
  lineColor: string;
  lineWidth: number;
  showLabels: boolean;
  showPrices: boolean;
  levels: number[];
  colors: string[];
  fillOpacity: number;
}

const defaultOptions: FibonacciOptions = {
  lineColor: "#888888",
  lineWidth: 1,
  showLabels: true,
  showPrices: true,
  levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618],
  colors: [
    "#787b86",
    "#f23645",
    "#ff9800",
    "#ffeb3b",
    "#4caf50",
    "#089981",
    "#00bcd4",
    "#2962ff",
    "#673ab7",
  ],
  fillOpacity: 0.05,
};

class FibonacciPaneRenderer {
  _p1: ViewPoint;
  _p2: ViewPoint;
  _price1: number;
  _price2: number;
  _options: FibonacciOptions;
  _chartWidth: number;

  constructor(
    p1: ViewPoint,
    p2: ViewPoint,
    price1: number,
    price2: number,
    options: FibonacciOptions,
    chartWidth: number
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._price1 = price1;
    this._price2 = price2;
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
      const y1 = Math.round(this._p1.y * scope.verticalPixelRatio);
      const y2 = Math.round(this._p2.y * scope.verticalPixelRatio);
      const chartWidth = this._chartWidth * scope.horizontalPixelRatio;

      const priceRange = this._price2 - this._price1;
      const yRange = y2 - y1;

      ctx.lineWidth = this._options.lineWidth;
      ctx.setLineDash([]);

      // Draw each Fibonacci level
      this._options.levels.forEach((level, index) => {
        const levelY = y1 + yRange * level;
        const levelPrice = this._price1 + priceRange * level;
        const color = this._options.colors[index] || this._options.lineColor;

        // Draw level line
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, levelY);
        ctx.lineTo(chartWidth, levelY);
        ctx.stroke();

        // Draw fill between levels
        if (index > 0) {
          const prevLevelY = y1 + yRange * this._options.levels[index - 1];
          const prevColor = this._options.colors[index - 1] || this._options.lineColor;
          
          ctx.fillStyle = prevColor;
          ctx.globalAlpha = this._options.fillOpacity;
          ctx.fillRect(0, prevLevelY, chartWidth, levelY - prevLevelY);
          ctx.globalAlpha = 1;
        }

        // Draw label
        if (this._options.showLabels) {
          const labelText = this._options.showPrices
            ? `${(level * 100).toFixed(1)}% (${levelPrice.toFixed(8)})`
            : `${(level * 100).toFixed(1)}%`;

          ctx.font = `${10 * scope.verticalPixelRatio}px Inter, monospace`;
          const textWidth = ctx.measureText(labelText).width;
          const padding = 4 * scope.horizontalPixelRatio;
          const labelHeight = 14 * scope.verticalPixelRatio;

          // Background
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.beginPath();
          ctx.roundRect(
            chartWidth - textWidth - padding * 3,
            levelY - labelHeight / 2,
            textWidth + padding * 2,
            labelHeight,
            2
          );
          ctx.fill();

          // Text
          ctx.fillStyle = color;
          ctx.fillText(
            labelText,
            chartWidth - textWidth - padding * 2,
            levelY + 3 * scope.verticalPixelRatio
          );
        }
      });

      // Draw anchor points
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(
        Math.round(this._p1.x * scope.horizontalPixelRatio),
        y1,
        5 * scope.horizontalPixelRatio,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        Math.round(this._p2.x * scope.horizontalPixelRatio),
        y2,
        5 * scope.horizontalPixelRatio,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }
}

class FibonacciPaneView {
  _source: Fibonacci;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };

  constructor(source: Fibonacci) {
    this._source = source;
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();

    this._p1 = {
      x: timeScale.timeToCoordinate(this._source._p1.time),
      y: series.priceToCoordinate(this._source._p1.price),
    };
    this._p2 = {
      x: timeScale.timeToCoordinate(this._source._p2.time),
      y: series.priceToCoordinate(this._source._p2.price),
    };
  }

  renderer() {
    return new FibonacciPaneRenderer(
      this._p1,
      this._p2,
      this._source._p1.price,
      this._source._p2.price,
      this._source._options,
      this._source._chart.timeScale().width()
    );
  }
}

export class Fibonacci implements ISeriesPrimitive<Time> {
  _chart: IChartApi;
  _series: ISeriesApi<SeriesType>;
  _p1: FibPoint;
  _p2: FibPoint;
  _paneViews: FibonacciPaneView[];
  _options: FibonacciOptions;
  _id: string;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    p1: FibPoint,
    p2: FibPoint,
    options?: Partial<FibonacciOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new FibonacciPaneView(this)];
    this._id = `fib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    const priceRange = this._p2.price - this._p1.price;
    const maxLevel = Math.max(...this._options.levels);
    const minLevel = Math.min(...this._options.levels);

    return {
      priceRange: {
        minValue: this._p1.price + priceRange * minLevel,
        maxValue: this._p1.price + priceRange * maxLevel,
      },
    };
  }

  updateAllViews() {
    this._paneViews.forEach((pw) => pw.update());
  }

  paneViews() {
    return this._paneViews;
  }

  updatePoints(p1: FibPoint, p2: FibPoint) {
    this._p1 = p1;
    this._p2 = p2;
  }

  updateOptions(options: Partial<FibonacciOptions>) {
    this._options = { ...this._options, ...options };
  }
}
