import {
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type Time,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
} from "lightweight-charts";

interface Point {
  time: Time;
  price: number;
}

interface EllipseOptions {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

class EllipsePaneRenderer implements IPrimitivePaneRenderer {
  private _bounds: { x1: number; y1: number; x2: number; y2: number } | null;
  private _options: Required<EllipseOptions>;

  constructor(
    bounds: { x1: number; y1: number; x2: number; y2: number } | null,
    options: Required<EllipseOptions>
  ) {
    this._bounds = bounds;
    this._options = options;
  }

  draw(target: any): void {
    const ctx = target.context;
    if (!this._bounds) return;

    const { x1, y1, x2, y2 } = this._bounds;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;

    ctx.save();
    ctx.fillStyle = this._options.fillColor;
    ctx.strokeStyle = this._options.strokeColor;
    ctx.lineWidth = this._options.strokeWidth;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

class EllipsePaneView implements IPrimitivePaneView {
  private _source: Ellipse;
  private _bounds: { x1: number; y1: number; x2: number; y2: number } | null = null;

  constructor(source: Ellipse) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const chart = this._source.chart;
    const timeScale = chart.timeScale();

    const p1 = this._source.p1;
    const p2 = this._source.p2;

    const x1 = timeScale.timeToCoordinate(p1.time);
    const x2 = timeScale.timeToCoordinate(p2.time);
    const y1 = series.priceToCoordinate(p1.price);
    const y2 = series.priceToCoordinate(p2.price);

    if (x1 === null || x2 === null || y1 === null || y2 === null) {
      this._bounds = null;
      return;
    }

    this._bounds = { x1, y1, x2, y2 };
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new EllipsePaneRenderer(this._bounds, this._source.options);
  }
}

export class Ellipse implements ISeriesPrimitive<Time> {
  private _chart: IChartApi;
  private _series: ISeriesApi<"Candlestick">;
  private _p1: Point;
  private _p2: Point;
  private _options: Required<EllipseOptions>;
  private _paneViews: EllipsePaneView[];

  constructor(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    p1: Point,
    p2: Point,
    options?: EllipseOptions
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._options = {
      fillColor: options?.fillColor ?? "rgba(33, 150, 243, 0.1)",
      strokeColor: options?.strokeColor ?? "#2196f3",
      strokeWidth: options?.strokeWidth ?? 1,
    };
    this._paneViews = [new EllipsePaneView(this)];
  }

  get chart(): IChartApi {
    return this._chart;
  }

  get series(): ISeriesApi<"Candlestick"> {
    return this._series;
  }

  get p1(): Point {
    return this._p1;
  }

  get p2(): Point {
    return this._p2;
  }

  get options(): Required<EllipseOptions> {
    return this._options;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach((pv) => pv.update());
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.updateAllViews();
  }
}
