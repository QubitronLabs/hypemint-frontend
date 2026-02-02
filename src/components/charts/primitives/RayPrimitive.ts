import {
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type Time,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type PrimitiveHoveredItem,
} from "lightweight-charts";

interface Point {
  time: Time;
  price: number;
}

interface RayOptions {
  lineColor?: string;
  width?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
}

class RayPaneRenderer implements IPrimitivePaneRenderer {
  private _points: { x: number; y: number }[];
  private _options: Required<RayOptions>;
  private _direction: "right" | "left";

  constructor(
    points: { x: number; y: number }[],
    options: Required<RayOptions>,
    direction: "right" | "left"
  ) {
    this._points = points;
    this._options = options;
    this._direction = direction;
  }

  draw(target: any): void {
    const ctx = target.context;
    if (this._points.length < 2) return;

    const [p1, p2] = this._points;
    
    ctx.save();
    ctx.strokeStyle = this._options.lineColor;
    ctx.lineWidth = this._options.width;
    
    if (this._options.lineStyle === "dashed") {
      ctx.setLineDash([5, 5]);
    } else if (this._options.lineStyle === "dotted") {
      ctx.setLineDash([2, 2]);
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    
    // Calculate slope and extend line
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const extendFactor = 1000;
    
    if (this._direction === "right") {
      ctx.lineTo(p2.x + dx * extendFactor, p2.y + dy * extendFactor);
    } else {
      ctx.lineTo(p1.x - dx * extendFactor, p1.y - dy * extendFactor);
    }
    
    ctx.stroke();
    ctx.restore();
  }
}

class RayPaneView implements IPrimitivePaneView {
  private _source: Ray;
  private _points: { x: number; y: number }[] = [];

  constructor(source: Ray) {
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
    return new RayPaneRenderer(this._points, this._source.options, "right");
  }
}

export class Ray implements ISeriesPrimitive<Time> {
  private _chart: IChartApi;
  private _series: ISeriesApi<"Candlestick">;
  private _p1: Point;
  private _p2: Point;
  private _options: Required<RayOptions>;
  private _paneViews: RayPaneView[];

  constructor(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    p1: Point,
    p2: Point,
    options?: RayOptions
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._options = {
      lineColor: options?.lineColor ?? "#2196f3",
      width: options?.width ?? 2,
      lineStyle: options?.lineStyle ?? "solid",
    };
    this._paneViews = [new RayPaneView(this)];
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

  get options(): Required<RayOptions> {
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
