// The Accountability Ledger — a JSON file. (In production this is Postgres;
// for the tracer-bullet a file proves the loop with zero setup.)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';

function ensureDir() {
  if (!existsSync(CONFIG.dataDir)) mkdirSync(CONFIG.dataDir, { recursive: true });
}

export function loadPredictions() {
  if (!existsSync(CONFIG.predictionsFile)) return [];
  try {
    return JSON.parse(readFileSync(CONFIG.predictionsFile, 'utf8'));
  } catch {
    return [];
  }
}

export function savePredictions(preds) {
  ensureDir();
  writeFileSync(CONFIG.predictionsFile, JSON.stringify(preds, null, 2));
}

// Turn an agent thesis into a stored, resolvable prediction.
export function makePrediction(thesis, priceAtCall, createdAtMs = Date.now()) {
  return {
    id: randomUUID(),
    agent: thesis.agent,
    asset: thesis.asset,
    stance: thesis.stance,
    confidence: thesis.confidence,
    thesis: thesis.thesis,
    catalyst: thesis.catalyst,
    keyRisk: thesis.keyRisk,
    horizonDays: thesis.horizonDays,
    evidenceRefs: thesis.evidenceRefs,
    priceAtCall,
    createdAt: createdAtMs,
    resolveAt: createdAtMs + thesis.horizonDays * 24 * 60 * 60 * 1000,
    resolved: false,
    // filled by grading:
    priceAtResolve: null,
    actualReturn: null,
    correct: null,
    brier: null,
  };
}

export function appendPredictions(newOnes) {
  const all = loadPredictions();
  all.push(...newOnes);
  savePredictions(all);
  return all;
}
