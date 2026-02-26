/**
 * risk.js – Stock Risk Management & Position Sizing
 * Risk rules: max 1-3% of capital per trade, min R:R 1:2,
 * ATR-based stop loss, commission-adjusted calculations.
 */

var RiskManager = (() => {

    // Typical stock commissions (Fineco: ~€3.95/trade for US stocks)
    const DEFAULT_COMMISSION = 3.95; // EUR per trade (in + out = ×2)

    /**
     * Full trade analysis for a stock position.
     * @param {object} p - Parameters
     */
    function analyzeTradeSetup(p) {
        const {
            capital,          // number: account size in €
            riskPct,          // number: max risk % (e.g. 1.5)
            direction,        // 'BUY' | 'SELL'
            symbol,
            entryPrice,       // current price in USD
            atr,              // ATR value in $ (price units)
            pivots,           // pivot points object
            rrRatio = 2.0,    // desired R:R ratio
            commissionEur = DEFAULT_COMMISSION,
            eurUsdRate = 1.08, // approximate EUR/USD for margin conversion
        } = p;

        if (!entryPrice || !atr) return null;

        // ── 1. Stop Loss (ATR-based) ──────────────────────────────
        const atrMultiplier = 1.5;
        const slDistance = atr * atrMultiplier;  // in $
        const slPct = (slDistance / entryPrice) * 100;

        let slPrice, tpPrice;
        if (direction === 'BUY') {
            slPrice = entryPrice - slDistance;
            tpPrice = entryPrice + slDistance * rrRatio;
        } else {
            slPrice = entryPrice + slDistance;
            tpPrice = entryPrice - slDistance * rrRatio;
        }

        // Snap SL to nearby pivot if within 20% of SL distance
        if (pivots) {
            const levels = [pivots.S1, pivots.S2, pivots.R1, pivots.R2, pivots.PP];
            levels.forEach(lvl => {
                if (!lvl) return;
                if (direction === 'BUY' && lvl < entryPrice && Math.abs(lvl - slPrice) < slDistance * 0.25) {
                    slPrice = lvl - 0.01; // just below support
                }
                if (direction === 'SELL' && lvl > entryPrice && Math.abs(lvl - slPrice) < slDistance * 0.25) {
                    slPrice = lvl + 0.01; // just above resistance
                }
            });
        }

        // Recalculate real SL distance after pivot snap
        const realSlDistance = Math.abs(entryPrice - slPrice);

        // ── 2. Risk Amount in EUR ─────────────────────────────────
        const riskAmountEur = capital * (riskPct / 100);
        const riskAmountUsd = riskAmountEur * eurUsdRate;

        // ── 3. Position Sizing (shares) ───────────────────────────
        const totalCostPerShare = realSlDistance; // risk per share in USD
        let shares = Math.floor(riskAmountUsd / totalCostPerShare);
        shares = Math.max(1, shares); // minimum 1 share

        // ── 4. Capital check ──────────────────────────────────────
        const positionValueUsd = shares * entryPrice;
        const positionValueEur = positionValueUsd / eurUsdRate;
        const positionPct = (positionValueEur / capital) * 100;

        // ── 5. P&L projections ────────────────────────────────────
        const totalCommission = commissionEur * 2; // entry + exit
        const grossProfitEur = (shares * Math.abs(entryPrice - tpPrice) / eurUsdRate) - totalCommission;
        const grossLossEur = (shares * realSlDistance / eurUsdRate) + totalCommission;
        const effectiveRR = grossProfitEur / Math.max(grossLossEur, 0.01);

        // Break-even price (including commission)
        const commissionPerShareUsd = (totalCommission * eurUsdRate) / shares;
        const breakEvenPrice = direction === 'BUY'
            ? entryPrice + commissionPerShareUsd
            : entryPrice - commissionPerShareUsd;

        // ── 6. Warnings ───────────────────────────────────────────
        const warnings = [];
        if (effectiveRR < 1.2) warnings.push('⛔ R:R effettivo troppo basso – trade non consigliato');
        if (positionPct > 30) warnings.push('⚠️ Posizione supera il 30% del capitale – rischio concentrazione');
        if (commissionEur / riskAmountEur > 0.1) warnings.push('⚠️ Le commissioni sono >10% del rischio – considera un capitale maggiore');
        if (slPct < 0.5) warnings.push('ℹ️ Stop Loss molto stretto – potrebbe essere colpito dal rumore di mercato');
        if (slPct > 8) warnings.push('⚠️ Stop Loss ampio – attenzione al drawdown');

        return {
            direction,
            symbol,
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            slPrice: parseFloat(slPrice.toFixed(2)),
            tpPrice: parseFloat(tpPrice.toFixed(2)),
            slDistanceUsd: parseFloat(realSlDistance.toFixed(2)),
            tpDistanceUsd: parseFloat(Math.abs(entryPrice - tpPrice).toFixed(2)),
            slPct: parseFloat(slPct.toFixed(2)),
            shares,
            positionValueEur: parseFloat(positionValueEur.toFixed(2)),
            positionValueUsd: parseFloat(positionValueUsd.toFixed(2)),
            positionPct: parseFloat(positionPct.toFixed(1)),
            riskAmountEur: parseFloat(riskAmountEur.toFixed(2)),
            grossProfitEur: parseFloat(grossProfitEur.toFixed(2)),
            grossLossEur: parseFloat(Math.abs(grossLossEur).toFixed(2)),
            effectiveRR: parseFloat(effectiveRR.toFixed(2)),
            commissionEur: parseFloat(totalCommission.toFixed(2)),
            breakEvenPrice: parseFloat(breakEvenPrice.toFixed(2)),
            rrRatio,
            warnings,
        };
    }

    /**
     * Quick position size estimate (for the calculator panel).
     */
    function quickSize(capital, riskPct, slPct, entryPrice, eurUsdRate = 1.08) {
        const riskEur = capital * (riskPct / 100);
        const riskUsd = riskEur * eurUsdRate;
        const slPerShare = entryPrice * (slPct / 100);
        const shares = Math.max(1, Math.floor(riskUsd / slPerShare));
        return { shares, riskEur: riskEur.toFixed(2), positionUsd: (shares * entryPrice).toFixed(2) };
    }

    return { analyzeTradeSetup, quickSize, DEFAULT_COMMISSION };
})();
