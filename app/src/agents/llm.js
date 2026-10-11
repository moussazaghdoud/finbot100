import { CONFIG } from '../config.js';
import { readJson, writeJson } from '../ledger/store.js';

let clientPromise = null;
async function getClient() {
  if (!CONFIG.hasKey) return null;
  if (!clientPromise)
    clientPromise = (async () => {
      try {
        const mod = await import('@anthropic-ai/sdk');
        return new mod.default();
      } catch (e) {
        noteFailure(`SDK failed to load: ${e.message}`);
        return null;
      }
    })();
  return clientPromise;
}

// Per-day usage so failures and spend are visible (/api/status), plus a hard
// daily call cap: past it the analysts fall back to their data-driven rules.
const PRICE = { // $ per 1M tokens (input, output)
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-opus-5-5': [4, 20],
};
const usage = { day: '', calls: 0, ok: 0, failed: 0, capped: 0, inTok: 0, outTok: 0, lastError: null, lastErrorAt: null, lastOkAt: null, keyRejected: false };

// Spend ledger persisted per UTC day (survives restarts, so totals and the
// daily cap stay right): { days: { 'YYYY-MM-DD': { calls, inTok, outTok, usd } } }
const spend = readJson(CONFIG.usageFile, { days: {} });
function record(inTok, outTok) {
  const [pi, po] = PRICE[CONFIG.model] || [0, 0];
  const d = (spend.days[usage.day] ||= { calls: 0, inTok: 0, outTok: 0, usd: 0 });
  d.calls++;
  d.inTok += inTok;
  d.outTok += outTok;
  d.usd = +(d.usd + (inTok * pi + outTok * po) / 1e6).toFixed(6);
  usage.inTok += inTok;
  usage.outTok += outTok;
  writeJson(CONFIG.usageFile, spend);
}

function today() {
  const d = new Date().toISOString().slice(0, 10);
  if (usage.day !== d) {
    const saved = spend.days[d] || {};
    Object.assign(usage, { day: d, calls: saved.calls || 0, ok: 0, failed: 0, capped: 0, inTok: saved.inTok || 0, outTok: saved.outTok || 0 });
  }
}
function noteFailure(msg) {
  usage.failed++;
  if (msg !== usage.lastError) console.warn(`  [claude] call failed: ${msg}`); // log each new error once
  usage.lastError = msg;
  usage.lastErrorAt = Date.now();
}

export function llmUsage() {
  today();
  const month = usage.day.slice(0, 7);
  const sum = (pred) => +Object.entries(spend.days).filter(([k]) => pred(k)).reduce((s, [, v]) => s + v.usd, 0).toFixed(4);
  return {
    ...usage,
    model: CONFIG.model,
    enabled: CONFIG.hasKey,
    cap: CONFIG.maxClaudeCallsPerDay,
    estCostUsd: sum((k) => k === usage.day),
    monthUsd: sum((k) => k.startsWith(month)),
    totalUsd: sum(() => true),
    since: Object.keys(spend.days).sort()[0] || null,
  };
}

function extractJson(t) {
  const a = t.indexOf('{'),
    b = t.lastIndexOf('}');
  if (a < 0 || b < 0) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
}

// One short JSON answer. Low effort keeps the model's reasoning (billed as
// output) small; max_tokens leaves room for that reasoning plus the JSON.
// Structured outputs make the API guarantee schema-valid JSON. If the API ever
// rejects a schema, that request is retried once without it and schemas are
// switched off for the rest of the process (prompt-only JSON, parsed leniently).
let schemasOff = false;

export async function askClaudeJson(system, user, schema = null) {
  const client = await getClient();
  if (!client) return null;
  today();
  // A rejected key won't start working on its own (changing it restarts the
  // server), so stop calling until then.
  if (usage.keyRejected) return null;
  if (usage.calls >= CONFIG.maxClaudeCallsPerDay) {
    usage.capped++;
    return null;
  }
  usage.calls++;
  const create = (withSchema) =>
    client.messages.create({
      model: CONFIG.model,
      max_tokens: 4000,
      output_config: withSchema ? { effort: 'low', format: { type: 'json_schema', schema } } : { effort: 'low' },
      system,
      messages: [{ role: 'user', content: user }],
    });
  try {
    let msg;
    try {
      msg = await create(Boolean(schema) && !schemasOff);
    } catch (e) {
      if (!(schema && !schemasOff && e.status === 400)) throw e;
      schemasOff = true;
      console.warn(`  [claude] structured output rejected (${e.error?.error?.message || e.message}) — continuing without schemas`);
      msg = await create(false);
    }
    record(msg.usage?.input_tokens || 0, msg.usage?.output_tokens || 0);
    if (msg.stop_reason !== 'end_turn') {
      noteFailure(`stop_reason ${msg.stop_reason}`);
      return null;
    }
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = extractJson(text);
    }
    if (!json) {
      noteFailure(`reply had no JSON (starts: ${text.slice(0, 60).replace(/\s+/g, ' ')})`);
      return null;
    }
    usage.ok++;
    usage.lastOkAt = Date.now();
    return json;
  } catch (e) {
    if (e.status === 401 || e.status === 403) usage.keyRejected = true;
    noteFailure(`${e.status ? e.status + ' ' : ''}${e.error?.error?.message || e.message}${usage.keyRejected ? ' — key rejected, Claude calls stopped until restart' : ''}`);
    return null;
  }
}

export function llmMode() {
  return CONFIG.hasKey ? `Claude (${CONFIG.model})` : 'MOCK (data-driven)';
}
