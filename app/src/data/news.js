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
