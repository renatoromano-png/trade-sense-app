/**
 * indicators.js – Technical Indicators for Stocks
 * All calculations are client-side on OHLCV arrays.
 * Candle: { timestamp, open, high, low, close, volume }
 */

var Indicators = (() => {

    function last(arr) {
        for (let i = arr.length - 1; i >= 0; i--)
            if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) return arr[i];
        return null;
    }

    function prev(arr, offset = 1) {
        let count = 0;
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] !== null && !isNaN(arr[i])) {
                if (count === offset) return arr[i];
                count++;
            }
        }
        return null;
    }

    // ── SMA ───────────────────────────────────────────────────
    function sma(data, period) {
        return data.map((_, i) => {
            if (i < period - 1) return null;
            const s = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            return s / period;
        });
    }

    // ── EMA ───────────────────────────────────────────────────
    function ema(data, period) {
        const result = new Array(data.length).fill(null);
        if (data.length < period) return result;
        const k = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[i];
        result[period - 1] = sum / period;
        for (let i = period; i < data.length; i++)
            result[i] = data[i] * k + result[i - 1] * (1 - k);
        return result;
    }

    // ── RSI (Wilder) ──────────────────────────────────────────
    function rsi(closes, period = 14) {
        const result = new Array(closes.length).fill(null);
        if (closes.length < period + 1) return result;
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const d = closes[i] - closes[i - 1];
            d > 0 ? gains += d : losses -= d;
        }
        let ag = gains / period, al = losses / period;
        result[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        for (let i = period + 1; i < closes.length; i++) {
            const d = closes[i] - closes[i - 1];
            ag = (ag * (period - 1) + Math.max(d, 0)) / period;
            al = (al * (period - 1) + Math.max(-d, 0)) / period;
            result[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        }
        return result;
    }

    // ── MACD ─────────────────────────────────────────────────
    function macd(closes, fast = 12, slow = 26, signal = 9) {
        const fastE = ema(closes, fast);
        const slowE = ema(closes, slow);
        const macdLine = closes.map((_, i) =>
            fastE[i] !== null && slowE[i] !== null ? fastE[i] - slowE[i] : null);
        const nonNull = macdLine.filter(v => v !== null);
        const sigRaw = ema(nonNull, signal);
        const offset = macdLine.indexOf(nonNull[0]);
        const signalLine = new Array(closes.length).fill(null);
        const histogram = new Array(closes.length).fill(null);
        nonNull.forEach((_, j) => {
            const i = offset + j;
            signalLine[i] = sigRaw[j];
            if (macdLine[i] !== null && sigRaw[j] !== null)
                histogram[i] = macdLine[i] - sigRaw[j];
        });
        return { macdLine, signalLine, histogram };
    }

    // ── ATR ───────────────────────────────────────────────────
    function atr(candles, period = 14) {
        const result = new Array(candles.length).fill(null);
        const tr = candles.map((c, i) => {
            if (i === 0) return c.high - c.low;
            const pc = candles[i - 1].close;
            return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
        });
        let sum = 0;
        for (let i = 0; i < period; i++) sum += tr[i];
        result[period - 1] = sum / period;
        for (let i = period; i < candles.length; i++)
            result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
        return result;
    }

    // ── Bollinger Bands ───────────────────────────────────────
    function bollingerBands(closes, period = 20, mult = 2) {
        const mid = sma(closes, period);
        const upper = new Array(closes.length).fill(null);
        const lower = new Array(closes.length).fill(null);
        const pctB = new Array(closes.length).fill(null);
        closes.forEach((_, i) => {
            if (mid[i] === null) return;
            const sl = closes.slice(i - period + 1, i + 1);
            const variance = sl.reduce((acc, v) => acc + (v - mid[i]) ** 2, 0) / period;
            const sd = Math.sqrt(variance);
            upper[i] = mid[i] + mult * sd;
            lower[i] = mid[i] - mult * sd;
            pctB[i] = (closes[i] - lower[i]) / (upper[i] - lower[i]);
        });
        return { upper, middle: mid, lower, pctB };
    }

    // ── Volume Indicators ─────────────────────────────────────
    function volumeIndicators(candles, period = 20) {
        const volumes = candles.map(c => c.volume);
        const avgVol = sma(volumes, period);
        const relVolume = volumes.map((v, i) => avgVol[i] ? v / avgVol[i] : null);

        // OBV – On Balance Volume
        const obv = new Array(candles.length).fill(0);
        for (let i = 1; i < candles.length; i++) {
            const dir = candles[i].close > candles[i - 1].close ? 1 :
                candles[i].close < candles[i - 1].close ? -1 : 0;
            obv[i] = obv[i - 1] + dir * candles[i].volume;
        }
        const obvEma = ema(obv, 10);

        return { relVolume, obv, obvEma, avgVol };
    }

    // ── Stochastic ────────────────────────────────────────────
    function stochastic(candles, kPeriod = 14, dPeriod = 3) {
        const k = new Array(candles.length).fill(null);
        const d = new Array(candles.length).fill(null);
        for (let i = kPeriod - 1; i < candles.length; i++) {
            const sl = candles.slice(i - kPeriod + 1, i + 1);
            const lo = Math.min(...sl.map(c => c.low));
            const hi = Math.max(...sl.map(c => c.high));
            k[i] = hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100;
        }
        for (let i = kPeriod + dPeriod - 2; i < candles.length; i++) {
            const sl = k.slice(i - dPeriod + 1, i + 1).filter(v => v !== null);
            if (sl.length === dPeriod) d[i] = sl.reduce((a, b) => a + b) / dPeriod;
        }
        return { k, d };
    }

    // ── Pivot Points ──────────────────────────────────────────
    function pivotPoints(candles) {
        const sl = candles.slice(-30); // Use last 30 candles for daily context
        const H = Math.max(...sl.map(c => c.high));
        const L = Math.min(...sl.map(c => c.low));
        const C = sl[sl.length - 1].close;
        const PP = (H + L + C) / 3;
        return {
            PP, R1: 2 * PP - L, R2: PP + H - L,
            S1: 2 * PP - H, S2: PP - H + L,
        };
    }

    // ── Compute all ───────────────────────────────────────────
    function computeAll(candles) {
        const closes = candles.map(c => c.close);
        const ema9 = ema(closes, 9);
        const ema21 = ema(closes, 21);
        const ema50 = ema(closes, 50);
        const ema200 = ema(closes, 200);
        const rsiData = rsi(closes, 14);
        const macdData = macd(closes, 12, 26, 9);
        const atrData = atr(candles, 14);
        const bbData = bollingerBands(closes, 20);
        const stochData = stochastic(candles, 14, 3);
        const volData = volumeIndicators(candles, 20);
        const pivots = pivotPoints(candles);

        return {
            ema9, ema21, ema50, ema200,
            rsi: rsiData, macd: macdData,
            atr: atrData, bb: bbData,
            stoch: stochData, vol: volData,
            pivots,
            last: {
                ema9: last(ema9),
                ema21: last(ema21),
                ema50: last(ema50),
                ema200: last(ema200),
                rsi: last(rsiData),
                macdLine: last(macdData.macdLine),
                macdSignal: last(macdData.signalLine),
                macdHist: last(macdData.histogram),
                macdHistPrev: prev(macdData.histogram),
                atr: last(atrData),
                bbUpper: last(bbData.upper),
                bbMid: last(bbData.middle),
                bbLower: last(bbData.lower),
                pctB: last(bbData.pctB),
                stochK: last(stochData.k),
                stochD: last(stochData.d),
                relVol: last(volData.relVolume),
                obv: last(volData.obv),
                obvEma: last(volData.obvEma),
                close: closes[closes.length - 1],
                prevClose: closes[closes.length - 2],
                high: candles[candles.length - 1].high,
                low: candles[candles.length - 1].low,
                volume: candles[candles.length - 1].volume,
            }
        };
    }

    return { sma, ema, rsi, macd, atr, bollingerBands, stochastic, volumeIndicators, pivotPoints, computeAll, last, prev };
})();
