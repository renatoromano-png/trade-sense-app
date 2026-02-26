/**
 * data.js – Stock Market Data Layer
 * Source: Finnhub.io (free tier: 60 API calls/min, WebSocket real-time)
 * Fallback: Realistic demo simulation if no API key provided.
 *
 * How to get a FREE Finnhub API key:
 *   1. Go to https://finnhub.io/register
 *   2. Register with email (free, no credit card)
 *   3. Copy your API key from the dashboard
 *   4. Paste it in the app settings
 */

var DataModule = (() => {
    const FINNHUB_BASE = 'https://finnhub.io/api/v1';
    let API_KEY = localStorage.getItem('finnhub_api_key') || '';
    let ws = null;
    let wsSubscriptions = new Set();
    let priceCallbacks = {};  // symbol -> [callbacks]
    let quoteCache = {};      // symbol -> { price, change, changePct, high, low, open, prevClose, ts }

    // ── Default watchlist ─────────────────────────────────────
    const DEFAULT_WATCHLIST = [
        { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'GOOGL', name: 'Alphabet', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'TSLA', name: 'Tesla', exchange: 'NASDAQ', sector: 'Auto' },
        { symbol: 'META', name: 'Meta', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'AMD', name: 'AMD', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'NFLX', name: 'Netflix', exchange: 'NASDAQ', sector: 'Comm' },
        { symbol: 'ADBE', name: 'Adobe', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'INTC', name: 'Intel', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'CSCO', name: 'Cisco', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'QCOM', name: 'Qualcomm', exchange: 'NASDAQ', sector: 'Tech' },
        { symbol: 'SBUX', name: 'Starbucks', exchange: 'NASDAQ', sector: 'Cons' },
        { symbol: 'JPM', name: 'JPMorgan', exchange: 'NYSE', sector: 'Finance' },
        { symbol: 'V', name: 'Visa', exchange: 'NYSE', sector: 'Finance' },
        { symbol: 'MA', name: 'Mastercard', exchange: 'NYSE', sector: 'Finance' },
        { symbol: 'BRK.B', name: 'Berkshire', exchange: 'NYSE', sector: 'Finance' },
        { symbol: 'JNJ', name: 'J&J', exchange: 'NYSE', sector: 'Health' },
        { symbol: 'UNH', name: 'UnitedHealth', exchange: 'NYSE', sector: 'Health' },
        { symbol: 'PFE', name: 'Pfizer', exchange: 'NYSE', sector: 'Health' },
        { symbol: 'XOM', name: 'ExxonMobil', exchange: 'NYSE', sector: 'Energy' },
        { symbol: 'CVX', name: 'Chevron', exchange: 'NYSE', sector: 'Energy' },
        { symbol: 'WMT', name: 'Walmart', exchange: 'NYSE', sector: 'Retail' },
        { symbol: 'HD', name: 'Home Depot', exchange: 'NYSE', sector: 'Retail' },
        { symbol: 'PG', name: 'Procter & Gamble', exchange: 'NYSE', sector: 'Cons' },
        { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE', sector: 'Cons' },
        { symbol: 'PEP', name: 'PepsiCo', exchange: 'NYSE', sector: 'Cons' },
        { symbol: 'MCD', name: 'McDonald\'s', exchange: 'NYSE', sector: 'Cons' },
        { symbol: 'DIS', name: 'Disney', exchange: 'NYSE', sector: 'Comm' },
        { symbol: 'BA', name: 'Boeing', exchange: 'NYSE', sector: 'Indus' },
        { symbol: 'SPY', name: 'S&P 500 ETF', exchange: 'NYSE', sector: 'ETF' },
        { symbol: 'QQQ', name: 'Nasdaq 100 ETF', exchange: 'NASDAQ', sector: 'ETF' },
    ];

    // ── Demo base prices ──────────────────────────────────────
    const DEMO_PRICES = {
        AAPL: 189.50, MSFT: 415.20, NVDA: 875.40, GOOGL: 174.80, AMZN: 192.30,
        TSLA: 175.60, META: 512.70, AMD: 164.20, NFLX: 620.50, ADBE: 495.30,
        INTC: 38.40, CSCO: 47.80, QCOM: 165.90, SBUX: 89.20,
        JPM: 198.40, V: 278.10, MA: 465.30, 'BRK.B': 398.20, JNJ: 157.30,
        UNH: 510.40, PFE: 28.50, XOM: 110.50, CVX: 162.80, WMT: 60.20,
        HD: 355.70, PG: 162.40, KO: 61.20, PEP: 175.60, MCD: 278.40,
        DIS: 112.50, BA: 182.30, SPY: 520.10, QQQ: 442.80,
    };
    const demoState = {};
    Object.keys(DEMO_PRICES).forEach(s => {
        demoState[s] = { price: DEMO_PRICES[s], trend: (Math.random() - 0.48) * 0.002 };
    });

    // ── Check if market is open (US Eastern Time) ─────────────
    function isMarketOpen() {
        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const etOffset = isDST(now) ? -4 * 3600000 : -5 * 3600000;
        const et = new Date(utcMs + etOffset);
        const day = et.getDay();
        const hours = et.getHours() + et.getMinutes() / 60;
        return day >= 1 && day <= 5 && hours >= 9.5 && hours < 16;
    }

    function isDST(date) {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        return date.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    function getMarketStatus() {
        if (isMarketOpen()) return { open: true, label: '🟢 Mercato Aperto', session: 'US Regular' };
        const now = new Date();
        const utcHour = now.getUTCHours();
        // Pre-market: 13:00–14:30 UTC (09:00–09:30 ET)
        if (utcHour >= 13 && utcHour < 14.5) return { open: false, label: '🟡 Pre-Market', session: 'Pre-Market' };
        // After-hours: 20:00–24:00 UTC
        if (utcHour >= 20) return { open: false, label: '🟡 After Hours', session: 'After Hours' };
        return { open: false, label: '🔴 Mercato Chiuso', session: 'Closed' };
    }

    // ── Demo price tick ───────────────────────────────────────
    function tickDemoPrice(symbol) {
        const s = demoState[symbol];
        if (!s) return DEMO_PRICES[symbol] || 100;
        const noise = (Math.random() - 0.5) * s.price * 0.0015;
        const reversion = (DEMO_PRICES[symbol] - s.price) * 0.005;
        s.price = Math.max(s.price + s.trend * s.price + noise + reversion, 1);
        return parseFloat(s.price.toFixed(2));
    }

    // ── Generate demo candles (M5, M15, H1, D1 supported) ────
    function generateDemoCandles(symbol, resolution = '15', count = 120) {
        const base = DEMO_PRICES[symbol] || 100;
        const volatility = base * 0.008;
        const candles = [];
        let price = base;
        const now = Math.floor(Date.now() / 1000);
        const resSeconds = resolution === '5' ? 300 : resolution === '15' ? 900 :
            resolution === '60' ? 3600 : 86400;
        const trend = (Math.random() - 0.48) * 0.0003;

        for (let i = count; i >= 0; i--) {
            const t = now - i * resSeconds;
            const sine = Math.sin(i * 0.2) * volatility * 0.3;
            const noise = (Math.random() - 0.5) * volatility;
            price = Math.max(1, price + trend * price + sine * 0.05 + noise * 0.3);
            const body = Math.abs(noise) * 0.6;
            const wick = body * (0.5 + Math.random());
            const open = price;
            const close = price + (Math.random() - 0.5) * body;
            const high = Math.max(open, close) + Math.random() * wick;
            const low = Math.min(open, close) - Math.random() * wick;
            const vol = Math.floor(100000 + Math.random() * 900000);
            candles.push({ timestamp: t * 1000, open, high, low, close, volume: vol });
        }
        return candles;
    }

    // ── Finnhub REST: Quote ───────────────────────────────────
    async function fetchQuote(symbol) {
        if (!API_KEY) {
            const p = tickDemoPrice(symbol);
            const base = DEMO_PRICES[symbol] || p;
            const change = p - base;
            return { price: p, change, changePct: (change / base) * 100, high: p * 1.01, low: p * 0.99, open: base, prevClose: base, demo: true };
        }
        try {
            const r = await fetch(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`);
            const d = await r.json();
            if (d.c === 0) return null;
            return { price: d.c, change: d.d, changePct: d.dp, high: d.h, low: d.l, open: d.o, prevClose: d.pc };
        } catch { return null; }
    }

    // ── Finnhub REST: Candles (OHLCV) ─────────────────────────
    async function fetchCandles(symbol, resolution = '15', bars = 150) {
        const cacheKey = `candles_${symbol}_${resolution}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.ts < 60000) return cached.data;

        if (!API_KEY) {
            const candles = generateDemoCandles(symbol, resolution, bars);
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: candles }));
            return candles;
        }

        try {
            const to = Math.floor(Date.now() / 1000);
            const resSeconds = resolution === '5' ? 300 : resolution === '15' ? 900 :
                resolution === '60' ? 3600 : 86400;
            const from = to - bars * resSeconds;
            const url = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`;
            const r = await fetch(url);
            const d = await r.json();
            if (d.s !== 'ok' || !d.c) {
                return generateDemoCandles(symbol, resolution, bars);
            }
            const candles = d.t.map((t, i) => ({
                timestamp: t * 1000,
                open: d.o[i], high: d.h[i], low: d.l[i],
                close: d.c[i], volume: d.v[i],
            }));
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: candles }));
            return candles;
        } catch {
            return generateDemoCandles(symbol, resolution, bars);
        }
    }

    // ── Finnhub REST: Company News ─────────────────────────────
    async function fetchNews(symbol) {
        if (!API_KEY) return getDemoNews(symbol);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            const r = await fetch(`${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${weekAgo}&to=${today}&token=${API_KEY}`);
            const d = await r.json();
            return (d || []).slice(0, 5);
        } catch { return []; }
    }

    function getDemoNews(symbol) {
        return [
            { headline: `${symbol}: Analisti alzano target price del 12%`, source: 'Reuters', datetime: Date.now() / 1000 - 3600, url: '#' },
            { headline: `${symbol} supera le stime sugli utili del Q4`, source: 'Bloomberg', datetime: Date.now() / 1000 - 86400, url: '#' },
            { headline: `Settore tech in rialzo: ${symbol} trascina il Nasdaq`, source: 'CNBC', datetime: Date.now() / 1000 - 172800, url: '#' },
        ];
    }

    // ── Finnhub WebSocket Real-time ───────────────────────────
    function connectWebSocket(symbols, onTick) {
        if (!API_KEY) {
            // Demo: simulate ticks every 2 seconds
            return setInterval(() => {
                symbols.forEach(sym => {
                    const p = tickDemoPrice(sym);
                    onTick(sym, p);
                });
            }, 2000);
        }

        if (ws) ws.close();
        ws = new WebSocket(`wss://ws.finnhub.io?token=${API_KEY}`);

        ws.onopen = () => {
            symbols.forEach(sym => {
                ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
                wsSubscriptions.add(sym);
            });
        };

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'trade' && msg.data) {
                msg.data.forEach(t => onTick(t.s, t.p));
            }
        };

        ws.onerror = () => console.warn('[DataModule] WebSocket error – using polling');
        ws.onclose = () => setTimeout(() => connectWebSocket(symbols, onTick), 5000);
        return ws;
    }

    // ── Public API ────────────────────────────────────────────
    function setApiKey(key) {
        API_KEY = key.trim();
        // Save keys we must preserve before clearing cache
        const preserve = {};
        const keepKeys = ['ts_auth_hash', 'ts_session', 'journal', 'watchlist',
            'capital', 'riskPct', 'rrRatio'];
        keepKeys.forEach(k => { const v = localStorage.getItem(k); if (v) preserve[k] = v; });

        // Clear only candle/quote cache entries (keys starting with 'candles_' or 'av_')
        Object.keys(localStorage)
            .filter(k => k.startsWith('candles_') || k.startsWith('av_'))
            .forEach(k => localStorage.removeItem(k));

        // Save the new API key and restore preserved keys
        localStorage.setItem('finnhub_api_key', API_KEY);
        Object.entries(preserve).forEach(([k, v]) => localStorage.setItem(k, v));
    }

    return {
        fetchQuote,
        fetchCandles,
        fetchNews,
        connectWebSocket,
        setApiKey,
        getMarketStatus,
        isMarketOpen,
        getWatchlist: () => JSON.parse(localStorage.getItem('watchlist') || 'null') || DEFAULT_WATCHLIST,
        isDemo: () => !API_KEY,
        DEFAULT_WATCHLIST,
        tickDemoPrice,
    };
})();
