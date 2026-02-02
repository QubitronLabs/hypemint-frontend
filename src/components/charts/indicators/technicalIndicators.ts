/**
 * Technical Indicators Library
 * 
 * Contains various technical analysis indicators for price charts:
 * - Moving Averages (SMA, EMA, WMA)
 * - Oscillators (RSI, Stochastic, MACD)
 * - Volatility (Bollinger Bands, ATR)
 * - Volume (VWAP, OBV)
 */

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorValue {
  time: number;
  value: number;
}

export interface MACDValue {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsValue {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface StochasticValue {
  time: number;
  k: number;
  d: number;
}

export interface IchimokuValue {
  time: number;
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
}

// =============================================================================
// MOVING AVERAGES
// =============================================================================

/**
 * Simple Moving Average
 */
export function calculateSMA(data: CandleData[], period: number): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  return result;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: CandleData[], period: number): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  // Start with SMA for the first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

/**
 * Weighted Moving Average
 */
export function calculateWMA(data: CandleData[], period: number): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  const denominator = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close * (period - j);
    }
    result.push({
      time: data[i].time,
      value: sum / denominator,
    });
  }
  return result;
}

/**
 * Volume Weighted Moving Average
 */
export function calculateVWMA(data: CandleData[], period: number): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sumPriceVolume = 0;
    let sumVolume = 0;
    for (let j = 0; j < period; j++) {
      const candle = data[i - j];
      const volume = candle.volume || 0;
      sumPriceVolume += candle.close * volume;
      sumVolume += volume;
    }
    result.push({
      time: data[i].time,
      value: sumVolume > 0 ? sumPriceVolume / sumVolume : data[i].close,
    });
  }
  return result;
}

// =============================================================================
// OSCILLATORS
// =============================================================================

/**
 * Relative Strength Index
 */
export function calculateRSI(data: CandleData[], period: number = 14): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period + 1) return result;

  let gains = 0;
  let losses = 0;

  // First RSI calculation
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: data[period].time,
    value: 100 - 100 / (1 + rs),
  });

  // Subsequent RSI calculations using smoothed averages
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const currentRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({
      time: data[i].time,
      value: 100 - 100 / (1 + currentRS),
    });
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDValue[] {
  const result: MACDValue[] = [];

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  if (fastEMA.length === 0 || slowEMA.length === 0) return result;

  // Create MACD line
  const macdLine: IndicatorValue[] = [];
  const slowStartIndex = slowPeriod - fastPeriod;

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = slowStartIndex + i;
    if (fastIndex >= 0 && fastIndex < fastEMA.length) {
      macdLine.push({
        time: slowEMA[i].time,
        value: fastEMA[fastIndex].value - slowEMA[i].value,
      });
    }
  }

  // Calculate signal line (EMA of MACD)
  if (macdLine.length < signalPeriod) return result;

  const signalMultiplier = 2 / (signalPeriod + 1);
  let signalSum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    signalSum += macdLine[i].value;
  }
  let signal = signalSum / signalPeriod;

  result.push({
    time: macdLine[signalPeriod - 1].time as number,
    macd: macdLine[signalPeriod - 1].value,
    signal: signal,
    histogram: macdLine[signalPeriod - 1].value - signal,
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * signalMultiplier + signal;
    result.push({
      time: macdLine[i].time as number,
      macd: macdLine[i].value,
      signal: signal,
      histogram: macdLine[i].value - signal,
    });
  }

  return result;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  data: CandleData[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smooth: number = 3
): StochasticValue[] {
  const result: StochasticValue[] = [];
  if (data.length < kPeriod) return result;

  const rawK: number[] = [];

  // Calculate raw %K
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < kPeriod; j++) {
      highest = Math.max(highest, data[i - j].high);
      lowest = Math.min(lowest, data[i - j].low);
    }
    const range = highest - lowest;
    rawK.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
  }

  // Smooth %K
  const smoothedK: number[] = [];
  for (let i = smooth - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = 0; j < smooth; j++) {
      sum += rawK[i - j];
    }
    smoothedK.push(sum / smooth);
  }

  // Calculate %D (SMA of smoothed %K)
  for (let i = dPeriod - 1; i < smoothedK.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += smoothedK[i - j];
    }
    const d = sum / dPeriod;
    const dataIndex = kPeriod - 1 + smooth - 1 + i;

    result.push({
      time: data[dataIndex].time,
      k: smoothedK[i],
      d: d,
    });
  }

  return result;
}

