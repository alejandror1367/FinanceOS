/**
 * Quotes.gs — Cotizaciones en tiempo real via Alpaca Markets (primario) y Yahoo Finance (fallback/FX/BVC).
 * Cachea 15 min en CacheService para no exceder límites.
 *
 * Fuentes:
 *   - Alpaca Markets API  → acciones US, ETFs, crypto (BTC-USD, ETH-USD). Batch único por llamada.
 *   - Yahoo Finance v8    → pares FX (USDCOP=X, EURCOP=X), BVC Colombia (.CL), bolsas europeas (.DE, .L, …).
 *                           También actúa como fallback si Alpaca no devuelve datos para un ticker.
 *
 * Configuración requerida (Script Properties en Apps Script):
 *   ALPACA_KEY_ID     — API Key ID de alpaca.markets
 *   ALPACA_SECRET_KEY — API Secret Key de alpaca.markets
 *
 * Soporta: acciones US/globales, ETFs, crypto (BTC-USD), BVC Colombia (.CL)
 * Acción: getQuotes?tickers=AAPL,VUG,BTC-USD,PFBANCOL.CL
 *
 * BE-003 (TD-02): incluye siempre los pares FX USDCOP=X y EURCOP=X para que
 * priceService.fxRates se pueble en cada refresh de Inversiones. Los tickers FX
 * se inyectan internamente sin aparecer en la respuesta de quotes; el mapa
 * fxRates se devuelve como campo separado del mismo JSON {success,data}.
 */

var QUOTE_CACHE_TTL_ = 900; // 15 minutos

// Tickers de pares FX que siempre se incluyen al llamar a getQuotes_.
// Yahoo Finance los expresa como USDCOP=X, EURCOP=X, etc.
var FX_TICKERS_ = ['USDCOP=X', 'EURCOP=X'];

// Divisa base local (COP). Si en el futuro cambia, ajustar aquí y en Config.gs.
var FX_BASE_CURRENCY_ = 'COP';

// Sufijos de bolsas europeas y otras plazas no-US que deben ir a Yahoo.
var INTL_EXCHANGE_SUFFIXES_ = ['.DE', '.L', '.MC', '.PA', '.AS', '.MI', '.TO', '.AX', '.HK', '.T'];

// Divisas conocidas para detectar pares crypto en formato Yahoo (BTC-USD, ETH-EUR…)
var CRYPTO_QUOTE_CURRENCIES_ = ['USD', 'EUR', 'BTC', 'ETH', 'USDT', 'USDC'];

/**
 * Determina si un ticker debe ser consultado en Alpaca (US equity / ETF / crypto) o en Yahoo.
 *
 * Reglas de exclusión (→ Yahoo):
 *   1. Termina en =X          → par FX (USDCOP=X, EURUSD=X).
 *   2. Termina en .CL         → BVC Colombia (PFBANCOL.CL).
 *   3. Contiene .<SUFIJO>     → bolsa internacional (.DE, .L, .MC, .PA, .AS, .MI, .TO, .AX, .HK, .T).
 *
 * Todo lo demás (AAPL, VUG, BTC-USD, ETH-USD) → Alpaca.
 */
function isUsEquity_(ticker) {
  var t = ticker.toUpperCase();

  // Regla 1: par FX de Yahoo
  if (t.slice(-2) === '=X') return false;

  // Regla 2: BVC Colombia
  if (t.slice(-3) === '.CL') return false;

  // Regla 3: sufijos de bolsas internacionales
  for (var i = 0; i < INTL_EXCHANGE_SUFFIXES_.length; i++) {
    if (t.indexOf(INTL_EXCHANGE_SUFFIXES_[i]) >= 0) return false;
  }

  return true;
}

