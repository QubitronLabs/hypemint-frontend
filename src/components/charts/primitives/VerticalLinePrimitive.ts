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

export interface VerticalLineOptions {
  lineColor: string;
  width: number;
  showLabel: boolean;
  labelBackgroundColor: string;
  labelTextColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
}

const defaultOptions: VerticalLineOptions = {
  lineColor: "#2962ff",
  width: 1,
  showLabel: true,
  labelBackgroundColor: "rgba(41, 98, 255, 0.9)",
  labelTextColor: "#ffffff",
  lineStyle: "dashed",
};

class VerticalLinePaneRenderer {
  _x: Coordinate | null;
  _time: Time;
  _options: VerticalLineOptions;
  _chartHeight: number;

  constructor(
    x: Coordinate | null,
    time: Time,
    options: VerticalLineOptions,
    chartHeight: number
  ) {
    this._x = x;
    this._time = time;
    this._options = options;
    this._chartHeight = chartHeight;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      if (this._x === null) return;

      const ctx = scope.context;
      const xScaled = Math.round(this._x * scope.horizontalPixelRatio);
      const chartHeight = this._chartHeight * scope.verticalPixelRatio;

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
      ctx.moveTo(xScaled, 0);
      ctx.lineTo(xScaled, chartHeight);
      ctx.stroke();

      // Draw label
      if (this._options.showLabel) {
        const timeValue = this._time as number;
        const date = new Date(timeValue * 1000);
        const label = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        ctx.font = `${11 * scope.verticalPixelRatio}px Inter, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const padding = 6 * scope.horizontalPixelRatio;
        const labelHeight = 16 * scope.verticalPixelRatio;

        ctx.fillStyle = this._options.labelBackgroundColor;
        ctx.beginPath();
        ctx.roundRect(
          xScaled - textWidth / 2 - padding,
          chartHeight - labelHeight - 5 * scope.verticalPixelRatio,
          textWidth + padding * 2,
          labelHeight,
          3
        );
        ctx.fill();

        ctx.fillStyle = this._options.labelTextColor;
        ctx.textAlign = "center";
        ctx.fillText(
          label,
          xScaled,
          chartHeight - 9 * scope.verticalPixelRatio
        );
      }
    });
  }
}

class VerticalLinePaneView {
  _source: VerticalLine;
  _x: Coordinate | null = null;

  constructor(source: VerticalLine) {
    this._source = source;
  }

  update() {
    this._x = this._source._chart.timeScale().timeToCoordinate(this._source._time);
  }

  renderer() {
    // Get chart height from the pane
    const pane = this._source._chart.panes()[0];
    const height = pane ? 400 : 400; // Default height

    return new VerticalLinePaneRenderer(
      this._x,
      this._source._time,
      this._source._options,
      height
    );
  }
}

export class VerticalLine implements ISeriesPrimitive<Time> {
  _chart: IChartApi;
  _series: ISeriesApi<SeriesType>;
  _time: Time;
  _paneViews: VerticalLinePaneView[];
  _options: VerticalLineOptions;
  _id: string;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    time: Time,
    options?: Partial<VerticalLineOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._time = time;
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new VerticalLinePaneView(this)];
    this._id = `vline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    return null;
  }

  updateAllViews() {
    this._paneViews.forEach((pw) => pw.update());
  }

  paneViews() {
    return this._paneViews;
  }

  updateTime(time: Time) {
    this._time = time;
  }

  updateOptions(options: Partial<VerticalLineOptions>) {
    this._options = { ...this._options, ...options };
  }
}
