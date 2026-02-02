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

interface ArrowOptions {
  lineColor?: string;
  width?: number;
  headSize?: number;
}

class ArrowPaneRenderer implements IPrimitivePaneRenderer {
  private _points: { x: number; y: number }[];
  private _options: Required<ArrowOptions>;

  constructor(points: { x: number; y: number }[], options: Required<ArrowOptions>) {
    this._points = points;
    this._options = options;
  }

  draw(target: any): void {
    const ctx = target.context;
    if (this._points.length < 2) return;

    const [p1, p2] = this._points;
    
    ctx.save();
    ctx.strokeStyle = this._options.lineColor;
    ctx.fillStyle = this._options.lineColor;
    ctx.lineWidth = this._options.width;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const headSize = this._options.headSize;

    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(
      p2.x - headSize * Math.cos(angle - Math.PI / 6),
      p2.y - headSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      p2.x - headSize * Math.cos(angle + Math.PI / 6),
      p2.y - headSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

class ArrowPaneView implements IPrimitivePaneView {
  private _source: Arrow;
  private _points: { x: number; y: number }[] = [];

  constructor(source: Arrow) {
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
      this._points = [];
      return;
    }

    this._points = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new ArrowPaneRenderer(this._points, this._source.options);
  }
}

export class Arrow implements ISeriesPrimitive<Time> {
  private _chart: IChartApi;
  private _series: ISeriesApi<"Candlestick">;
  private _p1: Point;
  private _p2: Point;
  private _options: Required<ArrowOptions>;
  private _paneViews: ArrowPaneView[];

  constructor(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    p1: Point,
    p2: Point,
    options?: ArrowOptions
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._options = {
      lineColor: options?.lineColor ?? "#ff9800",
      width: options?.width ?? 2,
      headSize: options?.headSize ?? 10,
    };
    this._paneViews = [new ArrowPaneView(this)];
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

  get options(): Required<ArrowOptions> {
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
