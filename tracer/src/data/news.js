// Lightweight crypto news headlines (references only — never republish full text).
// Uses public RSS feeds, no API key. Returns [] gracefully on failure so the
// debate can still run without news.

function extractItems(xml, max) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, max)) {
    const title = (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1];
    const link = (b.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1];
    if (title) items.push({ title: title.trim(), link: (link || '').trim() });
  }
  return items;
}

const FEEDS = [
  'https://cointelegraph.com/rss/tag/bitcoin',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
];

export async function fetchNews(max = 5) {
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed, { headers: { 'user-agent': 'finbot100-tracer/0.1' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = extractItems(xml, max);
      if (items.length) return items;
    } catch {
      // try next feed
    }
  }
  return [];
}