/**
 * Consulta Alpaca Markets en batch para un array de tickers US/ETF/crypto.
 *
 * - Separa equity y crypto internamente (crypto: formato BTC-USD → BTC/USD).
 * - Hace hasta 2 llamadas HTTP (equity + crypto) en lugar de N llamadas individuales.
 * - Cachea cada resultado individualmente al terminar.
 * - Si las claves no están configuradas devuelve {} sin lanzar error.
 * - Si el endpoint responde con error HTTP, devuelve {} (el caller hace fallback a Yahoo).
 *
 * @param {string[]} tickers  Tickers en formato frontend (AAPL, BTC-USD, etc.)
 * @param {object}   cache    Instancia de CacheService.getScriptCache()
 * @returns {object}          { AAPL: {quote}, 'BTC-USD': {quote}, … }
 */
function fetchAlpacaSnapshots_(tickers, cache) {
  var props = PropertiesService.getScriptProperties();
  var keyId  = props.getProperty('ALPACA_KEY_ID');
  var secret = props.getProperty('ALPACA_SECRET_KEY');

  if (!keyId || !secret) {
    Logger.log('Quotes.gs: ALPACA_KEY_ID / ALPACA_SECRET_KEY no configuradas — usando solo Yahoo.');
    return {};
  }

  var headers = {
    'APCA-API-KEY-ID':     keyId,
    'APCA-API-SECRET-KEY': secret,
    'Accept':              'application/json',
  };

  // Separar equity y crypto
  var equityTickers = [];
  var cryptoTickers = []; // formato Yahoo: BTC-USD

  tickers.forEach(function(t) {
    if (isCryptoTicker_(t)) {
      cryptoTickers.push(t);
    } else {
      equityTickers.push(t);
    }
  });

  var results = {};

  // --- Equity ---
  if (equityTickers.length) {
    try {
      var eUrl = 'https://data.alpaca.markets/v2/stocks/snapshots?symbols=' +
                 encodeURIComponent(equityTickers.join(','));
      var eResp = UrlFetchApp.fetch(eUrl, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true,
      });

      if (eResp.getResponseCode() === 200) {
        var eData = JSON.parse(eResp.getContentText());
        equityTickers.forEach(function(ticker) {
          var snap = eData[ticker];
          if (snap) {
            results[ticker] = snapshotToQuote_(snap, ticker);
            cache.put('q_' + ticker, JSON.stringify(results[ticker]), QUOTE_CACHE_TTL_);
          }
        });
      } else {
        Logger.log('Quotes.gs: Alpaca equity HTTP ' + eResp.getResponseCode() + ' — ' + eResp.getContentText());
      }
    } catch(e) {
      Logger.log('Quotes.gs: Alpaca equity error — ' + e.message);
    }
  }

  // --- Crypto ---
  if (cryptoTickers.length) {
    // Convertir formato Yahoo (BTC-USD) → formato Alpaca (BTC/USD)
    var alpacaCryptoSymbols = cryptoTickers.map(yahooToAlpacaCrypto_);

    try {
      var cUrl = 'https://data.alpaca.markets/v1beta3/crypto/us/snapshots?symbols=' +
                 alpacaCryptoSymbols.map(function(s) { return encodeURIComponent(s); }).join(',');
      var cResp = UrlFetchApp.fetch(cUrl, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true,
      });

      if (cResp.getResponseCode() === 200) {
        var cData = JSON.parse(cResp.getContentText());
        // cData tiene forma { snapshots: { "BTC/USD": { ... } } } o { "BTC/USD": { ... } }
        var snapshots = cData.snapshots || cData;

        cryptoTickers.forEach(function(yahooTicker, idx) {
          var alpacaKey = alpacaCryptoSymbols[idx]; // e.g. "BTC/USD"
          var snap = snapshots[alpacaKey];
          if (snap) {
            results[yahooTicker] = snapshotToQuote_(snap, yahooTicker);
            cache.put('q_' + yahooTicker, JSON.stringify(results[yahooTicker]), QUOTE_CACHE_TTL_);
          }
        });
      } else {
        Logger.log('Quotes.gs: Alpaca crypto HTTP ' + cResp.getResponseCode() + ' — ' + cResp.getContentText());
      }
    } catch(e) {
      Logger.log('Quotes.gs: Alpaca crypto error — ' + e.message);
    }
  }

  return results;
}

