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

export interface HorizontalLineOptions {
  lineColor: string;
  width: number;
  showLabel: boolean;
  labelBackgroundColor: string;
  labelTextColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
  labelPosition: "left" | "right";
}

const defaultOptions: HorizontalLineOptions = {
  lineColor: "#ff9800",
  width: 1,
  showLabel: true,
  labelBackgroundColor: "rgba(255, 152, 0, 0.9)",
  labelTextColor: "#000000",
  lineStyle: "dashed",
  labelPosition: "right",
};

class HorizontalLinePaneRenderer {
  _y: Coordinate | null;
  _price: number;
  _options: HorizontalLineOptions;
  _chartWidth: number;

  constructor(
    y: Coordinate | null,
    price: number,
    options: HorizontalLineOptions,
    chartWidth: number
  ) {
    this._y = y;
    this._price = price;
    this._options = options;
    this._chartWidth = chartWidth;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      if (this._y === null) return;

      const ctx = scope.context;
      const yScaled = Math.round(this._y * scope.verticalPixelRatio);
      const chartWidth = this._chartWidth * scope.horizontalPixelRatio;

      ctx.lineWidth = this._options.width;
      ctx.strokeStyle = this._options.lineColor;

      // Set line style
      if (this._options.lineStyle === "dashed") {
        ctx.setLineDash([6, 4]);
      } else if (this._options.lineStyle === "dotted") {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(0, yScaled);
      ctx.lineTo(chartWidth, yScaled);
      ctx.stroke();

      // Draw label
      if (this._options.showLabel) {
        const label = this._price.toFixed(8);
        ctx.font = `${11 * scope.verticalPixelRatio}px Inter, monospace`;
        const textWidth = ctx.measureText(label).width;
        const padding = 6 * scope.horizontalPixelRatio;
        const labelHeight = 16 * scope.verticalPixelRatio;

        const x =
          this._options.labelPosition === "right"
            ? chartWidth - textWidth - padding * 2
            : padding;

        ctx.fillStyle = this._options.labelBackgroundColor;
        ctx.beginPath();
        ctx.roundRect(
          x,
          yScaled - labelHeight / 2,
          textWidth + padding * 2,
          labelHeight,
          3
        );
        ctx.fill();

        ctx.fillStyle = this._options.labelTextColor;
        ctx.fillText(label, x + padding, yScaled + 4 * scope.verticalPixelRatio);
      }
    });
  }
}

class HorizontalLinePaneView {
  _source: HorizontalLine;
  _y: Coordinate | null = null;

  constructor(source: HorizontalLine) {
    this._source = source;
  }

  update() {
    this._y = this._source._series.priceToCoordinate(this._source._price);
  }

  renderer() {
    return new HorizontalLinePaneRenderer(
      this._y,
      this._source._price,
      this._source._options,
      this._source._chart.timeScale().width()
    );
  }
}

export class HorizontalLine implements ISeriesPrimitive<Time> {
  _chart: IChartApi;
  _series: ISeriesApi<SeriesType>;
  _price: number;
  _paneViews: HorizontalLinePaneView[];
  _options: HorizontalLineOptions;
  _id: string;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    price: number,
    options?: Partial<HorizontalLineOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._price = price;
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new HorizontalLinePaneView(this)];
    this._id = `hline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    return {
      priceRange: {
        minValue: this._price,
        maxValue: this._price,
      },
    };
  }

  updateAllViews() {
    this._paneViews.forEach((pw) => pw.update());
  }

  paneViews() {
    return this._paneViews;
  }

  updatePrice(price: number) {
    this._price = price;
  }

  updateOptions(options: Partial<HorizontalLineOptions>) {
    this._options = { ...this._options, ...options };
  }
}
