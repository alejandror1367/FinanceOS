/**
 * Quotes.gs — Cotizaciones en tiempo real via Yahoo Finance.
 * Cachea 15 min en CacheService para no exceder límites.
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

  // Fetching (Apps Script no tiene Promise.all, pero el loop es rápido)
  toFetch.forEach(function(ticker) {
    results[ticker] = fetchYahoo_(ticker, cache);
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
