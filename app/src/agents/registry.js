// The Analyst Council roster — identity + visual id (shared with the frontend).
export const AGENTS = {
  SAGE: { id: 'SAGE', name: 'Sage', role: 'Macro Economist', color: '#7dd3fc', glyph: '◈', blurb: 'Reads the macro regime: rates, risk-on/off, the long arc.' },
  ORACLE: { id: 'ORACLE', name: 'Oracle', role: 'Momentum Analyst', color: '#a78bfa', glyph: '⟁', blurb: 'Fast and probabilistic. Trades the trend and the tape.' },
  ATLAS: { id: 'ATLAS', name: 'Atlas', role: 'Risk Manager', color: '#fb7185', glyph: '⛉', blurb: 'The skeptic. Hunts volatility, overextension, drawdown.' },
  SCOUT: { id: 'SCOUT', name: 'Scout', role: 'News Intelligence', color: '#34d399', glyph: '✸', blurb: 'Scans the headlines and weighs the narrative.' },
  SENTINEL: { id: 'SENTINEL', name: 'Sentinel', role: 'Geopolitics', color: '#fbbf24', glyph: '◭', blurb: 'Watches conflict, policy and the price of fear.' },
  ALCHEMIST: { id: 'ALCHEMIST', name: 'Alchemist', role: 'Portfolio Optimizer', color: '#f0abfc', glyph: '✶', blurb: 'Turns the debate into balance: diversification and fit.' },
};

export const COUNCIL_ORDER = ['SAGE', 'ORACLE', 'SCOUT', 'SENTINEL', 'ATLAS', 'ALCHEMIST'];