/**
 * Convierte un objeto snapshot de Alpaca al formato de quote que espera el frontend.
 * Equivalente al objeto que devuelve yahooChart_ para mantener contrato idéntico.
 *
 * Campos usados del snapshot de Alpaca:
 *   dailyBar.c        → precio de cierre del día
 *   latestTrade.p     → último precio negociado (fallback si no hay dailyBar)
 *   prevDailyBar.c    → cierre del día anterior
 *
 * @param {object} snap    Snapshot de Alpaca para un símbolo
 * @param {string} ticker  Ticker en formato frontend (clave estable)
 * @returns {object}       Quote con campos {ticker,name,price,prevClose,currency,exchange,changeAbs,changePct,updatedAt}
 */
function snapshotToQuote_(snap, ticker) {
  var price     = (snap.dailyBar && snap.dailyBar.c) || (snap.latestTrade && snap.latestTrade.p) || 0;
  var prevClose = (snap.prevDailyBar && snap.prevDailyBar.c) || 0;
  var changeAbs = price - prevClose;
  var changePct = prevClose ? (changeAbs / prevClose) * 100 : 0;

  return {
    ticker:    ticker,
    name:      ticker,          // Alpaca snapshots no incluyen nombre; el frontend muestra ticker
    price:     price,
    prevClose: prevClose,
    currency:  'USD',
    exchange:  '',
    changeAbs: changeAbs,
    changePct: changePct,
    updatedAt: nowIso_(),
  };
}

/**
 * Determina si un ticker en formato Yahoo es un par crypto (BTC-USD, ETH-EUR…).
 * Heurística: termina en -XXX donde XXX es una divisa conocida.
 */
function isCryptoTicker_(ticker) {
  var t = ticker.toUpperCase();
  var dashIdx = t.lastIndexOf('-');
  if (dashIdx < 0) return false;
  var quoteCurrency = t.slice(dashIdx + 1);
  return CRYPTO_QUOTE_CURRENCIES_.indexOf(quoteCurrency) >= 0;
}

/**
 * Convierte ticker crypto de formato Yahoo a formato Alpaca.
 * BTC-USD → BTC/USD   |   ETH-EUR → ETH/EUR
 */
function yahooToAlpacaCrypto_(yahooTicker) {
  return yahooTicker.replace('-', '/');
}

function getQuotes_(params) {
  var raw     = params.tickers || params.ticker || '';
  var tickers = raw.split(',').map(function(t) { return t.trim().toUpperCase(); }).filter(Boolean);
  if (!tickers.length) return { quotes: {}, fxRates: {} };

  var cache   = CacheService.getScriptCache();
  var results = {};
  var toFetch = [];

  // Combinar los tickers del usuario con los de FX (sin duplicar)
  var allTickers = tickers.slice();
  FX_TICKERS_.forEach(function(fx) {
    if (allTickers.indexOf(fx) < 0) allTickers.push(fx);
  });

  // Leer caché primero
  allTickers.forEach(function(ticker) {
    var hit = cache.get('q_' + ticker);
    if (hit) {
      try { results[ticker] = JSON.parse(hit); } catch(e) { toFetch.push(ticker); }
    } else {
      toFetch.push(ticker);
    }
  });

  // Separar en US equity/crypto (Alpaca) vs FX/BVC/Europa (Yahoo)
  var alpacaBatch = [];
  var yahooBatch  = [];
  toFetch.forEach(function(t) {
    (isUsEquity_(t) ? alpacaBatch : yahooBatch).push(t);
  });

  // Alpaca: llamada batch única (hasta 2 requests HTTP internamente: equity + crypto)
  if (alpacaBatch.length) {
    var alpacaResults = fetchAlpacaSnapshots_(alpacaBatch, cache);
    Object.keys(alpacaResults).forEach(function(t) {
      results[t] = alpacaResults[t];
    });
    // Fallback: si algún ticker de Alpaca no tiene resultado o tuvo error, intentar Yahoo
    alpacaBatch.forEach(function(t) {
      if (!results[t] || results[t].error) {
        results[t] = fetchYahoo_(t, cache);
      }
    });
  }

  // Yahoo: individual (comportamiento original para FX y bolsas internacionales)
  yahooBatch.forEach(function(t) {
    results[t] = fetchYahoo_(t, cache);
  });

  // Separar quotes de acciones/ETF/crypto del mapa de tasas FX.
  // fxRates: { USD: 4200, EUR: 4600 } → factor de conversión a COP.
  var quotes  = {};
  var fxRates = {};

  tickers.forEach(function(t) {
    if (results[t]) quotes[t] = results[t];
  });

  FX_TICKERS_.forEach(function(fxTicker) {
    var q = results[fxTicker];
    if (!q || q.error) return;
    // USDCOP=X → currency key = "USD", price = tasa USD→COP
    var currencyKey = fxTicker.replace(FX_BASE_CURRENCY_ + '=X', '');
    if (currencyKey && q.price) fxRates[currencyKey] = q.price;
  });

  return { quotes: quotes, fxRates: fxRates };
}

