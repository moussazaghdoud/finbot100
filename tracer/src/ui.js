// Tiny console formatting helpers (no dependencies).
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

export function rule(label = '') {
  const line = '─'.repeat(Math.max(0, 64 - label.length));
  return `${C.dim}── ${C.reset}${C.bold}${label}${C.reset} ${C.dim}${line}${C.reset}`;
}
export const c = C;
export function stanceColor(s) {
  return s === 'bullish' ? C.green : s === 'bearish' ? C.red : C.yellow;
}
export function dollars(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
