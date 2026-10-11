// Headlines (references only). Public RSS, no key. Returns [] on failure.
// Also does naive keyword sentiment so SCOUT has something real to chew on.
const FEEDS = {
  crypto: ['https://cointelegraph.com/rss/tag/bitcoin', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  stock: ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'https://www.cnbc.com/id/10001147/device/rss/rss.html'],
};

const cache = new Map();
const TTL = 15 * 60 * 1000;
// Feeds can go stale (WSJ's stopped in Jan 2025) — never pass old news off as current.
const MAX_AGE_MS = 72 * 3600 * 1000;

const decode = (t) => t.replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function parse(xml, max) {
  const items = [];
  for (const b of xml.split(/<item[\s>]/i).slice(1)) {
    const title = (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1];
    const link = (b.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1];
    const date = Date.parse((b.match(/<pubDate>([^<]+)<\/pubDate>/i) || [])[1] || '');
    if (!title || !(date > Date.now() - MAX_AGE_MS)) continue; // undated or older than 72h
    items.push({ title: decode(title.trim()), link: (link || '').trim(), date });
    if (items.length >= max) break;
  }
  return items;
}

const POS = /(surge|rally|gain|jump|beat|record|soar|bullish|upgrade|rebound|boost|optimism)/i;
const NEG = /(crash|plunge|fall|drop|miss|fear|bearish|downgrade|selloff|warn|slump|sink|risk|cut)/i;

export function sentiment(items) {
  let score = 0;
  for (const it of items) {
    if (POS.test(it.title)) score += 1;
    if (NEG.test(it.title)) score -= 1;
  }
  return items.length ? +(score / items.length).toFixed(2) : 0; // -1..+1
}

export async function fetchNews(kind = 'crypto', max = 6) {
  const c = cache.get(kind);
  if (c && Date.now() - c.ts < TTL) return c.items;
  for (const feed of FEEDS[kind] || FEEDS.crypto) {
    try {
      const r = await fetch(feed, { headers: { 'user-agent': 'finbot100/0.2' } });
      if (!r.ok) continue;
      const items = parse(await r.text(), max);
      if (items.length) {
        cache.set(kind, { items, ts: Date.now() });
        return items;
      }
    } catch {
      /* next */
    }
  }
  return [];
}

// Headlines about ONE asset (last 72h): Yahoo Finance's per-ticker feed for
// stocks/ETFs, Google News search for everything. Merged, newest first, deduped.
const assetCache = new Map();
const QUERY = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana crypto', BNB: 'BNB Binance coin', XRP: 'XRP Ripple',
  DOGE: 'Dogecoin', ADA: 'Cardano ADA', SPY: 'S&P 500', GLD: 'gold price',
};

export async function assetNews(meta, max = 8) {
  const c = assetCache.get(meta.id);
  if (c && Date.now() - c.ts < TTL * 2) return c.items;
  const q = QUERY[meta.id] || `${meta.name} ${meta.id} stock`;
  const feeds = [`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:3d&hl=en-US&gl=US&ceid=US:en`];
  if (meta.kind === 'stock') feeds.unshift(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${meta.id}&region=US&lang=en-US`);
  const all = [];
  await Promise.all(feeds.map(async (f) => {
    try {
      const r = await fetch(f, { headers: { 'user-agent': 'Mozilla/5.0 (finbot100)' } });
      if (r.ok) all.push(...parse(await r.text(), 15));
    } catch { /* source down: use the other */ }
  }));
  // Keep stock headlines that actually name the company (Yahoo's ticker feed
  // mixes in general market stories); fall back to the rest if none do.
  const words = meta.kind === 'stock' && !['SPY', 'GLD'].includes(meta.id) ? [meta.id.toLowerCase(), meta.name.toLowerCase().split(' ')[0]] : null;
  const named = words ? all.filter((it) => words.some((w) => it.title.toLowerCase().includes(w))) : all;
  const pool = named.length >= 3 ? named : all;
  const seen = new Set();
  const items = pool
    .sort((a, b) => (named.includes(b) - named.includes(a)) || b.date - a.date)
    .filter((it) => { const k = it.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
  if (items.length) assetCache.set(meta.id, { items, ts: Date.now() });
  return items;
}
