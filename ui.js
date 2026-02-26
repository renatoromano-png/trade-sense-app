/**
 * ui.js – UI Rendering Module
 * Handles all DOM manipulation, updates, and user interactions.
 */

var UI = (() => {

  const fmt = (n, dec = 2) => n !== null && n !== undefined && !isNaN(n)
    ? parseFloat(n).toFixed(dec) : '–';

  const fmtPrice = (p) => p ? `$${fmt(p, 2)}` : '–';
  const fmtPct = (p) => p !== null && p !== undefined ? `${p > 0 ? '+' : ''}${fmt(p, 2)}%` : '–';

  // ── Market Status ─────────────────────────────────────────
  function updateMarketStatus(isDemo) {
    const el = document.getElementById('marketStatus');
    if (!el) return;
    const status = DataModule.getMarketStatus();
    el.className = 'market-status ' + (status.open ? 'open' : status.label.includes('🟡') ? 'pre' : 'closed');
    el.textContent = status.label;

    const demoEl = document.getElementById('demoBadge');
    if (demoEl) demoEl.style.display = isDemo ? 'flex' : 'none';
  }

  // ── Watchlist rendering ───────────────────────────────────
  function renderWatchlist(watchlist, selectedSymbol, onSelect) {
    const container = document.getElementById('watchlistContainer');
    if (!container) return;
    container.innerHTML = '';

    watchlist.forEach(stock => {
      const item = document.createElement('div');
      item.className = 'watchlist-item' + (stock.symbol === selectedSymbol ? ' active' : '');
      item.id = `wi-${stock.symbol}`;
      item.innerHTML = `
        <div class="wi-left">
          <div class="wi-dot" id="dot-${stock.symbol}"></div>
          <div>
            <div class="wi-symbol">${stock.symbol}</div>
            <div class="wi-name">${stock.name}</div>
          </div>
        </div>
        <div class="wi-right">
          <div class="wi-price" id="wip-${stock.symbol}">–</div>
          <div class="wi-change" id="wic-${stock.symbol}">–</div>
        </div>`;
      item.addEventListener('click', () => onSelect(stock.symbol));
      container.appendChild(item);
    });
  }

  function renderWatchlistPrices(watchlistData, selectedSymbol, onSelect) {
    Object.entries(watchlistData).forEach(([sym, d]) => {
      const priceEl = document.getElementById(`wip-${sym}`);
      const changeEl = document.getElementById(`wic-${sym}`);
      const dotEl = document.getElementById(`dot-${sym}`);
      if (!d.quote) return;
      if (priceEl) priceEl.textContent = fmtPrice(d.quote.price);
      if (changeEl) {
        changeEl.textContent = fmtPct(d.quote.changePct);
        changeEl.className = 'wi-change ' + (d.quote.changePct >= 0 ? 'pos' : 'neg');
      }
      if (dotEl && d.signal) {
        dotEl.className = 'wi-dot ' + d.signal.direction.toLowerCase();
      }
    });
  }

  function highlightSelected(symbol) {
    document.querySelectorAll('.watchlist-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`wi-${symbol}`);
    if (el) el.classList.add('active');
  }

  // ── Live price update ─────────────────────────────────────
  function updateLivePrice(symbol, price) {
    const el = document.getElementById(`wip-${symbol}`);
    if (el) {
      el.textContent = fmtPrice(price);
      el.style.color = '#22d3ee';
      setTimeout(() => el.style.color = '', 500);
    }
  }

  function updateSelectedPrice(price) {
    const el = document.getElementById('livePriceDisplay');
    if (el) el.textContent = fmtPrice(price);
  }

  // ── Stock Header ──────────────────────────────────────────
  function updateStockHeader(symbol, quote, watchlist) {
    const symEl = document.getElementById('stockSymbolDisplay');
    const nameEl = document.getElementById('stockNameDisplay');
    const changeEl = document.getElementById('stockChangeDisplay');
    const priceEl = document.getElementById('livePriceDisplay');
    const stock = watchlist.find(s => s.symbol === symbol);

    if (symEl) symEl.textContent = symbol;
    if (nameEl && stock) nameEl.textContent = `${stock.name} · ${stock.exchange}`;
    if (quote) {
      if (priceEl) priceEl.textContent = fmtPrice(quote.price);
      if (changeEl) {
        changeEl.textContent = `${quote.change >= 0 ? '+' : ''}${fmt(quote.change)} (${fmtPct(quote.changePct)})`;
        changeEl.className = 'stock-change ' + (quote.changePct >= 0 ? 'pos' : 'neg');
      }
    }
  }

  // ── Signal ────────────────────────────────────────────────
  function renderSignal(signal) {
    if (!signal) return;

    const card = document.getElementById('signalCard');
    const badge = document.getElementById('signalBadge');
    const reasons = document.getElementById('signalReasons');
    const scoreBarBull = document.getElementById('scoreBarBull');
    const scoreBarBear = document.getElementById('scoreBarBear');
    const sessionEl = document.getElementById('sessionLabel');

    if (card) {
      card.className = 'signal-card fade-in ' + signal.direction.toLowerCase();
    }

    if (badge) {
      const icons = { BUY: '▲ COMPRA', SELL: '▼ VENDI', WAIT: '◆ ATTENDI' };
      badge.className = 'signal-badge ' + signal.direction.toLowerCase();
      badge.innerHTML = `<span class="signal-pulse"></span>${icons[signal.direction]}`;
    }

    // Confidence ring
    renderConfidenceRing(signal.confidence, signal.direction);

    if (reasons) {
      reasons.innerHTML = signal.reasons.map(r =>
        `<div class="signal-reason">${r}</div>`
      ).join('');
    }

    // Score bar
    const total = signal.bullScore + signal.bearScore || 1;
    if (scoreBarBull) scoreBarBull.style.width = `${(signal.bullScore / total * 100).toFixed(0)}%`;
    if (scoreBarBear) scoreBarBear.style.width = `${(signal.bearScore / total * 100).toFixed(0)}%`;

    if (sessionEl) sessionEl.textContent = '';  // session shown in market badge already
  }

  function renderConfidenceRing(pct, direction) {
    const container = document.getElementById('confidenceRing');
    if (!container) return;
    const r = 28, circ = 2 * Math.PI * r;
    const fill = circ * (1 - pct / 100);
    const colorClass = direction === 'BUY' ? 'buy-ring' : direction === 'SELL' ? 'sell-ring' : 'wait-ring';
    container.className = `confidence-ring ${colorClass}`;
    container.innerHTML = `
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle class="ring-track" cx="36" cy="36" r="${r}"/>
        <circle class="ring-fill" cx="36" cy="36" r="${r}"
          stroke-dasharray="${circ}" stroke-dashoffset="${fill}"/>
      </svg>
      <div class="confidence-pct">${pct}%</div>`;
  }

  // ── Indicator badges ──────────────────────────────────────
  function renderIndicatorBadges(l) {
    const container = document.getElementById('indicatorsRow');
    if (!container || !l) return;

    const rsiClass = l.rsi ? (l.rsi > 70 ? 'bear' : l.rsi < 30 ? 'bull' : l.rsi > 55 ? 'bear' : 'bull') : 'neutral';
    const macdClass = l.macdHist ? (l.macdHist > 0 ? 'bull' : 'bear') : 'neutral';
    const emaClass = (l.ema9 && l.ema21) ? (l.ema9 > l.ema21 ? 'bull' : 'bear') : 'neutral';
    const volClass = l.relVol ? (l.relVol > 1.3 ? 'bull' : 'neutral') : 'neutral';
    const stochClass = l.stochK ? (l.stochK < 25 ? 'bull' : l.stochK > 75 ? 'bear' : 'neutral') : 'neutral';

    container.innerHTML = `
      <div class="ind-badge ${rsiClass}">
        <div class="ind-label">RSI 14</div>
        <div class="ind-value">${fmt(l.rsi, 1)}</div>
        <div class="ind-sub">${l.rsi > 70 ? 'Overbought' : l.rsi < 30 ? 'Oversold' : 'Normal'}</div>
      </div>
      <div class="ind-badge ${macdClass}">
        <div class="ind-label">MACD</div>
        <div class="ind-value">${fmt(l.macdHist, 4)}</div>
        <div class="ind-sub">${l.macdHist > 0 ? '↑ Bull' : '↓ Bear'}</div>
      </div>
      <div class="ind-badge ${emaClass}">
        <div class="ind-label">EMA Trend</div>
        <div class="ind-value">${l.ema9 && l.ema21 && l.ema9 > l.ema21 ? '↑ Bull' : '↓ Bear'}</div>
        <div class="ind-sub">9 vs 21</div>
      </div>
      <div class="ind-badge ${volClass}">
        <div class="ind-label">Volume</div>
        <div class="ind-value">${fmt(l.relVol, 1)}×</div>
        <div class="ind-sub">${l.relVol > 1.5 ? 'Alto' : l.relVol < 0.7 ? 'Basso' : 'Medio'}</div>
      </div>
      <div class="ind-badge ${stochClass}">
        <div class="ind-label">Stoch %K</div>
        <div class="ind-value">${fmt(l.stochK, 0)}</div>
        <div class="ind-sub">${l.stochK > 80 ? 'OB' : l.stochK < 20 ? 'OS' : 'OK'}</div>
      </div>
      <div class="ind-badge neutral">
        <div class="ind-label">ATR</div>
        <div class="ind-value">$${fmt(l.atr, 2)}</div>
        <div class="ind-sub">Volatilità</div>
      </div>`;
  }

  // ── Risk Panel ────────────────────────────────────────────
  function renderRiskPanel(analysis, quote) {
    const container = document.getElementById('riskPanel');
    if (!container) return;

    if (!analysis) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:0.75rem;text-align:center;padding:12px 0">
        Segnale WAIT – nessuna analisi rischio disponibile</div>`;
      return;
    }

    const dirLabel = analysis.direction === 'BUY' ? '🟢 COMPRA' : '🔴 VENDI';

    container.innerHTML = `
      <div class="risk-grid">
        <div class="risk-item">
          <div class="risk-item-label">Direzione</div>
          <div class="risk-item-value neutral">${dirLabel}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">N° Azioni</div>
          <div class="risk-item-value neutral">${analysis.shares}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">Entry Price</div>
          <div class="risk-item-value neutral">$${fmt(analysis.entryPrice)}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">Capitale usato</div>
          <div class="risk-item-value neutral">€${fmt(analysis.positionValueEur)} (${analysis.positionPct}% cap.)</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">🛑 Stop Loss</div>
          <div class="risk-item-value sl">$${fmt(analysis.slPrice)} (−${fmt(analysis.slPct)}%)</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">✅ Take Profit</div>
          <div class="risk-item-value tp">$${fmt(analysis.tpPrice)}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">Rischio Max</div>
          <div class="risk-item-value sl">−€${fmt(analysis.grossLossEur)}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">Profitto Att.</div>
          <div class="risk-item-value tp">+€${fmt(analysis.grossProfitEur)}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">R:R Effettivo</div>
          <div class="risk-item-value ${analysis.effectiveRR >= 1.5 ? 'tp' : 'sl'}">1 : ${fmt(analysis.effectiveRR)}</div>
        </div>
        <div class="risk-item">
          <div class="risk-item-label">Break-even</div>
          <div class="risk-item-value neutral">$${fmt(analysis.breakEvenPrice)}</div>
        </div>
      </div>
      ${analysis.warnings.map(w => `<div class="risk-warning">${w}</div>`).join('')}
      <button class="btn-add-trade" style="margin-top:10px" onclick="UI.openAddTradeModal()">
        + Registra questa operazione
      </button>`;
  }

  // ── News ──────────────────────────────────────────────────
  function renderNews(items) {
    const container = document.getElementById('newsContainer');
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.75rem">Nessuna notizia recente</div>';
      return;
    }
    container.innerHTML = items.slice(0, 4).map(n => {
      const date = new Date(n.datetime * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      return `
        <div class="news-item">
          <div class="news-headline" onclick="window.open('${n.url}','_blank')">${n.headline}</div>
          <div class="news-meta">${n.source} · ${date}</div>
        </div>`;
    }).join('');
  }

  // ── Journal ───────────────────────────────────────────────
  function renderJournalSummary(entries, watchData) {
    const summaryContainer = document.getElementById('journalSummary');
    if (!summaryContainer) return;

    let totalInvested = 0;
    let realizedPnl = 0;
    let livePnl = 0;

    entries.forEach(e => {
      if (e.status === 'closed') {
        realizedPnl += (e.pnlUsd || 0);
      } else if (e.status === 'open') {
        const invested = e.entryPrice * e.shares;
        totalInvested += invested;

        const stock = watchData && watchData[e.symbol];
        let currentPrice = null;
        if (stock && stock.livePrice) currentPrice = stock.livePrice;
        else if (stock && stock.quote) currentPrice = stock.quote.price;

        if (currentPrice && !isNaN(currentPrice)) {
          const pnl = e.direction === 'BUY'
            ? (currentPrice - e.entryPrice) * e.shares
            : (e.entryPrice - currentPrice) * e.shares;
          livePnl += pnl;
        }
      }
    });

    const formatMoney = (val) => {
      const sign = val >= 0 ? '+' : '';
      return `<span class="${val >= 0 ? 'pos' : 'neg'}" style="color:var(--${val >= 0 ? 'green' : 'red'})">${sign}$${Math.abs(val).toFixed(2)}</span>`;
    };

    if (entries.length === 0) {
      summaryContainer.innerHTML = '';
      return;
    }

    summaryContainer.innerHTML = `
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; font-size:0.75rem; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div>
          <div style="color:var(--text-muted);font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em">Capitale Investito</div>
          <div style="font-weight:700">$${totalInvested.toFixed(2)}</div>
        </div>
        <div>
          <div style="color:var(--text-muted);font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em">P&L Realizzato</div>
          <div style="font-weight:700">${formatMoney(realizedPnl)}</div>
        </div>
        <div style="grid-column:1/-1; padding-top:6px; border-top:1px solid rgba(255,255,255,0.05)">
          <div style="color:var(--text-muted);font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em">P&L Non Realizzato (Live)</div>
          <div style="font-weight:700; font-size:0.9rem">${formatMoney(livePnl)}</div>
        </div>
      </div>
    `;
  }
  function renderJournal(entries) {
    const container = document.getElementById('journalContainer');
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.75rem;text-align:center;padding:8px">Nessuna operazione registrata</div>';
      return;
    }
    container.innerHTML = entries.slice(0, 6).map(e => {
      let pnlHtml = '';
      if (e.status === 'open') {
        pnlHtml = `<div id="jpnl-${e.id}" class="journal-pnl live-pnl" style="font-size:0.8rem;opacity:0.8">Calcolo live…</div>`;
      } else if (e.pnlUsd !== undefined) {
        pnlHtml = `<div class="journal-pnl ${e.pnlUsd >= 0 ? 'pos' : 'neg'}">${e.pnlUsd >= 0 ? '+' : ''}$${Math.abs(e.pnlUsd).toFixed(2)}</div>`;
      }
      return `
        <div class="journal-item">
          <div class="journal-header">
            <span class="journal-sym">${e.symbol}</span>
            <span class="journal-dir ${e.direction.toLowerCase()}">${e.direction}</span>
          </div>
          <div class="journal-detail">
            ${e.shares} az. · Entry $${e.entryPrice?.toFixed(2) || '–'}
            ${e.exitPrice ? ' → Exit $' + e.exitPrice.toFixed(2) : ''}
          </div>
          <div class="journal-detail">${e.dateStr}</div>
          ${pnlHtml}
          ${e.status === 'open' ? `<button onclick="UI.promptCloseEntry(${e.id})" style="margin-top:4px;padding:3px 8px;font-size:0.65rem;cursor:pointer;background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.3);border-radius:4px;color:var(--red)">Chiudi posizione</button>` : ''}
        </div>`;
    }).join('');
  }

  // ── Modals & Toasts ────────────────────────────────────────
  function openAddTradeModal() {
    const data = window.App?.getSelectedData();
    const sym = window.App?.getSelectedSymbol() || '';

    // Provide fallback if analysis is null (e.g., WAIT signal)
    const a = data?.analysis || {
      direction: 'BUY',
      entryPrice: data?.quote?.price || 0,
      slPrice: (data?.quote?.price || 0) * 0.98,
      tpPrice: (data?.quote?.price || 0) * 1.04,
      shares: 10
    };

    const modal = document.createElement('div');
    modal.id = 'tradeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(6,12,26,0.8);z-index:9995;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border-glow);border-radius:18px;padding:24px;min-width:320px;max-width:420px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:16px">📓 Registra Operazione – ${sym}</div>
        <div style="display:grid;gap:10px">
          <div class="form-group">
            <label class="form-label">Direzione</label>
            <select id="m-dir" class="form-input">
              <option value="BUY" ${a.direction === 'BUY' ? 'selected' : ''}>BUY – Acquisto</option>
              <option value="SELL" ${a.direction === 'SELL' ? 'selected' : ''}>SELL – Vendita</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Prezzo di Entrata ($)</label>
            <input id="m-entry" class="form-input" type="number" step="0.01" value="${a.entryPrice}">
          </div>
          <div class="form-group">
            <label class="form-label">Stop Loss ($)</label>
            <input id="m-sl" class="form-input" type="number" step="0.01" value="${a.slPrice}">
          </div>
          <div class="form-group">
            <label class="form-label">Take Profit ($)</label>
            <input id="m-tp" class="form-input" type="number" step="0.01" value="${a.tpPrice}">
          </div>
          <div class="form-group">
            <label class="form-label">N° Azioni</label>
            <input id="m-shares" class="form-input" type="number" min="1" value="${a.shares}">
          </div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button onclick="document.getElementById('tradeModal').remove()" style="flex:1;padding:9px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text-secondary);cursor:pointer">Annulla</button>
            <button onclick="UI.confirmAddTrade()" style="flex:2;padding:9px;background:linear-gradient(135deg,var(--accent),#818cf8);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer">✓ Registra</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function confirmAddTrade() {
    const sym = window.App?.getSelectedSymbol() || '';
    const entry = {
      symbol: sym,
      direction: document.getElementById('m-dir').value,
      entryPrice: parseFloat(document.getElementById('m-entry').value),
      slPrice: parseFloat(document.getElementById('m-sl').value),
      tpPrice: parseFloat(document.getElementById('m-tp').value),
      shares: parseInt(document.getElementById('m-shares').value),
      status: 'open',
    };
    document.getElementById('tradeModal')?.remove();
    window.App?.addJournalEntry(entry);
  }

  function promptCloseEntry(id) {
    const price = parseFloat(prompt('Inserisci il prezzo di uscita ($):'));
    if (!isNaN(price)) window.App?.closeJournalEntry(id, price);
  }

  function updateJournalLivePrices(entries, watchData) {
    entries.forEach(e => {
      if (e.status !== 'open') return;
      const el = document.getElementById(`jpnl-${e.id}`);
      if (!el) return;

      const stock = watchData[e.symbol];
      let currentPrice = null;
      if (stock && stock.livePrice) currentPrice = stock.livePrice;
      else if (stock && stock.quote) currentPrice = stock.quote.price;

      if (!currentPrice || isNaN(currentPrice)) {
        el.textContent = 'In attesa del prezzo...';
        return;
      }

      const pnl = e.direction === 'BUY'
        ? (currentPrice - e.entryPrice) * e.shares
        : (e.entryPrice - currentPrice) * e.shares;

      const pnlPct = (pnl / (e.entryPrice * e.shares)) * 100;

      const sign = pnl >= 0 ? '+' : '';
      el.className = 'journal-pnl live-pnl ' + (pnl >= 0 ? 'pos' : 'neg');
      const text = `LIVE: ${sign}$${Math.abs(pnl).toFixed(2)} (${sign}${Math.abs(pnlPct).toFixed(2)}%)`;

      if (el.textContent !== text) {
        el.textContent = text;
        // Small flash animation
        el.style.opacity = '1';
        el.style.transform = 'scale(1.02)';
        setTimeout(() => {
          el.style.opacity = '0.9';
          el.style.transform = 'scale(1)';
        }, 300);
      }
    });
  }

  // ── Exit Alert ────────────────────────────────────────────
  function showExitAlert(symbol, exitInfo) {
    const existing = document.getElementById('exitAlert');
    if (existing) return; // already showing
    const el = document.createElement('div');
    el.id = 'exitAlert';
    el.className = 'exit-alert';
    el.innerHTML = `
      <strong>⚠️ SEGNALE USCITA – ${symbol}</strong><br>
      <span style="font-weight:400;font-size:0.8rem">${exitInfo.reasons.join(' · ')}</span>
      <span class="exit-close" onclick="this.parentElement.remove()">✕</span>`;
    document.body.appendChild(el);
    setTimeout(() => el?.remove(), 12000);
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── Loading overlay ───────────────────────────────────────
  function setLoading(active) {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.toggle('active', active);
  }

  return {
    updateMarketStatus, renderWatchlist, renderWatchlistPrices,
    highlightSelected, updateLivePrice, updateSelectedPrice, updateStockHeader,
    renderSignal, renderIndicatorBadges, renderRiskPanel,
    renderNews, renderJournal, renderJournalSummary, updateJournalLivePrices, showToast, showExitAlert,
    setLoading, openAddTradeModal, confirmAddTrade, promptCloseEntry,
  };
})();
