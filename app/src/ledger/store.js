import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';

function ensureDir() {
  if (!existsSync(CONFIG.dataDir)) mkdirSync(CONFIG.dataDir, { recursive: true });
}
function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  ensureDir();
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export const loadPredictions = () => readJson(CONFIG.predictionsFile, []);
export const savePredictions = (p) => writeJson(CONFIG.predictionsFile, p);

export function makePrediction(thesis, asset, priceAtCall, source, createdAtMs = Date.now()) {
  return {
    id: randomUUID(),
    source, // 'agent' | 'user'
    agent: thesis.agent, // agent id, or 'YOU' for user
    asset,
    stance: thesis.stance,
    confidence: thesis.confidence,
    thesis: thesis.thesis || '',
    horizonDays: thesis.horizonDays || CONFIG.horizonDays,
    priceAtCall,
    createdAt: createdAtMs,
    resolveAt: createdAtMs + (thesis.horizonDays || CONFIG.horizonDays) * 86400000,
    resolved: false,
    priceAtResolve: null,
    actualReturn: null,
    correct: null,
    brier: null,
  };
}

export function appendPredictions(items) {
  const all = loadPredictions();
  all.push(...items);
  savePredictions(all);
  return all;
}

// Simple single-user state for the demo (no auth).
const defaultUser = () => ({
  capital: CONFIG.startingCapital,
  conviction: {}, // assetId -> euros allocated based on your own calls
  createdAt: Date.now(),
});
export const loadUser = () => readJson(CONFIG.userFile, defaultUser());
export const saveUser = (u) => writeJson(CONFIG.userFile, u);