// =============================================================================
// VOLATILITY INDICATORS
// =============================================================================

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsValue[] {
  const result: BollingerBandsValue[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const middle = sum / period;

    // Calculate standard deviation
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - middle, 2);
    }
    const std = Math.sqrt(variance / period);

    result.push({
      time: data[i].time,
      upper: middle + stdDev * std,
      middle: middle,
      lower: middle - stdDev * std,
    });
  }
  return result;
}

/**
 * Average True Range
 */
export function calculateATR(data: CandleData[], period: number = 14): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < 2) return result;

  // Calculate True Range for each candle
  const trueRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const highLow = data[i].high - data[i].low;
    const highPrevClose = Math.abs(data[i].high - data[i - 1].close);
    const lowPrevClose = Math.abs(data[i].low - data[i - 1].close);
    trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
  }

  if (trueRanges.length < period) return result;

  // First ATR is simple average
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  let atr = sum / period;
  result.push({ time: data[period].time, value: atr });

  // Subsequent ATR uses smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({ time: data[i + 1].time, value: atr });
  }

  return result;
}

/**
 * Keltner Channel
 */
export function calculateKeltnerChannel(
  data: CandleData[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2
): BollingerBandsValue[] {
  const result: BollingerBandsValue[] = [];

  const ema = calculateEMA(data, emaPeriod);
  const atr = calculateATR(data, atrPeriod);

  if (ema.length === 0 || atr.length === 0) return result;

  // Find where both indicators have values
  const emaStartTime = ema[0].time;
  const atrStartTime = atr[0].time;

  let emaIdx = 0;
  let atrIdx = 0;

  while (emaIdx < ema.length && atrIdx < atr.length) {
    const emaTime = ema[emaIdx].time;
    const atrTime = atr[atrIdx].time;

    if (emaTime === atrTime) {
      result.push({
        time: emaTime as number,
        upper: ema[emaIdx].value + multiplier * atr[atrIdx].value,
        middle: ema[emaIdx].value,
        lower: ema[emaIdx].value - multiplier * atr[atrIdx].value,
      });
      emaIdx++;
      atrIdx++;
    } else if (emaTime < atrTime) {
      emaIdx++;
    } else {
      atrIdx++;
    }
  }

  return result;
}

// =============================================================================
// VOLUME INDICATORS
// =============================================================================

/**
 * Volume Weighted Average Price
 */
export function calculateVWAP(data: CandleData[]): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length === 0) return result;

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 0;

    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;

    result.push({
      time: candle.time,
      value: cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typicalPrice,
    });
  }
  return result;
}

/**
 * On Balance Volume
 */
export function calculateOBV(data: CandleData[]): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length === 0) return result;

  let obv = 0;
  result.push({ time: data[0].time, value: obv });

  for (let i = 1; i < data.length; i++) {
    const volume = data[i].volume || 0;
    if (data[i].close > data[i - 1].close) {
      obv += volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= volume;
    }
    result.push({ time: data[i].time, value: obv });
  }
  return result;
}

// =============================================================================
// TREND INDICATORS
// =============================================================================

/**
 * Average Directional Index (ADX)
 */
