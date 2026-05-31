// FinBot 100 frontend — vanilla JS. Three views: Universe map, Council, Ledger.
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
  await loadUniverse();
  initMap();
  refreshCapital();

  // deep-link: #council, #council/NVDA, #ledger
  const route = () => {
    const h = location.hash.replace('#', '');
    const [view, asset] = h.split('/');
    if (view === 'council') { state.selected = asset || state.selected || 'BTC'; switchView('council'); loadCouncil(state.selected); }
    else if (view === 'ledger') switchView('ledger');
    else switchView('universe');
  };
  window.addEventListener('hashchange', route);
  if (location.hash) route();
}

function setupNav() {
  document.querySelectorAll('nav button').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view))
  );
}
function switchView(v) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === v));
  if (v === 'ledger') loadLedger();
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

function ledgerNote() {
  return `<div class="disclaimer">Calibration gap = stated confidence − realized hit-rate. A gap near zero means an analyst's confidence is honest; a large positive gap means overconfidence. Brier score: 0 is perfect, lower is better. This is the heart of FinBot 100 — we don't hide when our AI is wrong.</div>`;
}

boot();
