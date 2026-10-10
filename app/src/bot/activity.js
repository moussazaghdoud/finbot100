// The bot's activity log: what it analysed, what it concluded, what it did,
// and how it is doing. Append-only JSON file, newest last, capped.
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';
import { readJson, writeJson } from '../ledger/store.js';

const MAX = 3000;
let events = null;

function all() {
  if (!events) events = readJson(CONFIG.activityFile, []);
  return events;
}

// type: cycle | analysis | decision | trade | idle | offline | error | daily | result | challenge
export function logEvent(type, text, extra = {}) {
  const e = { id: randomUUID(), t: Date.now(), type, text, ...extra };
  const list = all();
  list.push(e);
  if (list.length > MAX) list.splice(0, list.length - MAX);
  writeJson(CONFIG.activityFile, list);
  console.log(`  [${type}] ${text}`);
  return e;
}

export function getEvents({ since = 0, limit = 400 } = {}) {
  return all()
    .filter((e) => e.t > since)
    .slice(-limit);
}
