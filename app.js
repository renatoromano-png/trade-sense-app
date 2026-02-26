/**
 * app.js – Main Orchestrator
 * Coordinates data fetching, signal generation, and UI updates.
 * Runs entirely in the browser – no server needed.
 */

var App = (() => {
    let selectedSymbol = 'AAPL';
    let watchlistData = {};   // symbol -> { quote, signal, analysis, candles, news }
    let liveConnection = null;
    let refreshInterval = null;
    let chartInstance = null;
    let journalEntries = JSON.parse(localStorage.getItem('journal') || '[]');
    let userCapital = parseFloat(localStorage.getItem('capital') || '10000');
    let userRiskPct = parseFloat(localStorage.getItem('riskPct') || '1.5');
    let userRRRatio = parseFloat(localStorage.getItem('rrRatio') || '2.0');

    const watchlist = DataModule.getWatchlist();

    // ── Init ──────────────────────────────────────────────────
    async function init() {
        UI.renderWatchlist(watchlist, selectedSymbol, onSelectSymbol);
        UI.updateMarketStatus(DataModule.isDemo());
        UI.renderJournal(journalEntries);
        loadSettings();
        await refreshAll();
        UI.updateJournalLivePrices(journalEntries, watchlistData);
        startLivePrices();
        startAutoRefresh();
    }

    // ── Refresh all watchlist data ────────────────────────────
    async function refreshAll() {
        UI.setLoading(true);
        // Fetch in sequential batches to avoid rate limits
        for (const stock of watchlist) {
            await refreshStock(stock.symbol);
        }
        UI.renderWatchlistPrices(watchlistData, selectedSymbol, onSelectSymbol);
        await renderSelected();
        UI.updateJournalLivePrices(journalEntries, watchlistData);
        UI.setLoading(false);
    }

    async function refreshStock(symbol) {
        try {
            const [candles, quote] = await Promise.all([
                DataModule.fetchCandles(symbol, '15', 150),
                DataModule.fetchQuote(symbol),
            ]);

            if (!candles || candles.length < 30) return;
            const ind = Indicators.computeAll(candles);
            const signal = SignalsEngine.generateSignal(ind, symbol, quote || {});
            let analysis = null;
            if (signal.direction !== 'WAIT' && ind.last.atr && quote) {
                analysis = RiskManager.analyzeTradeSetup({
                    capital: userCapital, riskPct: userRiskPct, direction: signal.direction,
                    symbol, entryPrice: quote.price, atr: ind.last.atr,
                    pivots: ind.pivots, rrRatio: userRRRatio,
                });
            }
            watchlistData[symbol] = { candles, quote, ind, signal, analysis };
        } catch (err) {
            console.warn(`[App] Error refreshing ${symbol}:`, err);
        }
    }

    // ── Render selected stock ─────────────────────────────────
    async function renderSelected() {
        const d = watchlistData[selectedSymbol];
        if (!d) return;

        UI.renderSignal(d.signal);
        UI.renderRiskPanel(d.analysis, d.quote);
        UI.renderIndicatorBadges(d.ind.last);
        renderChart(d.candles, d.ind);

        const news = await DataModule.fetchNews(selectedSymbol);
        UI.renderNews(news);
        checkOpenTradeExit(d);

        // Update header block
        UI.updateStockHeader(selectedSymbol, d.quote, watchlist);
    }

    // ── Chart rendering (Chart.js) ────────────────────────────
    function renderChart(candles, ind) {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;
        if (chartInstance) chartInstance.destroy();

        const labels = candles.slice(-60).map(c =>
            new Date(c.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        );
        const last60 = candles.slice(-60);
        const closes = last60.map(c => c.close);
        const ema9Arr = ind.ema9.slice(-60).map(v => v === null ? null : parseFloat(v.toFixed(2)));
        const ema21Arr = ind.ema21.slice(-60).map(v => v === null ? null : parseFloat(v.toFixed(2)));
        const bbU = ind.bb.upper.slice(-60).map(v => v === null ? null : parseFloat(v.toFixed(2)));
        const bbL = ind.bb.lower.slice(-60).map(v => v === null ? null : parseFloat(v.toFixed(2)));

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Prezzo',
                        data: closes.map(v => parseFloat(v.toFixed(2))),
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0,212,255,0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: false,
                    },
                    {
                        label: 'EMA 9',
                        data: ema9Arr,
                        borderColor: '#f59e0b',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: false,
                    },
                    {
                        label: 'EMA 21',
                        data: ema21Arr,
                        borderColor: '#a78bfa',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: false,
                    },
                    {
                        label: 'BB Upper',
                        data: bbU,
                        borderColor: 'rgba(248,113,113,0.5)',
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                    },
                    {
                        label: 'BB Lower',
                        data: bbL,
                        borderColor: 'rgba(52,211,153,0.5)',
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: '-1',
                        backgroundColor: 'rgba(99,102,241,0.04)',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
                    tooltip: {
                        backgroundColor: 'rgba(15,23,42,0.95)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(99,102,241,0.4)',
                        borderWidth: 1,
                    },
                },
                scales: {
                    x: { ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(99,102,241,0.08)' } },
                    y: {
                        ticks: {
                            color: '#64748b', font: { size: 10 },
                            callback: v => `$${v.toFixed(2)}`
                        },
                        grid: { color: 'rgba(99,102,241,0.08)' },
                    },
                },
            },
        });
    }

    // ── Live prices via WebSocket / demo tick ─────────────────
    function startLivePrices() {
        const symbols = watchlist.map(s => s.symbol);
        liveConnection = DataModule.connectWebSocket(symbols, (symbol, price) => {
            if (watchlistData[symbol]) {
                watchlistData[symbol].livePrice = price;
            }
            UI.updateLivePrice(symbol, price);
            if (symbol === selectedSymbol) {
                UI.updateSelectedPrice(price);
            }
            UI.updateJournalLivePrices(journalEntries, watchlistData);
        });
    }

    // ── Auto-refresh every 60s ────────────────────────────────
    function startAutoRefresh() {
        refreshInterval = setInterval(async () => {
            await refreshStock(selectedSymbol);
            renderSelected();
            UI.renderWatchlistPrices(watchlistData, selectedSymbol, onSelectSymbol);
            UI.updateMarketStatus(DataModule.isDemo());
        }, 60000);
    }

    // ── Select a stock from watchlist ─────────────────────────
    async function onSelectSymbol(symbol) {
        selectedSymbol = symbol;
        if (!watchlistData[symbol]) {
            UI.setLoading(true);
            await refreshStock(symbol);
            UI.setLoading(false);
        }
        UI.highlightSelected(symbol);
        await renderSelected();
    }

    // ── Auto check exits for open trades ─────────────────────
    function checkOpenTradeExit(data) {
        const openTrade = journalEntries.find(
            j => j.symbol === selectedSymbol && j.status === 'open'
        );
        if (!openTrade || !data.quote) return;
        const exit = SignalsEngine.checkExitSignal(
            openTrade, data.quote.price, data.ind
        );
        if (exit.shouldExit) {
            UI.showExitAlert(openTrade.symbol, exit);
        }
    }

    // ── Settings ──────────────────────────────────────────────
    function loadSettings() {
        const capitalEl = document.getElementById('capitalInput');
        const riskEl = document.getElementById('riskPctInput');
        const rrEl = document.getElementById('rrRatioInput');
        const apiEl = document.getElementById('apiKeyInput');

        if (capitalEl) capitalEl.value = userCapital;
        if (riskEl) riskEl.value = userRiskPct;
        if (rrEl) rrEl.value = userRRRatio;
        if (apiEl && !DataModule.isDemo())
            apiEl.value = localStorage.getItem('finnhub_api_key') || '';
    }

    function saveSettings() {
        userCapital = parseFloat(document.getElementById('capitalInput').value) || 10000;
        userRiskPct = parseFloat(document.getElementById('riskPctInput').value) || 1.5;
        userRRRatio = parseFloat(document.getElementById('rrRatioInput').value) || 2.0;
        const apiKey = document.getElementById('apiKeyInput').value.trim();

        localStorage.setItem('capital', userCapital);
        localStorage.setItem('riskPct', userRiskPct);
        localStorage.setItem('rrRatio', userRRRatio);

        if (apiKey && apiKey !== localStorage.getItem('finnhub_api_key')) {
            DataModule.setApiKey(apiKey);
            location.reload();
        }

        // Refresh analysis with new settings
        refreshAll();
        UI.showToast('✅ Impostazioni salvate');
    }

    function resetWatchlist() {
        if (confirm('Vuoi ripristinare le azioni di default? Tutte le personalizzazioni della lista andranno perse.')) {
            localStorage.removeItem('watchlist');
            location.reload();
        }
    }

    // ── Journal ───────────────────────────────────────────────
    function addJournalEntry(entry) {
        entry.id = Date.now();
        entry.dateStr = new Date().toLocaleString('it-IT');
        journalEntries.unshift(entry);
        localStorage.setItem('journal', JSON.stringify(journalEntries));
        UI.renderJournal(journalEntries);
        UI.updateJournalLivePrices(journalEntries, watchlistData);
        UI.showToast(`📓 Trade ${entry.direction} ${entry.symbol} registrato`);
    }

    function closeJournalEntry(id, exitPrice) {
        const entry = journalEntries.find(j => j.id === id);
        if (!entry) return;
        entry.status = 'closed';
        entry.exitPrice = exitPrice;
        entry.pnlUsd = entry.direction === 'BUY'
            ? (exitPrice - entry.entryPrice) * entry.shares
            : (entry.entryPrice - exitPrice) * entry.shares;
        entry.closedAt = new Date().toLocaleString('it-IT');
        localStorage.setItem('journal', JSON.stringify(journalEntries));
        UI.renderJournal(journalEntries);
    }

    // Expose to window for button onclick handlers
    window.App = {
        init,
        saveSettings,
        addJournalEntry,
        closeJournalEntry,
        onSelectSymbol,
        refreshAll,
        resetWatchlist,
        getCapital: () => userCapital,
        getRiskPct: () => userRiskPct,
        getRRRatio: () => userRRRatio,
        getSelectedData: () => watchlistData[selectedSymbol],
        getSelectedSymbol: () => selectedSymbol,
    };

    // NOTE: App.init() is called by Auth module in index.html after login.
    // Do NOT auto-init here.
    return window.App;
})();
