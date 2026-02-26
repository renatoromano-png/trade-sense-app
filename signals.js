/**
 * signals.js – Stock Trading Signal Engine
 * Multi-factor scoring: EMA trend + RSI + MACD + Volume + Bollinger + Stochastic
 * Requires 3+ confirming factors for a valid signal (reduces false positives).
 */

var SignalsEngine = (() => {

    // US Market session status
    function getSessionInfo() {
        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const isDST = (() => {
            const jan = new Date(now.getFullYear(), 0, 1);
            const jul = new Date(now.getFullYear(), 6, 1);
            return now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        })();
        const etOffset = isDST ? -4 * 3600000 : -5 * 3600000;
        const et = new Date(utcMs + etOffset);
        const hours = et.getHours() + et.getMinutes() / 60;
        const day = et.getDay();

        if (day === 0 || day === 6) return { label: 'Weekend', tradeable: false, color: 'red' };
        if (hours >= 9.5 && hours < 16) return { label: 'Market Open 🟢', tradeable: true, color: 'green' };
        if (hours >= 4 && hours < 9.5) return { label: 'Pre-Market 🟡', tradeable: false, color: 'yellow' };
        if (hours >= 16 && hours < 20) return { label: 'After Hours 🟡', tradeable: false, color: 'yellow' };
        return { label: 'Closed 🔴', tradeable: false, color: 'red' };
    }

    /**
     * Generate a signal for a given stock.
     * @param {object} ind  - Indicators.computeAll() result
     * @param {string} symbol
     * @param {object} quote - { price, changePct }
     */
    function generateSignal(ind, symbol, quote = {}) {
        const l = ind.last;
        const session = getSessionInfo();

        const bullFactors = [];
        const bearFactors = [];
        let bullScore = 0;
        let bearScore = 0;

        // ── FACTOR 1: EMA Trend Alignment (Weight: 25) ────────────
        if (l.ema9 && l.ema21) {
            if (l.ema9 > l.ema21 && l.close > l.ema21) {
                bullScore += 20;
                bullFactors.push('EMA 9 > EMA 21 → trend rialzista a breve');
            } else if (l.ema9 < l.ema21 && l.close < l.ema21) {
                bearScore += 20;
                bearFactors.push('EMA 9 < EMA 21 → trend ribassista a breve');
            }
            if (l.ema50) {
                if (l.close > l.ema50) { bullScore += 8; bullFactors.push('Prezzo sopra EMA 50 (trend medio positivo)'); }
                else { bearScore += 8; bearFactors.push('Prezzo sotto EMA 50 (trend medio negativo)'); }
            }
            if (l.ema200) {
                if (l.close > l.ema200) { bullScore += 7; bullFactors.push('Sopra EMA 200 (Golden Zone)'); }
                else { bearScore += 7; bearFactors.push('Sotto EMA 200 (Death Zone)'); }
            }
        }

        // ── FACTOR 2: RSI (Weight: 20) ────────────────────────────
        if (l.rsi !== null) {
            const r = l.rsi;
            if (r >= 45 && r <= 63) { bullScore += 15; bullFactors.push(`RSI ${r.toFixed(1)} – momentum rialzista sano`); }
            else if (r < 30) { bullScore += 18; bullFactors.push(`RSI ${r.toFixed(1)} – ipervenduto (rimbalzo atteso)`); }
            else if (r > 70) { bearScore += 18; bearFactors.push(`RSI ${r.toFixed(1)} – ipercomprato (correzione attesa)`); }
            else if (r >= 37 && r < 45) { bullScore += 6; bullFactors.push(`RSI ${r.toFixed(1)} – possibile rimbalzo`); }
            else if (r > 63 && r <= 70) { bearScore += 10; bearFactors.push(`RSI ${r.toFixed(1)} – zona surriscaldata`); }
        }

        // ── FACTOR 3: MACD (Weight: 20) ──────────────────────────
        if (l.macdLine !== null && l.macdSignal !== null) {
            if (l.macdLine > l.macdSignal) { bullScore += 12; bullFactors.push('MACD sopra linea segnale'); }
            else { bearScore += 12; bearFactors.push('MACD sotto linea segnale'); }

            if (l.macdHist !== null && l.macdHistPrev !== null) {
                if (l.macdHist > 0 && l.macdHist > l.macdHistPrev) { bullScore += 10; bullFactors.push('Istogramma MACD in espansione positiva'); }
                else if (l.macdHist < 0 && l.macdHist < l.macdHistPrev) { bearScore += 10; bearFactors.push('Istogramma MACD in espansione negativa'); }
                // Crossover just happened
                else if (l.macdHist > 0 && l.macdHistPrev <= 0) { bullScore += 15; bullFactors.push('🔀 Crossover MACD rialzista (segnale forte)'); }
                else if (l.macdHist < 0 && l.macdHistPrev >= 0) { bearScore += 15; bearFactors.push('🔀 Crossover MACD ribassista (segnale forte)'); }
            }
        }

        // ── FACTOR 4: Volume Confirmation (Weight: 15) ────────────
        if (l.relVol !== null) {
            if (l.relVol > 1.5) {
                // High volume confirms the move direction
                const changePct = quote.changePct || 0;
                if (changePct > 0) { bullScore += 15; bullFactors.push(`Volume ${l.relVol.toFixed(1)}× la media → conferma rialzo`); }
                else if (changePct < 0) { bearScore += 15; bearFactors.push(`Volume ${l.relVol.toFixed(1)}× la media → conferma ribasso`); }
            } else if (l.relVol < 0.6) {
                // Low volume: weak signal
                bullScore *= 0.85;
                bearScore *= 0.85;
            }
            // OBV trend
            if (l.obv && l.obvEma) {
                if (l.obv > l.obvEma) { bullScore += 8; bullFactors.push('OBV sopra la sua EMA (accumulazione)'); }
                else { bearScore += 8; bearFactors.push('OBV sotto la sua EMA (distribuzione)'); }
            }
        }

        // ── FACTOR 5: Bollinger Bands (Weight: 10) ────────────────
        if (l.pctB !== null) {
            if (l.pctB < 0.15) { bullScore += 12; bullFactors.push('Prezzo alla banda BB inferiore (mean reversion)'); }
            else if (l.pctB > 0.85) { bearScore += 12; bearFactors.push('Prezzo alla banda BB superiore (mean reversion)'); }
            else if (l.pctB > 0.5 && l.pctB < 0.8) bullScore += 4;
            else if (l.pctB < 0.5 && l.pctB > 0.2) bearScore += 4;
        }

        // ── FACTOR 6: Stochastic (Weight: 10) ────────────────────
        if (l.stochK !== null && l.stochD !== null) {
            if (l.stochK > l.stochD && l.stochK < 80) { bullScore += 8; bullFactors.push(`Stocastico bull K(${l.stochK.toFixed(0)}) > D(${l.stochD.toFixed(0)})`); }
            else if (l.stochK < l.stochD && l.stochK > 20) { bearScore += 8; bearFactors.push(`Stocastico bear K(${l.stochK.toFixed(0)}) < D(${l.stochD.toFixed(0)})`); }
            if (l.stochK < 20) { bullScore += 10; bullFactors.push(`Stocastico ipervenduto (${l.stochK.toFixed(0)})`); }
            if (l.stochK > 80) { bearScore += 10; bearFactors.push(`Stocastico ipercomprato (${l.stochK.toFixed(0)})`); }
        }

        // ── Direction decision ────────────────────────────────────
        const diff = bullScore - bearScore;
        const total = bullScore + bearScore || 1;
        let direction = 'WAIT';
        let reasons = [];
        let confidence = 0;

        if (diff >= 28 && bullScore >= 35) {
            direction = 'BUY';
            reasons = bullFactors;
            confidence = Math.min(95, Math.round((bullScore / total) * 100));
        } else if (diff <= -28 && bearScore >= 35) {
            direction = 'SELL';
            reasons = bearFactors;
            confidence = Math.min(95, Math.round((bearScore / total) * 100));
        } else {
            direction = 'WAIT';
            reasons = ['Segnali contrastanti – attendere una direzione chiara'];
            confidence = 0;
        }

        // Penalize if market not open (soft filter)
        if (!session.tradeable && confidence > 0) {
            confidence = Math.max(0, confidence - 15);
            reasons.push(`⚠️ Attenzione: mercato ${session.label} – eseguire solo su Fineco se già aperto`);
        }

        return {
            symbol, direction, confidence, reasons,
            bullScore: Math.round(bullScore),
            bearScore: Math.round(bearScore),
            session,
            indicators: {
                rsi: l.rsi, macdHist: l.macdHist, ema9: l.ema9, ema21: l.ema21,
                stochK: l.stochK, pctB: l.pctB, relVol: l.relVol, atr: l.atr,
            },
            timestamp: Date.now(),
        };
    }

    /**
     * Check if an open position should be closed.
     */
    function checkExitSignal(trade, currentPrice, ind) {
        const l = ind.last;
        const reasons = [];
        let shouldExit = false;
        const pnlPct = trade.direction === 'BUY'
            ? (currentPrice - trade.entryPrice) / trade.entryPrice * 100
            : (trade.entryPrice - currentPrice) / trade.entryPrice * 100;

        if (currentPrice <= trade.slPrice) {
            shouldExit = true;
            reasons.push(`🛑 Stop Loss colpito a $${trade.slPrice.toFixed(2)} (−${Math.abs(pnlPct).toFixed(1)}%)`);
        }
        if (currentPrice >= trade.tpPrice && trade.direction === 'BUY') {
            shouldExit = true;
            reasons.push(`✅ Take Profit raggiunto a $${trade.tpPrice.toFixed(2)} (+${pnlPct.toFixed(1)}%)`);
        }
        if (currentPrice <= trade.tpPrice && trade.direction === 'SELL') {
            shouldExit = true;
            reasons.push(`✅ Take Profit raggiunto a $${trade.tpPrice.toFixed(2)} (+${pnlPct.toFixed(1)}%)`);
        }
        if (!shouldExit && l.rsi) {
            if (trade.direction === 'BUY' && l.rsi > 75) { shouldExit = true; reasons.push(`⚠️ RSI ipercomprato ${l.rsi.toFixed(1)} – considerare uscita`); }
            if (trade.direction === 'SELL' && l.rsi < 25) { shouldExit = true; reasons.push(`⚠️ RSI ipervenduto ${l.rsi.toFixed(1)} – considerare uscita`); }
        }
        if (!shouldExit && l.macdHist !== null && l.macdHistPrev !== null) {
            if (trade.direction === 'BUY' && l.macdHist < 0 && l.macdHistPrev >= 0) { shouldExit = true; reasons.push('⚠️ Crossover MACD ribassista – uscita consigliata'); }
            if (trade.direction === 'SELL' && l.macdHist > 0 && l.macdHistPrev <= 0) { shouldExit = true; reasons.push('⚠️ Crossover MACD rialzista – uscita consigliata'); }
        }

        return { shouldExit, reasons, pnlPct: parseFloat(pnlPct.toFixed(2)) };
    }

    return { generateSignal, checkExitSignal, getSessionInfo };
})();
