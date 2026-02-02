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

interface RectPoint {
  time: Time;
  price: number;
}

export interface RectangleOptions {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fillOpacity: number;
}

const defaultOptions: RectangleOptions = {
  fillColor: "rgba(0, 255, 136, 0.1)",
  strokeColor: "#00ff88",
  strokeWidth: 1,
  fillOpacity: 0.2,
};

class RectanglePaneRenderer {
  _p1: ViewPoint;
  _p2: ViewPoint;
  _options: RectangleOptions;

  constructor(p1: ViewPoint, p2: ViewPoint, options: RectangleOptions) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
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
      const x1 = Math.round(this._p1.x * scope.horizontalPixelRatio);
      const y1 = Math.round(this._p1.y * scope.verticalPixelRatio);
      const x2 = Math.round(this._p2.x * scope.horizontalPixelRatio);
      const y2 = Math.round(this._p2.y * scope.verticalPixelRatio);

      const width = x2 - x1;
      const height = y2 - y1;

      // Fill
      ctx.fillStyle = this._options.fillColor;
      ctx.globalAlpha = this._options.fillOpacity;
      ctx.fillRect(x1, y1, width, height);
      ctx.globalAlpha = 1;

      // Stroke
      ctx.strokeStyle = this._options.strokeColor;
      ctx.lineWidth = this._options.strokeWidth;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, y1, width, height);

      // Corner handles
      const handleSize = 6 * scope.horizontalPixelRatio;
      ctx.fillStyle = this._options.strokeColor;
      
      // Top-left
      ctx.fillRect(x1 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
      // Top-right
      ctx.fillRect(x2 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
      // Bottom-left
      ctx.fillRect(x1 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
      // Bottom-right
      ctx.fillRect(x2 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
    });
  }
}

class RectanglePaneView {
  _source: Rectangle;
  _p1: ViewPoint = { x: null, y: null };
  _p2: ViewPoint = { x: null, y: null };

  constructor(source: Rectangle) {
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
    return new RectanglePaneRenderer(this._p1, this._p2, this._source._options);
  }
}

export class Rectangle implements ISeriesPrimitive<Time> {
  _chart: IChartApi;
  _series: ISeriesApi<SeriesType>;
  _p1: RectPoint;
  _p2: RectPoint;
  _paneViews: RectanglePaneView[];
  _options: RectangleOptions;
  _id: string;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    p1: RectPoint,
    p2: RectPoint,
    options?: Partial<RectangleOptions>
  ) {
    this._chart = chart;
    this._series = series;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...defaultOptions, ...options };
    this._paneViews = [new RectanglePaneView(this)];
    this._id = `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    return {
      priceRange: {
        minValue: Math.min(this._p1.price, this._p2.price),
        maxValue: Math.max(this._p1.price, this._p2.price),
      },
    };
  }

  updateAllViews() {
    this._paneViews.forEach((pw) => pw.update());
  }

  paneViews() {
    return this._paneViews;
  }

  updatePoints(p1: RectPoint, p2: RectPoint) {
    this._p1 = p1;
    this._p2 = p2;
  }

  updateOptions(options: Partial<RectangleOptions>) {
    this._options = { ...this._options, ...options };
  }
}
