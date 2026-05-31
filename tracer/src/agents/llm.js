// Thin Claude wrapper. Returns parsed JSON from the model, or null if the
// model is unavailable (no key / SDK not installed / call failed) so callers
// can fall back to the data-driven mock.
import { CONFIG } from '../config.js';

let clientPromise = null;

async function getClient() {
  if (!CONFIG.hasKey) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const mod = await import('@anthropic-ai/sdk');
        const Anthropic = mod.default;
        return new Anthropic(); // reads ANTHROPIC_API_KEY from env
      } catch {
        return null; // SDK not installed
      }
    })();
  }
  return clientPromise;
}

function extractJson(text) {
  // Be forgiving: pull the first {...} block.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function askClaudeJson(system, user) {
  const client = await getClient();
  if (!client) return null;
  try {
    const msg = await client.messages.create({
      model: CONFIG.model,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    return extractJson(text);
  } catch (e) {
    console.warn(`  (Claude call failed, using mock: ${e.message})`);
    return null;
  }
}

export function llmMode() {
  return CONFIG.hasKey ? `Claude (${CONFIG.model})` : 'MOCK (data-driven, no API key)';
}