export function calculateADX(data: CandleData[], period: number = 14): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period * 2) return result;

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  // Calculate True Range, +DM, -DM
  for (let i = 1; i < data.length; i++) {
    const highLow = data[i].high - data[i].low;
    const highPrevClose = Math.abs(data[i].high - data[i - 1].close);
    const lowPrevClose = Math.abs(data[i].low - data[i - 1].close);
    trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));

    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smooth the values
  const smoothTR: number[] = [];
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];

  let sumTR = 0,
    sumPlusDM = 0,
    sumMinusDM = 0;
  for (let i = 0; i < period; i++) {
    sumTR += trueRanges[i];
    sumPlusDM += plusDM[i];
    sumMinusDM += minusDM[i];
  }

  smoothTR.push(sumTR);
  smoothPlusDM.push(sumPlusDM);
  smoothMinusDM.push(sumMinusDM);

  for (let i = period; i < trueRanges.length; i++) {
    const newTR = smoothTR[smoothTR.length - 1] - smoothTR[smoothTR.length - 1] / period + trueRanges[i];
    const newPlusDM = smoothPlusDM[smoothPlusDM.length - 1] - smoothPlusDM[smoothPlusDM.length - 1] / period + plusDM[i];
    const newMinusDM = smoothMinusDM[smoothMinusDM.length - 1] - smoothMinusDM[smoothMinusDM.length - 1] / period + minusDM[i];

    smoothTR.push(newTR);
    smoothPlusDM.push(newPlusDM);
    smoothMinusDM.push(newMinusDM);
  }

  // Calculate +DI, -DI, DX
  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const dxValue = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    dx.push(isNaN(dxValue) ? 0 : dxValue);
  }

  // Calculate ADX (smoothed DX)
  if (dx.length < period) return result;

  let adxSum = 0;
  for (let i = 0; i < period; i++) {
    adxSum += dx[i];
  }
  let adx = adxSum / period;
  result.push({ time: data[period * 2].time, value: adx });

  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
    result.push({ time: data[i + period].time, value: adx });
  }

  return result;
}

/**
 * Parabolic SAR
 */
export function calculateParabolicSAR(
  data: CandleData[],
  step: number = 0.02,
  maxStep: number = 0.2
): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < 2) return result;

  let isUpTrend = data[1].close > data[0].close;
  let ep = isUpTrend ? data[1].high : data[1].low;
  let sar = isUpTrend ? data[0].low : data[0].high;
  let af = step;

  result.push({ time: data[1].time, value: sar });

  for (let i = 2; i < data.length; i++) {
    const prevSAR = sar;

    // Calculate new SAR
    sar = prevSAR + af * (ep - prevSAR);

    // Adjust SAR if needed
    if (isUpTrend) {
      sar = Math.min(sar, data[i - 1].low, data[i - 2].low);
    } else {
      sar = Math.max(sar, data[i - 1].high, data[i - 2].high);
    }

    // Check for trend reversal
    const reversed = isUpTrend ? data[i].low < sar : data[i].high > sar;

    if (reversed) {
      isUpTrend = !isUpTrend;
      sar = ep;
      ep = isUpTrend ? data[i].high : data[i].low;
      af = step;
    } else {
      // Update EP and AF
      if (isUpTrend && data[i].high > ep) {
        ep = data[i].high;
        af = Math.min(af + step, maxStep);
      } else if (!isUpTrend && data[i].low < ep) {
        ep = data[i].low;
        af = Math.min(af + step, maxStep);
      }
    }

    result.push({ time: data[i].time, value: sar });
  }

  return result;
}

// =============================================================================
// MOMENTUM INDICATORS
// =============================================================================

/**
 * Momentum Indicator
 */
export function calculateMomentum(data: CandleData[], period: number = 10): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    result.push({
      time: data[i].time,
      value: data[i].close - data[i - period].close,
    });
  }
  return result;
}

/**
 * Rate of Change
 */
export function calculateROC(data: CandleData[], period: number = 10): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length <= period) return result;

  for (let i = period; i < data.length; i++) {
    const prevClose = data[i - period].close;
    result.push({
      time: data[i].time,
      value: prevClose !== 0 ? ((data[i].close - prevClose) / prevClose) * 100 : 0,
    });
  }
  return result;
}

/**
 * Williams %R
 */
export function calculateWilliamsR(data: CandleData[], period: number = 14): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < period; j++) {
      highest = Math.max(highest, data[i - j].high);
      lowest = Math.min(lowest, data[i - j].low);
    }
    const range = highest - lowest;
    result.push({
      time: data[i].time,
      value: range === 0 ? -50 : ((highest - data[i].close) / range) * -100,
    });
  }
  return result;
}

/**
 * Commodity Channel Index
 */
export function calculateCCI(data: CandleData[], period: number = 20): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    // Calculate Typical Price
    let tpSum = 0;
    for (let j = 0; j < period; j++) {
      const candle = data[i - j];
      tpSum += (candle.high + candle.low + candle.close) / 3;
    }
    const tpAvg = tpSum / period;

    // Calculate Mean Deviation
    let mdSum = 0;
    for (let j = 0; j < period; j++) {
      const candle = data[i - j];
      const tp = (candle.high + candle.low + candle.close) / 3;
      mdSum += Math.abs(tp - tpAvg);
    }
    const md = mdSum / period;

    const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
    result.push({
      time: data[i].time,
      value: md === 0 ? 0 : (currentTP - tpAvg) / (0.015 * md),
    });
  }
  return result;
}

