import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installPoliteFetch } from './net.js';

installPoliteFetch();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load app/.env if present (Node 20.12+), so keys only need setting once.
try {
  process.loadEnvFile?.(join(root, '.env'));
} catch {
  /* no .env file */
}

// On Railway (and most PaaS) the platform injects PORT and the app must bind
// 0.0.0.0. Locally we bind 0.0.0.0 too; set HOST=127.0.0.1 if a local port
// clashes with another dev server reachable via "localhost".
const DATA_DIR = process.env.DATA_DIR || join(root, 'data');

export const CONFIG = {
  port: Number(process.env.PORT || 7100),
  host: process.env.HOST || '0.0.0.0',

  // The investable universe (educational simulation).
  universe: [
    // Crypto — Binance/CoinGecko, keyless, works from anywhere (incl. cloud).
    { id: 'BTC', name: 'Bitcoin', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'ETH', name: 'Ethereum', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'SOL', name: 'Solana', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'BNB', name: 'BNB', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'XRP', name: 'XRP', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'DOGE', name: 'Dogecoin', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    { id: 'ADA', name: 'Cardano', kind: 'crypto', sector: 'Crypto', country: 'Global' },
    // Stocks / ETFs — need STOCK_API_KEY on cloud hosts (see DEPLOY.md).
    { id: 'NVDA', name: 'NVIDIA', kind: 'stock', sector: 'Semiconductors', country: 'US' },
    { id: 'AAPL', name: 'Apple', kind: 'stock', sector: 'Technology', country: 'US' },
    { id: 'MSFT', name: 'Microsoft', kind: 'stock', sector: 'Technology', country: 'US' },
    { id: 'TSLA', name: 'Tesla', kind: 'stock', sector: 'Autos', country: 'US' },
    { id: 'SPY', name: 'S&P 500 ETF', kind: 'stock', sector: 'Broad Market', country: 'US' },
    { id: 'GLD', name: 'Gold ETF', kind: 'stock', sector: 'Commodities', country: 'Global' },
  ],

  // Stock data provider key (Twelve Data free tier works from cloud hosts).
  // Without it, the app falls back to Yahoo (fine locally, blocked on cloud).
  stockApiKey: process.env.STOCK_API_KEY || process.env.TWELVEDATA_API_KEY || '',

  // Company fundamentals (P/E, growth, earnings date, analyst targets) — free
  // key from financialmodelingprep.com. Without it, fundamentals are skipped.
  fmpApiKey: process.env.FMP_API_KEY || '',

  // Reference-only instruments: fetched for context (peers, macro), never traded.
  references: [
    { id: 'QQQ', name: 'Nasdaq 100 ETF', kind: 'stock', sector: 'Broad Market' },
    { id: 'SOXX', name: 'Semiconductor ETF', kind: 'stock', sector: 'Semiconductors' },
    { id: 'COIN', name: 'Coinbase', kind: 'stock', sector: 'Crypto equities' },
    { id: 'USO', name: 'Oil ETF', kind: 'stock', sector: 'Commodities' },
  ],

  // Each asset's "family": what the bot compares it with.
  peers: {
    BTC: ['ETH', 'COIN', 'QQQ'], ETH: ['BTC', 'SOL', 'COIN'], SOL: ['ETH', 'BTC'], BNB: ['BTC', 'ETH'],
    XRP: ['BTC', 'ADA'], DOGE: ['BTC', 'ETH'], ADA: ['XRP', 'ETH'],
    NVDA: ['SOXX', 'MSFT', 'QQQ'], AAPL: ['MSFT', 'QQQ'], MSFT: ['AAPL', 'NVDA', 'QQQ'], TSLA: ['QQQ', 'NVDA'],
    SPY: ['QQQ', 'GLD'], GLD: ['SPY', 'USO'],
  },

  horizonDays: 3,
  bullBand: 0.5,
  bearBand: 0.5,
  neutralBand: 1.5,

  startingCapital: 100, // the €100 "conviction capital"

  dataDir: DATA_DIR,
  predictionsFile: join(DATA_DIR, 'predictions.json'),
  userFile: join(DATA_DIR, 'user.json'),
  fundFile: join(DATA_DIR, 'fund.json'),
  alertsFile: join(DATA_DIR, 'alerts.json'),
  activityFile: join(DATA_DIR, 'activity.json'),
  usageFile: join(DATA_DIR, 'claude-usage.json'),

  // BUY / SELL / HOLD thresholds on the Council signal (-1..+1).
  signals: {
    buyThreshold: 0.14,
    sellThreshold: 0.14,
    everyMin: Number(process.env.SIGNALS_EVERY_MIN || 60), // background re-check for flips
    ntfyTopic: process.env.NTFY_TOPIC || '', // optional phone push via ntfy.sh
  },

  // The paper-trading challenge — FinBot invests a virtual €1000 by itself for
  // a fixed period. It acts on the same BUY/SELL signals as the Signals page
  // (CONFIG.signals thresholds) and decides once per signal re-check.
  fund: {
    base: Number(process.env.FUND_BASE || 1000), // starting virtual capital (€)
    durationDays: Number(process.env.FUND_DAYS || 7), // challenge length
    maxWeight: 0.22, // never put more than 22% of the fund in one asset
    tradeFraction: 0.12, // deploy ~12% of fund value per buy
    stopLossPct: 7, // sell a holding that is down this much from its cost
    minTrade: 20, // ignore trades smaller than €20 (dust)
    feePct: 0.1, // 0.1% simulated trading fee (realism)
    autoOn: process.env.AUTOTRADE !== 'off', // auto-trade on by default
  },

  // Haiku 5.5: each analyst call is a short structured answer from a few numbers
  // and headlines — it handles that at ~1/20th of Sonnet's price.
  model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
  // Hard ceiling on Claude calls per UTC day (7 per asset debate). Past it the
  // analysts fall back to their data-driven rules until midnight UTC.
  maxClaudeCallsPerDay: Number(process.env.MAX_CLAUDE_CALLS_PER_DAY || 2500),

  // Reuse a debate this long (minutes). Matches the bot cycle so page views
  // between cycles don't trigger (and pay for) extra debates.
  debateCacheMin: Number(process.env.SIGNALS_EVERY_MIN || 60),
};

export function assetById(id) {
  return CONFIG.universe.find((a) => a.id === id) || CONFIG.references.find((a) => a.id === id);
}
