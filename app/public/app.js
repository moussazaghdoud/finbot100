// FinBot 100 frontend — vanilla JS. Views: Signals, Council, Fund, Ledger (Universe map hidden for now).
const $ = (s) => document.querySelector(s);
const api = (p, opts) => fetch(p, opts).then((r) => r.json());
const fmtPrice = (n) => (n >= 1000 ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$' + n.toFixed(2));
const sign = (n) => (n > 0 ? '+' : '') + n + '%';
const cls = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

const state = { config: null, universe: null, agents: {}, selected: null, revealed: {} };

// ── boot ──────────────────────────────────────────────
async function boot() {
  state.config = await api('/api/config');
  state.agents = state.config.agents;
  $('#llm-badge').innerHTML = 'engine: <b>' + state.config.llmMode + '</b>';
  setupNav();
  refreshCapital();
  startAlertWatch();
  refreshPill();
  setInterval(refreshPill, 15000);
  $('#bot-pill').addEventListener('click', () => { location.hash = 'fund'; });

  // deep-link: #signals, #council, #council/NVDA, #ledger, #fund
  const route = () => {
    const h = location.hash.replace('#', '');
    const [view, asset] = h.split('/');
    if (view === 'council') { state.selected = asset || state.selected || 'BTC'; switchView('council'); loadCouncil(state.selected); }
    else if (view === 'ledger' || view === 'fund') switchView(view);
    else switchView('signals');
  };
  window.addEventListener('hashchange', route);
  route();
}

function setupNav() {
  document.querySelectorAll('nav button').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view))
  );
}
function switchView(v) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === v));
  stopFundPoll();
  if (v === 'signals') loadSignals();
  if (v === 'council' && !state.currentBrief) loadCouncil(state.selected || 'BTC');
  if (v === 'ledger') loadLedger();
  if (v === 'fund') startFundPoll();
}

// ── SIGNALS ───────────────────────────────────────────
async function loadSignals(force) {
  const body = $('#signals-body');
  if (force || !state.signals) {
    body.innerHTML = `<div class="loading">Running the Council on every asset… (first run can take a minute)</div>`;
    state.signals = await api('/api/signals');
    state.seenAlerts = new Set(state.signals.alerts.map((a) => a.id));
  }
  renderSignals(state.signals);
}

const pct = (v) => (v == null ? '—' : v + '%');

function trackPanel(t) {
  const card = (a, label, hint) => {
    const x = t.byAction[a];
    return `<div class="track-card">
      <div class="sig-action ${a.toLowerCase()}">${a}</div>
      <div class="track-hr numeric">${pct(x.hitRate)}</div>
      <div class="track-sub">${label} · ${x.hits}/${x.n} calls</div>
      <div class="track-sub">avg ${t.horizonDays}d move after: <b class="numeric ${cls(x.avgReturn)}">${x.avgReturn == null ? '—' : sign(x.avgReturn)}</b></div>
      <div class="track-hint">${hint}</div>
    </div>`;
  };
  const recent = t.recent.length
    ? t.recent.map((r) => `<div class="track-row"><span class="${r.correct ? 'up' : 'down'}">${r.correct ? '✓' : '✗'}</span> ${new Date(r.createdAt).toLocaleDateString()}${r.seeded ? ' <span class="track-tag">backtest</span>' : ''} · <b>${r.action}</b> ${r.asset} @ ${fmtPrice(r.priceAtCall)} → <span class="numeric ${cls(r.ret)}">${sign(r.ret)}</span></div>`).join('')
    : `<div class="empty">No graded BUY/SELL calls yet.</div>`;
  return `<div class="panel fade-in track">
    <h3 class="section-title">Is it right? — the bot's own track record</h3>
    <div class="track-sub" style="margin:-6px 0 12px">${t.live} live calls + ${t.backtest} backtest calls (rule-based analysts replayed on real past prices). Live calls are what count.</div>
    <div class="track-grid">
      ${card('BUY', 'went up', 'right if the price rose')}
      ${card('SELL', 'went down', 'right if the price fell')}
      ${card('HOLD', 'stayed flat', `right if it moved less than ±${state.config.neutralBand ?? 1.5}%`)}
      <div class="track-recent"><div class="track-sub" style="margin-bottom:6px">Latest graded calls · ${t.pending} still waiting</div>${recent}</div>
    </div>
  </div>`;
}

function alertsPanel(alerts) {
  if (!alerts.length) return '';
  return `<div class="panel fade-in alerts">
    <h3 class="section-title">Recent changes</h3>
    ${alerts.slice(0, 8).map((a) => `<div class="track-row">${timeAgo(a.t)} · <b>${a.asset}</b> ${a.from} → <b class="${a.to === 'BUY' ? 'up' : a.to === 'SELL' ? 'down' : ''}">${a.to}</b> @ ${fmtPrice(a.price)}</div>`).join('')}
  </div>`;
}

