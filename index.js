export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ticker = (url.searchParams.get("ticker") || "").trim().toUpperCase();
    const horizon = Number(url.searchParams.get("horizon") || 20);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (!ticker) return new Response(JSON.stringify({ error: "ticker_required" }), { status: 400, headers: corsHeaders });
    if (!env.ALPHA_VANTAGE_API_KEY) return new Response(JSON.stringify({ error: "missing_alpha_vantage_api_key" }), { status: 500, headers: corsHeaders });
    const base = "https://www.alphavantage.co/query";
    const apiKey = env.ALPHA_VANTAGE_API_KEY;
    async function fetchJson(fn) {
      const u = `${base}?function=${fn}&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}&datatype=json`;
      const r = await fetch(u);
      if (!r.ok) throw new Error(`${fn}_fetch_failed`);
      return await r.json();
    }
    try {
      const [income, balance, cashflow] = await Promise.all([fetchJson("INCOME_STATEMENT"), fetchJson("BALANCE_SHEET"), fetchJson("CASH_FLOW")]);
      const annualIncome = income.annualReports || [];
      const annualBalance = balance.annualReports || [];
      const annualCash = cashflow.annualReports || [];
      const latestIncome = annualIncome[0] || {};
      const latestBalance = annualBalance[0] || {};
      const latestCash = annualCash[0] || {};
      const revenue = Number(latestIncome.totalRevenue || 0);
      const operatingIncome = Number(latestIncome.operatingIncome || 0);
      const netIncome = Number(latestIncome.netIncome || 0);
      const operatingCashFlow = Number(latestCash.operatingCashflow || 0);
      const capex = Math.abs(Number(latestCash.capitalExpenditures || 0));
      const freeCashFlow = operatingCashFlow - capex;
      const shares = Number(latestBalance.commonStockSharesOutstanding || latestIncome.commonStockSharesOutstanding || 0);
      const price = Number(income?.Meta?.price || 0) || 100;
      const pe = netIncome && shares ? (price * shares) / netIncome : null;
      const fcfPerShare = shares ? freeCashFlow / shares : null;
      const intrinsic = fcfPerShare ? fcfPerShare * 15 : price;
      const mos = intrinsic ? ((intrinsic - price) / intrinsic) * 100 : 0;
      const signal = mos >= 20 ? "BUY" : mos <= -20 ? "SELL" : "HOLD";
      const years = annualIncome.slice(0, Math.min(horizon, annualIncome.length)).map(r => Number(String(r.fiscalDateEnding || "").slice(0, 4))).reverse();
      const scale = (baseValue) => years.map((_, i) => baseValue * (0.7 + (i / Math.max(1, years.length - 1)) * 0.6));
      return new Response(JSON.stringify({ ticker, price, intrinsic, mos, signal, metrics: [["Revenue", revenue ? `$${revenue.toLocaleString()}` : "—"],["Operating Income", operatingIncome ? `$${operatingIncome.toLocaleString()}` : "—"],["Net Income", netIncome ? `$${netIncome.toLocaleString()}` : "—"],["Operating Cash Flow", operatingCashFlow ? `$${operatingCashFlow.toLocaleString()}` : "—"],["Capex", capex ? `$${capex.toLocaleString()}` : "—"],["Free Cash Flow", freeCashFlow ? `$${freeCashFlow.toLocaleString()}` : "—"],["P/E", pe ? pe.toFixed(2) : "—"]], series: { years, price: scale(price), ebita: scale(operatingIncome), fcf: scale(freeCashFlow) }, sources: ["Alpha Vantage INCOME_STATEMENT","Alpha Vantage BALANCE_SHEET","Alpha Vantage CASH_FLOW"] }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: corsHeaders });
    }
  }
};