function fetchYahoo_(ticker, cache) {
  // Yahoo representa las CLASES de acción con guion (BRK.B → BRK-B), pero conserva
  // los SUFIJOS de bolsa con punto (PFBANCOL.CL, SAP.DE, BP.L). Como un punto puede
  // ser cualquiera de los dos y distinguirlos por heurística es ambiguo, se intenta
  // el símbolo tal cual y, si no hay datos y contiene punto, se reintenta con
  // punto→guion. La clave del resultado sigue siendo el ticker original.
  var res = yahooChart_(ticker);
  if (!res.quote && ticker.indexOf('.') >= 0) {
    res = yahooChart_(ticker.replace(/\./g, '-'));
  }
  if (!res.quote) return { error: res.error || 'Sin datos de Yahoo Finance', ticker: ticker };

  var quote = res.quote;
  quote.ticker = ticker; // clave estable para el frontend (lo busca por el símbolo guardado)
  cache.put('q_' + ticker, JSON.stringify(quote), QUOTE_CACHE_TTL_);
  return quote;
}

// Consulta el chart de Yahoo para un símbolo concreto.
// Devuelve { quote } si hay datos, o { error } si no. No cachea (lo hace fetchYahoo_).
function yahooChart_(symbol) {
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
              encodeURIComponent(symbol) +
              '?interval=1d&range=2d&includePrePost=false';

    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceOS/1.0)',
        'Accept': 'application/json',
      },
      muteHttpExceptions: true,
      followRedirects: true,
    });

    if (resp.getResponseCode() !== 200) {
      return { error: 'HTTP ' + resp.getResponseCode() };
    }

    var data   = JSON.parse(resp.getContentText());
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return { error: 'Sin datos de Yahoo Finance' };

    var meta   = result.meta;
    var closes = result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close;
    var prevClose = (closes && closes.length >= 2) ? closes[closes.length - 2] : (meta.previousClose || meta.chartPreviousClose);

    var quote = {
      ticker:    symbol,
      name:      meta.shortName || meta.longName || symbol,
      price:     meta.regularMarketPrice || meta.previousClose || 0,
      prevClose: prevClose || meta.regularMarketPrice || 0,
      currency:  (meta.currency || 'USD').toUpperCase(),
      exchange:  meta.exchangeName || '',
      updatedAt: nowIso_(),
    };

    quote.changeAbs = quote.price - quote.prevClose;
    quote.changePct = quote.prevClose ? (quote.changeAbs / quote.prevClose) * 100 : 0;

    return { quote: quote };

  } catch(e) {
    return { error: e.message };
  }
}
