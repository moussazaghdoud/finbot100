// Central config for the tracer-bullet. Deliberately tiny.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  asset: 'BTC',
  assetName: 'Bitcoin',

  // Prediction horizon in days (short, so calls resolve fast).
  horizonDays: 3,

  // Directional outcome thresholds (percent move over the horizon).
  // bullish "correct" if return > +bullBand; bearish if return < -bearBand;
  // neutral "correct" if |return| <= neutralBand.
  bullBand: 0.5,
  bearBand: 0.5,
  neutralBand: 1.5,

  // Where the JSON ledger lives.
  dataDir: join(__dirname, '..', 'data'),
  predictionsFile: join(__dirname, '..', 'data', 'predictions.json'),

  // LLM. If ANTHROPIC_API_KEY is set AND @anthropic-ai/sdk is installed,
  // the agents reason with Claude. Otherwise they fall back to a transparent
  // data-driven mock so the whole loop still runs with zero setup.
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
};
