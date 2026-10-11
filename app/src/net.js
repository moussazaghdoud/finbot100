// Polite, resilient fetch for market-data sources (installed globally by
// config.js). Free endpoints throttle bursts and sometimes hang, so outgoing
// data requests get: max 6 in flight, a 15 s timeout, and one retry (GET only)
// on network errors, 429 and 5xx. Anthropic API calls pass straight through —
// the SDK has its own timeouts/retries and a POST must never be duplicated.
const MAX_IN_FLIGHT = 6;
const TIMEOUT_MS = 15000;

const rawFetch = globalThis.fetch;
let inFlight = 0;
const waiting = [];

async function slot() {
  if (inFlight < MAX_IN_FLIGHT) { inFlight++; return; }
  await new Promise((res) => waiting.push(res));
  inFlight++;
}
function release() {
  inFlight--;
  waiting.shift()?.();
}

async function once(url, opts) {
  await slot();
  try {
    return await rawFetch(url, { ...opts, signal: opts?.signal || AbortSignal.timeout(TIMEOUT_MS) });
  } finally {
    release();
  }
}

export async function politeFetch(url, opts = {}) {
  const u = String(url instanceof Request ? url.url : url);
  if (u.includes('anthropic.com')) return rawFetch(url, opts);
  const retryable = !opts.method || opts.method === 'GET';
  try {
    const r = await once(url, opts);
    if (retryable && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`HTTP ${r.status}`), { response: r });
    return r;
  } catch (e) {
    if (!retryable) throw e;
    await new Promise((res) => setTimeout(res, 1200));
    return once(url, opts);
  }
}

export function installPoliteFetch() {
  if (globalThis.fetch !== politeFetch) globalThis.fetch = politeFetch;
}
