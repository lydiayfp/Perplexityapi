# Cloudflare Worker for Stock Analyzer

## Setup
1. `npm install -g wrangler`
2. `wrangler login`
3. `cd cf-worker`
4. `wrangler secret put ALPHA_VANTAGE_API_KEY`
5. `wrangler deploy`

## Endpoint
`https://YOUR-WORKER.workers.dev/?ticker=AAPL&horizon=20`
