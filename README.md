# Stock Analyzer

## Backend API
Set `ALPHA_VANTAGE_API_KEY` in your deployment environment.

### Endpoint
`/api/quote?ticker=AAPL&horizon=20`

### Data sources
- INCOME_STATEMENT
- BALANCE_SHEET
- CASH_FLOW

## Notes
This route is a server-side wrapper for Alpha Vantage fundamentals. It is not intended for GitHub Pages alone; deploy it on a platform that supports serverless functions.
