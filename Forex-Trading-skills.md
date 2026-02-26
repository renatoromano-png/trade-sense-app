Ecco un pacchetto completo di "Skill" (competenze, checklist e direttive) progettato per istruire un assistente AI (come Claude, Copilot, Cursor, ecc.) sullo sviluppo di sistemi e logiche di trading sul Forex. 

Questo pacchetto è strutturato per essere "portatile" e fornisce le basi per comprendere le meccaniche di mercato, la leva, il trading intraday e lo sviluppo di script (algoritmi), seguendo rigorosamente le best practice ed evitando gli errori più comuni dei principianti.

---

# 🤖 PACKAGE SKILL AI: EXPERT FOREX TRADING AGENT

## MODULO 1: Meccaniche di Base (Buy, Sell e Leva)
Istruzioni per far comprendere all'AI come processare gli ordini e calcolare i margini.

*   **Comprendere le Coppie di Valute (Buy/Sell):** Nel Forex si scambia sempre una valuta per un'altra. La prima è la *valuta base*, la seconda è la *valuta di quotazione*. 
    *   **Andare Long (Buy):** Si acquista se si prevede che la valuta base si apprezzerà rispetto a quella di quotazione. Si acquista al prezzo di *Ask*.
    *   **Andare Short (Sell):** Si vende se si prevede che la valuta base si deprezzerà. Si vende al prezzo di *Bid*.
*   **Gestione della Leva Finanziaria (Leverage):** La leva permette di controllare posizioni grandi con capitali ridotti (es. 100.000$ con 1.000$), ma è un'arma a doppio taglio che amplifica sia i profitti che le perdite.
    *   *Regolamentazione (Best Practice):* Per i trader retail, in giurisdizioni sicure (es. ESMA in Europa, FCA nel Regno Unito), la leva massima consentita per le coppie major (es. EUR/USD) è limitata a 30:1, e 20:1 per le coppie non-major. Le AI devono sempre programmare sistemi che calcolino il *margin call* e considerino la protezione dal saldo negativo.
*   **Calcolo dei Costi:** Un'AI deve sempre includere lo *Spread* (la differenza tra prezzo Bid e Ask) e le commissioni nei calcoli del rischio e del profitto.

## MODULO 2: Modelli Operativi Intraday (Day Trading & Scalping)
L'Intraday prevede l'apertura e la chiusura delle posizioni all'interno della stessa giornata.

*   **Regola d'Oro dell'Intraday:** Chiudere tutte le posizioni prima della chiusura del mercato. Questo evita le commissioni di overnight (rollover/swap) ed elimina il rischio di "gap del fine settimana" (salti di prezzo imprevisti a mercati chiusi che potrebbero saltare gli stop loss).
*   **Scalping vs Day Trading:** 
    *   *Scalping:* Operazioni che durano da pochi secondi a minuti per catturare piccoli movimenti di prezzo. Richiede spread strettissimi e un'esecuzione rapidissima.
    *   *Day Trading:* Posizioni mantenute per alcune ore, sfruttando le fluttuazioni giornaliere ma senza esposizione notturna.
*   **Evitare i mercati caotici:** Istruire l'algoritmo a sospendere il trading (o alzare i filtri di rischio) in prossimità di notizie macroeconomiche ad alto impatto (es. NFP - Non-Farm Payrolls, decisioni sui tassi di interesse), durante le festività bancarie o in momenti di bassa liquidità (es. apertura/chiusura del mercato).

## MODULO 3: Gestione del Rischio e Psicologia Matematica (Risk Management)
Le istruzioni per evitare che il bot/trader bruci il conto (Blowing up the account).

*   **Position Sizing (Dimensionamento della Posizione):** Non rischiare mai più dell'1% - 3% del capitale totale su un singolo trade. Se il conto è di 100$, il rischio massimo deve essere di 3$. Utilizzare lotti micro (1.000 unità) o nano (100 unità) se il capitale è ridotto.
*   **Rapporto Rischio/Rendimento (Risk/Reward Ratio):** L'AI deve programmare trade con un rapporto minimo di 1:2. Se si rischiano 5 pip (Stop Loss), l'obiettivo minimo (Take Profit) deve essere di 10 pip. 
    *   *Attenzione allo spread:* Nel calcolare il Risk/Reward, il bot deve sottrarre lo spread. Se lo spread è di 2 pip, un rischio di 5 pip e un target di 10 pip diventano un rischio reale di 7 pip per un guadagno netto di 8 pip (rapporto 1:1.14, insufficiente).
*   **Ordini di Protezione Obbligatori:** Implementare *sempre* e a monte lo Stop-Loss e il Take-Profit prima di eseguire l'ordine a mercato, per eliminare la componente emotiva.

## MODULO 4: Istruzioni di Sviluppo per Programmatori AI (Coding Scripts)
Quando si chiede a un'AI (es. Claude o Copilot) di scrivere un bot di trading, deve conoscere gli ecosistemi di sviluppo.

*   **Scelta del Linguaggio e della Piattaforma:**
    *   **MetaTrader 4/5 (MQL4 / MQL5):** Linguaggi basati su C++. Ideali per l'accesso a un vastissimo ecosistema di Expert Advisors (EA) già pronti e un'enorme community. L'ottimizzatore di MT4 permette di testare un solo criterio alla volta.
    *   **cTrader (cAlgo / C#):** Linguaggio C# standard (.NET). Preferibile per programmatori professionisti, offre un'architettura più pulita, facilità di integrazione con librerie esterne e ottime prestazioni per lo scalping (esecuzione rapida e prezzi trasparenti).
    *   **TradingView (Pine Script):** Ottimo per creare indicatori custom, strategie di backtesting visive e inviare Alert automatizzati (es. tramite webhook a MT4/MT5).
*   **Struttura Base di un Algoritmo Robusto (Best Practice di Codice):**
    1.  **Dichiarazione:** Definire capitale iniziale, valuta base, commissioni e slippage nel setup (es. in Pine Script usare `strategy(commission_type = strategy.commission.percent, slippage = 10)`).
    2.  **Condizioni di Entrata:** Combinare Analisi Tecnica (es. crossover di indicatori come RSI o MACD o rottura di resistenze) con filtri di trend (es. l'operazione deve seguire il trend dominante stabilito su un timeframe superiore come H4 o Daily).
    3.  **Condizioni di Uscita e Gestione:** Calcolo dinamico dello Stop Loss (es. posizionandolo sotto il *pivot point* o il minimo recente) e calcolo dinamico della *Position Size* in base al rischio %.
    4.  **Assenza di Repainting:** Assicurarsi che lo script valuti la condizione solo alla *chiusura* della candela per evitare falsi segnali (in Pine Script, calcolare i segnali su candele chiuse).

## ✅ CHECKLIST DI VALIDAZIONE PER L'ASSISTENTE AI
Prima di generare codice o consigliare un trade, l'AI deve verificare:
- [ ] Il sistema include una direttiva per calcolare la dimensione del lotto (Standard, Mini, Micro) basata sul rischio %?
- [ ] Il sistema imposta uno Stop Loss rigido *al momento* dell'entrata a mercato?
- [ ] Il sistema evita i gap del weekend chiudendo le posizioni il venerdì (se intraday)?
- [ ] Il calcolo del Take Profit tiene conto dello Spread del broker?
- [ ] Il codice gestisce lo slippage e le commissioni durante le fasi di backtest per non creare risultati irrealistici?