// =============================================================================
// ICHIMOKU CLOUD
// =============================================================================

export function calculateIchimoku(
  data: CandleData[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
  displacement: number = 26
): IchimokuValue[] {
  const result: IchimokuValue[] = [];
  const minPeriod = Math.max(tenkanPeriod, kijunPeriod, senkouBPeriod);
  if (data.length < minPeriod + displacement) return result;

  // Helper to get highest high and lowest low
  const getHighLow = (start: number, period: number) => {
    let high = -Infinity;
    let low = Infinity;
    for (let j = 0; j < period && start - j >= 0; j++) {
      high = Math.max(high, data[start - j].high);
      low = Math.min(low, data[start - j].low);
    }
    return { high, low };
  };

  for (let i = minPeriod - 1; i < data.length; i++) {
    const tenkanHL = getHighLow(i, tenkanPeriod);
    const kijunHL = getHighLow(i, kijunPeriod);
    const senkouBHL = getHighLow(i, senkouBPeriod);

    const tenkan = (tenkanHL.high + tenkanHL.low) / 2;
    const kijun = (kijunHL.high + kijunHL.low) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = (senkouBHL.high + senkouBHL.low) / 2;
    const chikou = data[i].close;

    result.push({
      time: data[i].time,
      tenkan,
      kijun,
      senkouA,
      senkouB,
      chikou,
    });
  }

  return result;
}

// =============================================================================
// INDICATOR TYPES AND HELPERS
// =============================================================================

export type IndicatorType =
  | "sma"
  | "ema"
  | "wma"
  | "vwma"
  | "rsi"
  | "macd"
  | "stochastic"
  | "bollinger"
  | "atr"
  | "keltner"
  | "vwap"
  | "obv"
  | "adx"
  | "psar"
  | "momentum"
  | "roc"
  | "williams"
  | "cci"
  | "ichimoku";

export interface IndicatorConfig {
  type: IndicatorType;
  period?: number;
  color?: string;
  lineWidth?: number;
  visible?: boolean;
  params?: Record<string, number>;
}

export const indicatorDefaults: Record<IndicatorType, { period: number; color: string }> = {
  sma: { period: 20, color: "#2962ff" },
  ema: { period: 21, color: "#ff6d00" },
  wma: { period: 20, color: "#ab47bc" },
  vwma: { period: 20, color: "#26a69a" },
  rsi: { period: 14, color: "#7c4dff" },
  macd: { period: 12, color: "#2196f3" },
  stochastic: { period: 14, color: "#e91e63" },
  bollinger: { period: 20, color: "#00bcd4" },
  atr: { period: 14, color: "#ff5722" },
  keltner: { period: 20, color: "#9c27b0" },
  vwap: { period: 0, color: "#673ab7" },
  obv: { period: 0, color: "#795548" },
  adx: { period: 14, color: "#607d8b" },
  psar: { period: 0, color: "#ffc107" },
  momentum: { period: 10, color: "#4caf50" },
  roc: { period: 10, color: "#8bc34a" },
  williams: { period: 14, color: "#ff9800" },
  cci: { period: 20, color: "#00897b" },
  ichimoku: { period: 9, color: "#e91e63" },
};

export function getIndicatorDisplayName(type: IndicatorType): string {
  const names: Record<IndicatorType, string> = {
    sma: "Simple Moving Average",
    ema: "Exponential Moving Average",
    wma: "Weighted Moving Average",
    vwma: "Volume Weighted MA",
    rsi: "Relative Strength Index",
    macd: "MACD",
    stochastic: "Stochastic",
    bollinger: "Bollinger Bands",
    atr: "Average True Range",
    keltner: "Keltner Channel",
    vwap: "VWAP",
    obv: "On Balance Volume",
    adx: "ADX",
    psar: "Parabolic SAR",
    momentum: "Momentum",
    roc: "Rate of Change",
    williams: "Williams %R",
    cci: "CCI",
    ichimoku: "Ichimoku Cloud",
  };
  return names[type] || type.toUpperCase();
}