function renderSignals(d) {
  const ok = d.signals.filter((s) => !s.error);
  const count = (a) => ok.filter((s) => s.action === a).length;
  const rows = d.signals
    .map((s) => {
      if (s.error) return `<div class="sig-row"><div class="sig-asset"><b>${s.asset}</b><span>${s.name}</span></div><div class="sig-reason" style="color:var(--dim)">no data: ${s.error}</div></div>`;
      const rec = d.track.byAsset[s.asset];
      return `
      <div class="sig-row" data-asset="${s.asset}">
        <div class="sig-action ${s.action.toLowerCase()}">${s.action}</div>
        <div class="sig-asset"><b>${s.asset}</b><span>${s.name}</span></div>
        <div class="sig-num numeric">${fmtPrice(s.price)}<span class="${cls(s.ret7d)}">7d ${sign(s.ret7d)}</span></div>
        <div class="sig-num numeric">${s.strength}<span>strength</span></div>
        <div class="sig-num numeric">${s.votes.bull}↑ ${s.votes.bear}↓<span>analysts</span></div>
        <div class="sig-num numeric">${rec ? `${rec.hits}/${rec.n}` : '—'}<span>right here</span></div>
        <div class="sig-reason">${s.reason}<div class="sig-risk">Risk: ${s.risk}</div></div>
      </div>`;
    })
    .join('');
  const canNotify = 'Notification' in window;
  const bell = !canNotify ? '' : Notification.permission === 'granted'
    ? `<span class="badge">🔔 alerts on</span>`
    : `<button class="btn ghost" id="sig-bell">🔔 Enable alerts</button>`;
  $('#signals-body').innerHTML = `
    <div class="sig-top fade-in">
      <div>
        <h2 class="asset-title">Today's signals</h2>
        <div class="asset-meta">${count('BUY')} buy · ${count('SELL')} sell · ${count('HOLD')} hold · ${d.horizonDays}-day horizon · analysed ${ok.length ? timeAgo(Math.min(...ok.map((s) => s.ts))) : '—'} · re-analysed every ${state.config.signalsEveryMin} min</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">${bell}<button class="btn ghost" id="sig-refresh">↻ Refresh</button></div>
    </div>
    ${trackPanel(d.track)}
    ${alertsPanel(d.alerts)}
    <div class="sig-list fade-in">${rows}</div>
    ${signalsNote()}`;
  $('#sig-refresh').addEventListener('click', () => loadSignals(true));
  $('#sig-bell')?.addEventListener('click', async () => { await Notification.requestPermission(); renderSignals(d); });
  document.querySelectorAll('.sig-row[data-asset]').forEach((r) =>
    r.addEventListener('click', () => { location.hash = 'council/' + r.dataset.asset; })
  );
}

function signalsNote() {
  return `<div class="disclaimer">Signals come from the AI analysts' debate on price, volatility, macro and news data. Click a row to see the full argument. Each call is graded after ${state.config.horizonDays} days — trust the track record above, not the confidence. The server re-checks every ${state.config.signalsEveryMin} min and alerts you when a signal changes.</div>`;
}

// Poll for signal flips (cheap: no debates) and raise a browser notification.
function startAlertWatch() {
  setInterval(async () => {
    const { alerts } = await api('/api/alerts');
    state.seenAlerts ||= new Set(alerts.map((a) => a.id));
    const fresh = alerts.filter((a) => !state.seenAlerts.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => state.seenAlerts.add(a.id));
    if ('Notification' in window && Notification.permission === 'granted')
      fresh.forEach((a) => new Notification(`FinBot: ${a.asset} ${a.from} → ${a.to}`, { body: `${a.name} at ${fmtPrice(a.price)} · strength ${a.strength}` }));
    state.signals = null; // stale — reload on next visit
    if ($('#signals').classList.contains('active')) loadSignals();
  }, 60000);
}

async function refreshCapital() {
  const me = await api('/api/me');
  $('#capital').textContent = '€' + me.capital;
}

// ── UNIVERSE MAP ──────────────────────────────────────
let cam = { x: 0, y: 0, scale: 1 };
let nodes = [],
  edges = [],
  layout = {};
const SECTORS = {};

async function loadUniverse() {
  state.universe = await api('/api/universe');
  nodes = state.universe.nodes;
  edges = state.universe.edges;
  const m = state.universe.macro;
  if (m) {
    const col = m.regime === 'risk-on' ? '#34d399' : m.regime === 'risk-off' ? '#fb7185' : '#fbbf24';
    $('#regime-chip').innerHTML = `macro regime: <b style="color:${col}">${m.regime}</b> · mkt 30d ${sign(m.market30d)}`;
  }
  computeLayout();
}

function computeLayout() {
  const sectors = [...new Set(nodes.map((n) => n.sector))];
  const R = 230;
  sectors.forEach((s, i) => {
    const a = (i / sectors.length) * Math.PI * 2 - Math.PI / 2;
    SECTORS[s] = { x: Math.cos(a) * R, y: Math.sin(a) * R };
  });
  nodes.forEach((n) => {
    const c = SECTORS[n.sector];
    // deterministic offset from id hash
    let h = 0;
    for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const ang = (h / 997) * Math.PI * 2;
    const rad = 38 + (h % 40);
    layout[n.id] = { x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad, phase: (h % 100) / 100 };
  });
}

let canvas, ctx, W, H, dpr, stars = [];
let hover = null;

