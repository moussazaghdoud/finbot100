import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

  horizonDays: 3,
  bullBand: 0.5,
  bearBand: 0.5,
  neutralBand: 1.5,

  startingCapital: 100, // the €100 "conviction capital"

  dataDir: DATA_DIR,
  predictionsFile: join(DATA_DIR, 'predictions.json'),
  userFile: join(DATA_DIR, 'user.json'),

  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  hasKey: Boolean(process.env.ANTHROPIC_API_KEY),

  // cache debates in-memory for this many minutes (shared across users)
  debateCacheMin: 30,
};

export function assetById(id) {
  return CONFIG.universe.find((a) => a.id === id);
}
