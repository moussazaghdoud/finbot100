import { CONFIG } from '../config.js';

let clientPromise = null;
async function getClient() {
  if (!CONFIG.hasKey) return null;
  if (!clientPromise)
    clientPromise = (async () => {
      try {
        const mod = await import('@anthropic-ai/sdk');
        return new mod.default();
      } catch {
        return null;
      }
    })();
  return clientPromise;
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

export async function askClaudeJson(system, user) {
  const client = await getClient();
  if (!client) return null;
  try {
    const msg = await client.messages.create({
      model: CONFIG.model,
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return extractJson(msg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''));
  } catch {
    return null;
  }
}

export function llmMode() {
  return CONFIG.hasKey ? `Claude (${CONFIG.model})` : 'MOCK (data-driven)';
}