function initMap() {
  canvas = $('#map');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 140; i++)
    stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3, tw: Math.random() * 6 });

  let dragging = false,
    last = null;
  canvas.addEventListener('mousedown', (e) => { dragging = true; last = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; });
  window.addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'grab'; });
  canvas.addEventListener('mousemove', (e) => {
    if (dragging) { cam.x -= (e.clientX - last.x) / cam.scale; cam.y -= (e.clientY - last.y) / cam.scale; last = { x: e.clientX, y: e.clientY }; }
    else handleHover(e);
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.scale = Math.max(0.4, Math.min(2.6, cam.scale * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  canvas.addEventListener('click', (e) => {
    const n = nodeAt(e);
    if (n) { state.selected = n.id; switchView('council'); loadCouncil(n.id); }
  });
  requestAnimationFrame(draw);
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const w2s = (wx, wy) => ({ x: (wx - cam.x) * cam.scale + W / 2, y: (wy - cam.y) * cam.scale + H / 2 });

function nodeScreenPos(n, t) {
  const l = layout[n.id];
  const fx = Math.sin(t / 2200 + l.phase * 6) * 5;
  const fy = Math.cos(t / 2600 + l.phase * 6) * 5;
  return w2s(l.x + fx, l.y + fy);
}

function nodeAt(e) {
  const t = performance.now();
  for (const n of nodes) {
    const p = nodeScreenPos(n, t);
    const r = nodeRadius(n);
    if ((e.clientX - p.x) ** 2 + (e.clientY - p.y - 61) ** 2 < (r + 7) ** 2) return n;
  }
  return null;
}
function nodeRadius(n) { return (7 + Math.abs(n.ret7d || 0) * 0.7 + n.pulse * 6) * cam.scale; }

function handleHover(e) {
  const n = nodeAt(e);
  hover = n;
  const tt = $('#tooltip');
  if (n) {
    canvas.style.cursor = 'pointer';
    tt.style.display = 'block';
    tt.style.left = e.clientX + 16 + 'px';
    tt.style.top = e.clientY + 8 + 'px';
    tt.innerHTML = `<div class="t-name">${n.name}</div><div class="t-sector">${n.sector}</div>
      <div class="t-row"><span>Price</span><b class="numeric">${fmtPrice(n.price)}</b></div>
      <div class="t-row"><span>7d</span><b class="numeric ${cls(n.ret7d)}">${sign(n.ret7d)}</b></div>
      <div class="t-row"><span>Vol</span><b class="numeric">${n.volatility}%/d</b></div>`;
  } else { canvas.style.cursor = 'grab'; tt.style.display = 'none'; }
}

function draw() {
  const t = performance.now();
  ctx.clearRect(0, 0, W, H);
  // starfield
  for (const s of stars) {
    const a = 0.25 + 0.25 * Math.sin(t / 600 + s.tw);
    ctx.fillStyle = `rgba(180,200,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
  }
  // edges
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source), b = nodes.find((n) => n.id === e.target);
    if (!a || !b) continue;
    const pa = nodeScreenPos(a, t), pb = nodeScreenPos(b, t);
    const pos = e.corr > 0;
    ctx.strokeStyle = pos ? `rgba(124,92,255,${0.08 + Math.abs(e.corr) * 0.28})` : `rgba(251,113,133,${0.06 + Math.abs(e.corr) * 0.2})`;
    ctx.lineWidth = Math.abs(e.corr) * 1.8;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  // nodes
  for (const n of nodes) {
    const p = nodeScreenPos(n, t);
    const r = nodeRadius(n);
    const up = (n.ret7d || 0) >= 0;
    const col = up ? '52,211,153' : '251,113,133';
    // pulse rings
    if (n.pulse > 0.25) {
      const ph = ((t / 1400 + layout[n.id].phase) % 1);
      ctx.strokeStyle = `rgba(${col},${(1 - ph) * 0.4 * n.pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + ph * 26, 0, 7); ctx.stroke();
    }
    // glow
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(0.5, `rgba(${col},0.25)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.4, 0, 7); ctx.fill();
    // core
    ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.3, 0, 7); ctx.fill();
    // label
    if (cam.scale > 0.7 || hover === n) {
      ctx.fillStyle = hover === n ? '#fff' : 'rgba(231,236,255,0.7)';
      ctx.font = `${hover === n ? 700 : 500} ${11}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(n.id, p.x, p.y + r + 14);
    }
  }
  requestAnimationFrame(draw);
}

// ── COUNCIL ───────────────────────────────────────────
async function loadCouncil(asset) {
  const body = $('#council-body');
  body.innerHTML = `<div class="loading">Convening the Analyst Council on ${asset}…</div>`;
  const b = await api('/api/debate?asset=' + asset);
  state.currentBrief = b;
  renderCouncil(b);
}

function sparkline(series) {
  const w = 220, h = 54, pad = 4;
  const ys = series.map((p) => p.close);
  const mn = Math.min(...ys), mx = Math.max(...ys), rng = mx - mn || 1;
  const pts = series.map((p, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.close - mn) / rng) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = ys[ys.length - 1] >= ys[0];
  const c = up ? '#34d399' : '#fb7185';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline fill="none" stroke="${c}" stroke-width="1.8" points="${pts.join(' ')}"/></svg>`;
}

function renderCouncil(b) {
  const ev = b.evidence;
  const revealed = state.revealed[b.asset];
  const head = `
    <div class="council-head fade-in">
      <div style="flex:1; min-width:240px">
        <h2 class="asset-title">${b.name} <span style="color:var(--dim);font-size:16px">${b.asset}</span></h2>
        <div class="asset-meta">${b.sector} · data: ${b.source}</div>
        <div class="stats">
          <div class="stat">7d <b class="${cls(ev.ret7d)}">${sign(ev.ret7d)}</b></div>
          <div class="stat">30d <b class="${cls(ev.ret30d)}">${sign(ev.ret30d)}</b></div>
          <div class="stat">vol <b>${ev.volatility}%/d</b></div>
          <div class="stat">from high <b>${ev.pctFromHigh}%</b></div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="price">${fmtPrice(b.price)}</div>
        ${sparkline(b.series)}
      </div>
    </div>`;

  const yvc = revealed ? '' : `
    <div class="yvc fade-in" id="yvc">
      <h3>🎯 Your call first</h3>
      <p>Before you see what the AI analysts think — what's your read on ${b.name} over the next ${b.horizonDays} days? You'll be scored on calibration, just like the Council.</p>
      <div class="choices">
        <button class="choice" data-stance="bullish">▲ Bullish</button>
        <button class="choice" data-stance="bearish">▼ Bearish</button>
        <button class="choice" data-stance="neutral">● Neutral</button>
      </div>
      <div class="slider-wrap">Confidence <input type="range" id="conf" min="50" max="90" value="65"/> <b class="numeric" id="confv">65%</b></div>
      <button class="btn" id="submit-call" disabled>Lock in & reveal the Council</button>
      <button class="btn ghost" id="skip-call">Just show me the Council</button>
    </div>`;

  const cards = b.theses
    .map((t) => {
      const a = state.agents[t.agent] || { name: t.agent, role: '', color: '#888', glyph: '•' };
      return `<div class="agent-card" style="border-left-color:${a.color}">
        <div class="ah">
          <div class="glyph" style="color:${a.color}">${a.glyph}</div>
          <div><div class="an">${a.name}</div><div class="ar">${a.role}</div></div>
          <div class="stance ${t.stance}">${t.stance}</div>
        </div>
        <div class="thesis">${t.thesis}</div>
        <div class="meta-line"><b>Catalyst:</b> ${t.catalyst}</div>
        <div class="meta-line"><b>Key risk:</b> ${t.keyRisk}</div>
        <div class="conf-bar"><i style="width:${t.confidence}%;background:${a.color}"></i></div>
        <div class="meta-line" style="margin-top:6px">confidence <b>${t.confidence}%</b> · horizon ${t.horizonDays}d</div>
      </div>`;
    })
    .join('');

  const mod = b.moderator;
  const agColor = mod.agreement === 'disagree' ? 'var(--mag)' : mod.agreement === 'agree' ? 'var(--cyan)' : 'var(--yellow)';
  const moderator = `
    <div class="moderator">
      <div class="ag" style="color:${agColor}">⟁ Moderator · council ${mod.agreement}</div>
      <div style="margin:8px 0;font-size:13.5px">${mod.summary}</div>
      <div class="bullbear">
        <div><div class="lbl up">Bull case</div>${mod.bullCase}</div>
        <div><div class="lbl down">Bear case</div>${mod.bearCase}</div>
      </div>
      <div class="meta-line" style="margin-top:10px"><b>Open question:</b> ${mod.residualUncertainty}</div>
    </div>`;

  const news = b.news?.length
    ? `<div class="panel" style="margin-top:18px"><div class="section-title">Scout's feed — headlines (references)</div>
       <div class="news-list">${b.news.map((n) => `<a href="${n.link}" target="_blank" rel="noopener">↗ ${n.title}</a>`).join('')}</div></div>`
    : '';

  const councilBlock = revealed
    ? `<div class="section-title">The Council · ${b.theses.length} analysts debating</div><div class="council-grid fade-in">${cards}</div>${moderator}${news}`
    : `<div class="section-title">The Council is waiting for your call…</div><div style="filter:blur(7px);opacity:0.5;pointer-events:none"><div class="council-grid">${cards}</div></div>`;

  $('#council-body').innerHTML = head + yvc + councilBlock + disclaimer();

  if (!revealed) wireYvc(b);
  $('#confv') && ($('#confv').textContent = '65%');
}

function wireYvc(b) {
  let stance = null;
  document.querySelectorAll('#yvc .choice').forEach((c) =>
    c.addEventListener('click', () => {
      document.querySelectorAll('#yvc .choice').forEach((x) => x.classList.remove('sel'));
      c.classList.add('sel');
      stance = c.dataset.stance;
      $('#submit-call').disabled = false;
    })
  );
  const conf = $('#conf');
  conf.addEventListener('input', () => ($('#confv').textContent = conf.value + '%'));
  $('#submit-call').addEventListener('click', async () => {
    $('#submit-call').disabled = true;
    await api('/api/predict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset: b.asset, stance, confidence: +conf.value }),
    });
    state.revealed[b.asset] = true;
    refreshCapital();
    renderCouncil(b);
  });
  $('#skip-call').addEventListener('click', () => { state.revealed[b.asset] = true; renderCouncil(b); });
}

function disclaimer() {
  return `<div class="disclaimer">FinBot 100 is an educational simulation. The analysts present falsifiable hypotheses, not personal investment advice — nothing here is a recommendation to buy or sell, and no real money is involved. Each call is logged and graded in the Ledger.</div>`;
}

// ── LEDGER ────────────────────────────────────────────
async function loadLedger() {
  const body = $('#ledger-body');
  body.innerHTML = `<div class="loading">Grading due calls and tallying the Accountability Ledger…</div>`;
  const [l, me] = await Promise.all([api('/api/ledger'), api('/api/me')]);
  renderLedger(l, me);
}

function calTag(gap) {
  const a = Math.abs(gap);
  if (a <= 6) return `<span class="tag good">well-calibrated</span>`;
  return gap > 0 ? `<span class="tag over">overconfident</span>` : `<span class="tag under">underconfident</span>`;
}

function scoreCard(s, isYou) {
  const a = state.agents[s.agent] || { name: isYou ? 'You' : s.agent, role: isYou ? 'Human analyst' : '', color: isYou ? '#22d3ee' : '#888', glyph: isYou ? '★' : '•' };
  return `<div class="score-card ${isYou ? 'you' : ''}">
    <div class="top"><div class="glyph" style="color:${a.color};font-size:18px;width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,0.05)">${a.glyph}</div>
      <div><div style="font-weight:700">${a.name}</div><div class="ar" style="font-size:10.5px;color:var(--dim);text-transform:uppercase">${a.role}</div></div></div>
    <div class="hr" style="color:${a.color}">${s.hitRate}%</div>
    <div style="font-size:11px;color:var(--dim);margin-bottom:10px">hit rate · ${s.n} graded calls</div>
    <div class="kv"><span>Avg confidence</span><b>${s.avgConfidence}%</b></div>
    <div class="kv"><span>Calibration gap</span><b>${s.calibrationGap > 0 ? '+' : ''}${s.calibrationGap}</b></div>
    <div class="kv"><span>Brier score</span><b>${s.avgBrier}</b></div>
    <div style="margin-top:10px">${calTag(s.calibrationGap)}</div>
  </div>`;
}

function renderLedger(l, me) {
  const you = l.board.find((b) => b.agent === 'YOU');
  const agentsB = l.board.filter((b) => b.agent !== 'YOU');
  const councilAvg = agentsB.length ? (agentsB.reduce((s, b) => s + b.hitRate, 0) / agentsB.length).toFixed(1) : '—';

  const vs = you
    ? `<div class="panel" style="margin-bottom:18px;background:linear-gradient(180deg,rgba(34,211,238,0.07),transparent);border-color:rgba(34,211,238,0.28)">
        <div class="section-title">You vs the Council</div>
        <div style="display:flex;gap:40px;align-items:center;flex-wrap:wrap">
          <div><div style="font-size:34px;font-weight:800;color:var(--cyan)" class="numeric">${you.hitRate}%</div><div style="color:var(--dim);font-size:12px">your hit rate (${you.n} calls)</div></div>
          <div style="font-size:22px;color:var(--dim)">vs</div>
          <div><div style="font-size:34px;font-weight:800" class="numeric">${councilAvg}%</div><div style="color:var(--dim);font-size:12px">council average</div></div>
          <div style="flex:1"></div>
          <div style="max-width:280px;color:var(--dim);font-size:12.5px">${you.calibrationGap > 8 ? "You're overconfident — the gap between how sure you feel and how often you're right is the first thing to fix." : you.hitRate >= councilAvg ? "You're holding your own against the AI council. Calibration beats bravado." : 'Keep going — calibration improves with reps.'}</div>
        </div>
      </div>`
    : `<div class="panel" style="margin-bottom:18px"><div class="section-title">You vs the Council</div><div class="empty">Make a few calls in the Council to start your own track record.</div></div>`;

  const board = `<div class="section-title">Accountability Ledger · ${l.resolved} calls graded · ${l.pending} pending
      <button class="btn ghost" id="grade-now" style="float:right;margin-top:-6px;font-size:11px;padding:6px 12px">Grade due now</button></div>
    <div class="board-grid">${(you ? scoreCard(you, true) : '') + agentsB.map((b) => scoreCard(b, false)).join('')}</div>`;

  const feed = l.recent?.length
    ? `<div class="panel" style="margin-top:18px"><div class="section-title">Recently resolved</div><div class="feed">${l.recent
        .map((p) => {
          const a = state.agents[p.agent] || { name: p.agent === 'YOU' ? 'You' : p.agent, color: '#888' };
          return `<div class="feed-row"><div class="mark ${p.correct ? 'hit' : 'miss'}">${p.correct ? '✓' : '✗'}</div>
            <b style="color:${a.color || '#888'}">${a.name}</b>
            <span class="stance ${p.stance}" style="padding:2px 7px;font-size:10px">${p.stance}</span>
            <span style="color:var(--dim)">${p.asset}</span>
            <span style="flex:1"></span>
            <span class="numeric ${cls(p.actualReturn)}">${sign(p.actualReturn)}</span>
            <span style="color:var(--dim);font-size:11px">conf ${p.confidence}%</span></div>`;
        })
        .join('')}</div></div>`
    : '';

  $('#ledger-body').innerHTML = `<div class="fade-in">${vs}${board}${feed}${ledgerNote()}</div>`;
  $('#grade-now')?.addEventListener('click', async () => {
    await api('/api/grade', { method: 'POST' });
    loadLedger();
  });
}

// ── BOT (status · challenge · live journal) ───────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const eur = (n) => '€' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctS = (n) => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const bot = { timer: null, events: [], lastT: 0, view: null, viewAt: 0, status: null, onlyTrades: false, open: new Set() };

function stopFundPoll() { if (bot.timer) { clearInterval(bot.timer); bot.timer = null; } }
function startFundPoll() {
  loadBot(true);
  bot.timer = setInterval(() => loadBot(false), 5000);
}

async function loadBot(full) {
  const wasThinking = bot.status?.phase === 'thinking';
  const a = await api('/api/activity?since=' + bot.lastT + '&limit=' + (bot.lastT ? 400 : 1500));
  bot.status = a.status;
  if (a.events.length) {
    bot.events.push(...a.events);
    bot.lastT = a.events[a.events.length - 1].t;
    bot.events = bot.events.slice(-3000);
  }
  const cycleEnded = wasThinking && a.status.phase !== 'thinking';
  if (full || cycleEnded || !bot.view || Date.now() - bot.viewAt > 30000) {
    bot.view = await api('/api/fund');
    bot.viewAt = Date.now();
  }
  if (full || a.events.length || cycleEnded) renderBot();
  else renderBotStatus();
}

function fmtIn(ms) {
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

function statusInfo(s) {
  if (!s) return { cls: 'stopped', text: 'Server unreachable — the bot is not running' };
  if (s.health === 'thinking') {
    const p = s.progress || {};
    return { cls: 'thinking', text: p.step === 'deciding' ? 'Thinking — deciding what to trade…' : `Thinking — analysing ${p.asset || '…'} (${p.i || 0}/${p.n || '?'})` };
  }
  if (s.health === 'late') return { cls: 'late', text: `Late — last cycle ${timeAgo(s.lastRunAt)}, next one is overdue` };
  return { cls: 'live', text: `Live — last cycle ${s.lastRunAt ? timeAgo(s.lastRunAt) : 'not yet'} · next in ${fmtIn(s.nextRunAt - Date.now())}` };
}

function renderBotStatus() {
  const s = bot.status, i = statusInfo(s);
  const el = $('#bot-status');
  if (!el) return;
  const p = s?.progress;
  el.className = 'bot-status panel ' + i.cls;
  el.innerHTML = `
    <span class="light ${i.cls}"></span>
    <div style="flex:1">
      <div class="bs-text">${i.text}</div>
      <div class="bs-sub">${s ? `${claudeState(s.claude).text} · a cycle every ${s.everyMin} min · server up ${fmtIn(s.uptimeSec * 1000)}${s.lastError ? ` · <span class="down">last error: ${esc(s.lastError)}</span>` : ''}` : 'Start it with npm start (or check Railway).'}</div>
      ${p && p.n ? `<div class="bs-bar"><i style="width:${Math.round(((p.step === 'deciding' ? p.n : Math.max(0, p.i - 1)) / p.n) * 100)}%"></i></div>` : ''}
    </div>
    <button class="btn ghost" id="run-cycle" ${s?.phase === 'thinking' ? 'disabled' : ''}>▸ Run a cycle now</button>`;
  $('#run-cycle').onclick = async () => { await api('/api/bot/run', { method: 'POST' }); loadBot(false); };
}

function challengeHero(f) {
  if (f.status === 'idle') {
    return `<div class="panel fade-in hero-idle">
      <div class="fh-label">The ${f.durationDays}-day challenge</div>
      <h2 class="asset-title" style="margin:6px 0 10px">Give the bot ${eur(f.base)} of virtual money and let it trade alone for ${f.durationDays} days.</h2>
      <ul class="rules">
        <li>Every ${state.config.signalsEveryMin} min it analyses all ${state.config.universe.length} assets and acts on the <b>BUY / SELL</b> signals.</li>
        <li>Buys ~12% of the fund per signal, max 22% in one asset. Sells on a SELL signal or a <b>-${f.stopLossPct}% stop-loss</b>.</li>
        <li>Real live prices. Crypto trades 24/7; US stocks only while the market is open. € converted at the live EUR/USD rate, 0.1% fee per trade.</li>
        <li>Every decision — including "do nothing" — is written in the journal with its reasons. At the end you see the result against simple alternatives.</li>
      </ul>
      <button class="btn" id="start-ch">▶ Start the ${eur(f.base)} challenge</button>
      <div class="fh-note" style="margin-top:8px">The server must keep running for all ${f.durationDays} days (Railway, or leave this PC on). Gaps are shown in the journal.</div>
    </div>`;
  }
  const ended = f.status === 'ended';
  const up = f.pnl >= 0, col = up ? 'var(--green)' : 'var(--red)';
  const done = Math.min(1, (Date.now() - f.startedAt) / (f.endsAt - f.startedAt));
  const day = Math.min(f.durationDays, Math.floor((Date.now() - f.startedAt) / 86400000) + 1);
  return `<div class="fund-hero panel fade-in">
    <div class="fh-left">
      <div class="fh-label">${ended ? 'Final result' : `Day ${day} of ${f.durationDays}`} · started ${new Date(f.startedAt).toLocaleString()}</div>
      <div class="fh-value numeric" style="color:${col}">${eur(f.total)}</div>
      <div class="fh-pnl numeric" style="color:${col}">${up ? '▲ +' : '▼ '}${eur(f.pnl)} (${pctS(f.pnlPct)}) <span style="color:var(--dim)">vs ${eur(f.base)} start</span></div>
      <div class="fh-sub">cash ${eur(f.cash)} · invested ${eur(f.invested)} · realised ${eur(f.realized)} · fees ${eur(f.fees)} · ${f.tradeCount} trades${f.fx ? ` · EUR/USD ${f.fx}` : ''}</div>
      ${ended ? '' : `<div class="ch-bar"><i style="width:${(done * 100).toFixed(1)}%"></i></div><div class="fh-note">ends ${new Date(f.endsAt).toLocaleString()} · in ${fmtIn(f.endsAt - Date.now())}</div>`}
    </div>
    <div class="fh-right">
      ${ended ? `<button class="btn" id="start-ch">▶ Start a new challenge</button>` : `
      <div class="auto-toggle ${f.autoOn ? 'on' : ''}" id="auto-toggle" title="pause / resume trading">
        <span class="dot2"></span> Auto-trading ${f.autoOn ? 'ON' : 'PAUSED'}
      </div>`}
      <button class="btn ghost" id="reset-fund">Reset</button>
      <div class="fh-note">${f.marketOpen ? 'US market open' : 'US market closed — stocks wait, crypto trades'}</div>
    </div>
  </div>`;
}

function benchPanel(f) {
  if (f.status === 'idle' || !f.benchmarks?.length) return '';
  const cards = [{ id: 'bot', label: 'The bot', value: f.total, pnlPct: f.pnlPct }, ...f.benchmarks].map((b) => {
    const beat = b.id === 'bot' ? '' : f.total >= b.value ? `<span class="up">bot ahead by ${eur(f.total - b.value)}</span>` : `<span class="down">bot behind by ${eur(b.value - f.total)}</span>`;
    return `<div class="bench ${b.id === 'bot' ? 'me' : ''}"><div class="track-sub">${esc(b.label)}</div>
      <div class="bench-v numeric">${eur(b.value)}</div><div class="numeric ${cls(b.pnlPct)}" style="font-size:12px">${pctS(b.pnlPct)}</div><div style="font-size:11px;margin-top:4px">${beat}</div></div>`;
  }).join('');
  return `<div class="panel fade-in" style="margin-top:16px"><div class="section-title">Is the bot worth it? — same ${eur(f.base)}, same dates</div><div class="bench-grid">${cards}</div></div>`;
}

function holdingsPanel(f) {
  if (f.status === 'idle') return '';
  const rows = f.holdings.length
    ? `<div class="hold-grid head"><span>Asset</span><span>Value</span><span>Weight</span><span>P&L</span></div>` +
      f.holdings.map((h) => `<div class="hold-grid"><span><b>${h.asset}</b> <span style="color:var(--dimmer);font-size:11px">${h.boughtAt ? 'since ' + timeAgo(h.boughtAt) : ''}</span></span>
        <span class="numeric">${eur(h.value)}</span><span class="numeric" style="color:var(--dim)">${((h.value / f.total) * 100).toFixed(0)}%</span>
        <span class="numeric ${cls(h.pnlPct)}">${pctS(h.pnlPct)}</span></div>`).join('')
    : `<div class="empty">All cash — the bot hasn't found a BUY worth taking yet.</div>`;
  return `<div class="two-col">
    <div class="panel"><div class="section-title">Value over time</div>${equityCurve(f.equity, f.base)}</div>
    <div class="panel"><div class="section-title">Holdings · ${f.holdings.length}</div>${rows}</div>
  </div>`;
}

const ICON = { trade: '⇄', decision: '💭', offline: '⚠', error: '✕', flip: '↻', daily: '📅', result: '🏁', challenge: '▶', graded: '⚖' };

function thesisList(theses) {
  return (theses || []).map((t) => `<div class="th"><span class="stance ${t.stance}">${t.stance}</span> <b>${esc(t.agent)}</b> <span class="numeric" style="color:var(--dim)">${t.confidence}%</span> — ${esc(t.thesis)}</div>`).join('');
}

function tradeCard(e) {
  const t = e.trade, buy = t.side === 'BUY';
  return `<div class="ev trade">
    <div class="ev-h"><span class="sig-action ${buy ? 'buy' : 'sell'}">${t.side}</span> <b>${t.asset}</b> <span class="numeric">${eur(t.value)} @ $${+Number(t.priceUsd).toFixed(4)}</span>
      ${t.side === 'SELL' ? `<span class="numeric ${cls(t.realized)}">${t.realized >= 0 ? 'profit' : 'loss'} ${eur(Math.abs(t.realized))} (${pctS(t.realizedPct)})</span>` : ''}</div>
    <div class="ev-why"><b>${esc(t.headline)}</b></div>
    ${t.reason ? `<div class="ev-why">Why: ${esc(t.reason)}</div>` : ''}
    ${t.risk ? `<div class="ev-risk">Risk it accepts: ${esc(t.risk)}</div>` : ''}
    ${t.theses?.length ? `<details><summary>What each analyst said</summary>${thesisList(t.theses)}</details>` : ''}
  </div>`;
}

function cycleCard(c) {
  const end = c.events.find((e) => e.type === 'cycle_end');
  const start = c.events.find((e) => e.type === 'cycle');
  const trades = c.events.filter((e) => e.type === 'trade');
  const notes = c.events.filter((e) => ['decision', 'error', 'flip', 'graded'].includes(e.type));
  const analyses = c.events.filter((e) => e.type === 'analysis');
  const key = 'c' + c.id;
  return `<div class="cycle ${trades.length ? 'has-trades' : ''}">
    <div class="cy-h"><span class="cy-time">${new Date(c.t).toLocaleString()}</span>
      <span class="cy-tag">${!end ? '🧠 thinking…' : trades.length ? `${trades.length} trade${trades.length > 1 ? 's' : ''}` : 'no trade'}</span></div>
    <div class="cy-sum">${esc(end ? end.text : start?.text || '')}</div>
    ${trades.map(tradeCard).join('')}
    ${notes.map((n) => `<div class="ev note ${n.type}">${ICON[n.type] || '·'} ${esc(n.text)}</div>`).join('')}
    ${analyses.length ? `<details data-key="${key}" ${bot.open.has(key) ? 'open' : ''}><summary>Show the thinking — ${analyses.length} assets analysed</summary>
      ${analyses.map((a) => `<div class="an-row">
        <span class="sig-action ${a.action.toLowerCase()}">${a.action}</span> <b>${a.asset}</b>
        <span class="numeric" style="color:var(--dim)">${a.votes.bull}↑ ${a.votes.bear}↓ · strength ${a.strength}${a.price ? ` · $${+Number(a.price).toFixed(4)}` : ''}</span>
        <div class="an-why">${esc(a.reason)}${a.risk ? `<div class="ev-risk">Risk: ${esc(a.risk)}</div>` : ''}</div>
        ${a.theses?.length ? `<details><summary>The 6 analysts</summary>${thesisList(a.theses)}</details>` : ''}
      </div>`).join('')}
    </details>` : ''}
  </div>`;
}

function journal() {
  const items = [];
  const cycles = new Map();
  for (const e of bot.events) {
    if (e.cycle) {
      if (!cycles.has(e.cycle)) { const c = { kind: 'cycle', id: e.cycle, t: e.t, events: [] }; cycles.set(e.cycle, c); items.push(c); }
      cycles.get(e.cycle).events.push(e);
    } else items.push({ kind: 'event', t: e.t, e });
  }
  let list = items.reverse();
  if (bot.onlyTrades) list = list.filter((x) => (x.kind === 'event' ? ['result', 'challenge', 'offline', 'daily'].includes(x.e.type) : x.events.some((e) => e.type === 'trade')));
  const html = list.slice(0, 120).map((x) => (x.kind === 'cycle' ? cycleCard(x)
    : `<div class="ev solo ${x.e.type}"><span class="cy-time">${new Date(x.t).toLocaleString()}</span> ${ICON[x.e.type] || '·'} ${esc(x.e.text)}</div>`)).join('');
  return `<div class="panel fade-in" style="margin-top:16px">
    <div class="sig-top" style="margin-bottom:10px"><div class="section-title" style="margin:0">Journal — what the bot thought, decided and did</div>
      <label class="track-sub" style="cursor:pointer"><input type="checkbox" id="only-trades" ${bot.onlyTrades ? 'checked' : ''}> only cycles with trades</label></div>
    ${html || '<div class="empty">Nothing yet — the first cycle runs ~20 s after the server starts.</div>'}
  </div>`;
}

function renderBot() {
  const f = bot.view;
  if (!f) return;
  const scroll = $('#fund').scrollTop;
  $('#fund-body').innerHTML = `<div id="bot-status"></div>` + challengeHero(f) + benchPanel(f) + holdingsPanel(f) + journal() + fundNote();
  renderBotStatus();
  $('#fund').scrollTop = scroll;
  document.querySelectorAll('#fund-body details[data-key]').forEach((d) => d.addEventListener('toggle', () => (d.open ? bot.open.add(d.dataset.key) : bot.open.delete(d.dataset.key))));
  $('#only-trades').onchange = (e) => { bot.onlyTrades = e.target.checked; renderBot(); };
  $('#start-ch')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Starting…';
    await api('/api/fund/start', { method: 'POST' });
    loadBot(true);
  });
  $('#auto-toggle')?.addEventListener('click', async () => {
    await api('/api/fund/auto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !f.autoOn }) });
    loadBot(true);
  });
  $('#reset-fund')?.addEventListener('click', async () => {
    if (confirm('Reset? This ends the current challenge and clears its trades (the journal is kept).')) {
      await api('/api/fund/reset', { method: 'POST' });
      loadBot(true);
    }
  });
}

// Header status pill — visible on every tab.
async function refreshPill() {
  let s = null;
  try { s = await api('/api/status'); } catch {}
  const i = statusInfo(s);
  const short = !s ? 'offline' : s.health === 'thinking' ? `thinking ${s.progress?.i || 0}/${s.progress?.n || '?'}` : s.health === 'late' ? 'late' : `live · next ${fmtIn(s.nextRunAt - Date.now())}`;
  const el = $('#bot-pill');
  el.className = 'badge pill ' + i.cls;
  el.title = i.text;
  el.innerHTML = `<span class="light ${i.cls}"></span> bot ${short}`;
  if (s) renderEngineBadge(s.claude);
}

// Engine badge: says whether Claude is actually answering, not just configured.
function claudeState(c) {
  if (!c?.enabled) return { cls: '', text: 'engine: <b>rules only</b> (no Claude key)', tip: 'No ANTHROPIC_API_KEY set — analysts use built-in rules. No Claude calls, no cost.' };
  const cost = `${c.estCostUsd.toFixed(2)} today`;
  if (c.capped) return { cls: 'late', text: `Claude: <b>daily cap reached</b> · ${cost}`, tip: `${c.calls}/${c.cap} calls used today — rules until midnight UTC.` };
  if (c.failed && !c.ok) return { cls: 'stopped', text: 'Claude: <b>failing</b> — rules used', tip: `All ${c.failed} calls today failed: ${c.lastError}` };
  if (!c.calls) return { cls: '', text: `Claude: <b>${esc(c.model)}</b> · no calls yet today`, tip: 'Key set; waiting for the next cycle.' };
  return { cls: c.failed ? 'late' : 'live', text: `Claude ✓ <b>${c.ok}</b> ok${c.failed ? ` · ${c.failed} failed` : ''} · ${cost}`, tip: `${esc(c.model)} · ${c.inTok} in / ${c.outTok} out tokens today${c.lastError ? ' · last error: ' + c.lastError : ''}` };
}
function renderEngineBadge(c) {
  const st = claudeState(c);
  const el = $('#llm-badge');
  el.innerHTML = (st.cls ? `<span class="light ${st.cls}"></span> ` : '') + st.text;
  el.title = st.tip;
  el.style.display = 'inline-flex'; el.style.gap = '7px'; el.style.alignItems = 'center';
}

function equityCurve(equity, base) {
  const w = 900, h = 200, pad = 6;
  if (!equity || equity.length < 2) {
    return `<div class="empty">The equity curve will appear once the fund has run a few cycles.</div>`;
  }
  const vals = equity.map((e) => e.value);
  const mn = Math.min(base, ...vals), mx = Math.max(base, ...vals), rng = mx - mn || 1;
  const X = (i) => pad + (i / (equity.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - mn) / rng) * (h - pad * 2);
  const line = equity.map((e, i) => `${X(i).toFixed(1)},${Y(e.value).toFixed(1)}`).join(' ');
  const last = vals[vals.length - 1];
  const col = last >= base ? '#34d399' : '#fb7185';
  const baseY = Y(base).toFixed(1);
  const area = `${X(0).toFixed(1)},${(h - pad).toFixed(1)} ${line} ${X(equity.length - 1).toFixed(1)},${(h - pad).toFixed(1)}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:200px;display:block">
    <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${col}" stop-opacity="0.28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#eg)"/>
    <line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="4 4" stroke-width="1"/>
    <polyline points="${line}" fill="none" stroke="${col}" stroke-width="2"/>
  </svg>`;
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}

function fundNote() {
  return `<div class="disclaimer">Simulation with virtual money at real live prices (crypto via Binance, stocks via live quotes), converted at the live EUR/USD rate with a 0.1% fee per trade. Not modelled: bid/ask spread, slippage, broker minimums, exchange holidays. The bot only acts while the server is running — offline gaps are shown in the journal.</div>`;
}

function ledgerNote() {
  return `<div class="disclaimer">Calibration gap = stated confidence − realized hit-rate. A gap near zero means an analyst's confidence is honest; a large positive gap means overconfidence. Brier score: 0 is perfect, lower is better. This is the heart of FinBot 100 — we don't hide when our AI is wrong.</div>`;
}

boot();
