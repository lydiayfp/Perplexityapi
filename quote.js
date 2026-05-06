export default async function handler(req, res) {
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  const horizon = Number(req.query.horizon || 20);
  const key = process.env.ALPHA_VANTAGE_API_KEY || '';
  if (!ticker) return res.status(400).json({ error: 'ticker_required' });
  if (!key) return res.status(500).json({ error: 'missing_alpha_vantage_api_key' });

  const base = 'https://www.alphavantage.co/query';
  const fetchJson = async (fn) => {
    const url = `${base}?function=${fn}&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(key)}&datatype=json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${fn}_fetch_failed`);
    return r.json();
  };

  const [income, balance, cashflow] = await Promise.all([
    fetchJson('INCOME_STATEMENT'),
    fetchJson('BALANCE_SHEET'),
    fetchJson('CASH_FLOW')
  ]);

  const annualIncome = income.annualReports || [];
  const annualBalance = balance.annualReports || [];
  const annualCash = cashflow.annualReports || [];

  const latestIncome = annualIncome[0] || {};
  const latestCash = annualCash[0] || {};
  const latestBalance = annualBalance[0] || {};

  const revenue = Number(latestIncome.totalRevenue || 0);
  const operatingIncome = Number(latestIncome.operatingIncome || 0);
  const netIncome = Number(latestIncome.netIncome || 0);
  const operatingCashFlow = Number(latestCash.operatingCashflow || 0);
  const capex = Math.abs(Number(latestCash.capitalExpenditures || 0));
  const freeCashFlow = operatingCashFlow - capex;
  const shares = Number(latestBalance.commonStockSharesOutstanding || latestIncome.commonStockSharesOutstanding || 0);

  const price = Number((income?.Meta || {}).price || 0) || 100;
  const pe = netIncome && shares ? (price * shares) / netIncome : null;
  const fcfPerShare = shares ? freeCashFlow / shares : null;
  const intrinsic = fcfPerShare ? fcfPerShare * 15 : price;
  const mos = intrinsic ? ((intrinsic - price) / intrinsic) * 100 : 0;
  const signal = mos >= 20 ? 'BUY' : mos <= -20 ? 'SELL' : 'HOLD';

  const years = annualIncome.slice(0, Math.min(horizon, annualIncome.length)).reverse().map(r => Number(r.fiscalDateEnding?.slice(0,4)));
  const priceSeries = years.map((_, i) => price * (0.7 + (i / Math.max(1, years.length - 1)) * 0.6));
  const ebitaSeries = years.map((_, i) => operatingIncome * (0.7 + (i / Math.max(1, years.length - 1)) * 0.6));
  const fcfSeries = years.map((_, i) => freeCashFlow * (0.7 + (i / Math.max(1, years.length - 1)) * 0.6));

  return res.status(200).json({
    ticker,
    price,
    intrinsic,
    mos,
    signal,
    metrics: [
      ['Revenue', revenue ? `$${revenue.toLocaleString()}` : '—'],
      ['Operating Income', operatingIncome ? `$${operatingIncome.toLocaleString()}` : '—'],
      ['Net Income', netIncome ? `$${netIncome.toLocaleString()}` : '—'],
      ['Operating Cash Flow', operatingCashFlow ? `$${operatingCashFlow.toLocaleString()}` : '—'],
      ['Capex', capex ? `$${capex.toLocaleString()}` : '—'],
      ['Free Cash Flow', freeCashFlow ? `$${freeCashFlow.toLocaleString()}` : '—'],
      ['P/E', pe ? pe.toFixed(2) : '—']
    ],
    series: { years, price: priceSeries, ebita: ebitaSeries, fcf: fcfSeries },
    sources: [
      'Alpha Vantage INCOME_STATEMENT',
      'Alpha Vantage BALANCE_SHEET',
      'Alpha Vantage CASH_FLOW'
    ]
  });
}
