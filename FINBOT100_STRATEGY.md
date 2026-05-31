# FINBOT 100 — Strategic Dossier
**Confidential. Founder: Moussa Zaghdoup.**
Prepared by the founding team (Product, FinTech, Quant, Risk, AI, Full-Stack, UX, 3D, Growth, Security).
Date: 2026-05-29 · Status: Pre-build concept review · **No code written yet.**

---

## 0. How to read this document

The brief asked one thing before everything else: *challenge the concept.* So Sections 1–3 are a blunt critique and a redesign. If you only read three pages, read those. Sections 4–23 are the requested deliverables, written **against the redesigned concept**, not the original. Where I disagree with the brief, I say so explicitly.

---

# PART I — THE CHALLENGE (read this first)

## 1. The honest critique of FinBot 100 as briefed

I'll be the investor in the room who isn't polite.

The concept as written is **three good ideas stapled to one fatal flaw, wrapped in a visual gimmick.** Let me separate them.

### 1.1 The fatal flaw: "AI tells you BUY NVIDIA, 84% confidence"

This is the heart of the brief and it is the weakest part. Three problems, in order of severity:

**(a) It's regulatory quicksand.** A platform that says *"BUY NVIDIA, confidence 84%, horizon 5 days"* is giving investment advice. Calling it "educational" and "virtual" does **not** reliably protect you. In the EU (MiFID II), the UK (FCA), and the US (SEC/FINRA), the test is *substance over label.* The moment a user can read "BUY NVIDIA 84%" and act on it with real money in their own broker — and they will — you are one complaint away from a regulator treating you as an unlicensed advisor or unregistered "robo-advisor." Finfluencer enforcement is at an all-time high in 2024–2026. **This single feature is the biggest existential risk in the entire project, larger than any technical risk.**

**(b) It's commoditized.** In 2026, "AI that picks stocks and explains why" is a crowded graveyard. Every brokerage, every fintech, and a hundred GPT-wrapper apps do this. ChatGPT itself does it for free. A confidence score on a buy signal is *table stakes,* not a moat. You will be one of 500.

**(c) The confidence number is fake precision.** "84%" implies a calibrated probability the system cannot actually deliver for a 5-day equity move. Quant desks with PhDs and decades of data don't claim 84% on a 5-day directional call. Showing a number that specific is either dishonest or naive, and sophisticated users — the ones who'd pay — will spot it in five minutes and leave.

### 1.2 The €100 virtual capital: a weak engagement loop

Paper trading has a known, brutal retention curve. **Nothing is at stake, so nothing is felt.** The dopamine of trading comes from risk; remove risk and you remove the loop. Industry paper-trading tools see most users abandon within 2 weeks. €100 *virtual* is even weaker than a generic paper portfolio because it's too small to feel meaningful and too fake to feel real. As briefed, this is the retention problem, not the retention solution.

### 1.3 The 3D galaxy: beautiful, probably abandoned

The Nexus-style living galaxy is genuinely the most *memorable* part of the pitch and the best viral/demo asset. But be honest about the failure mode of finance-in-3D: **users disable it after the wow wears off** because rotating a galaxy is slower than reading a list when you have a real question ("is my position up?"). 3D in finance dies when it's *decorative.* It survives only when it shows something a 2D chart structurally *cannot* — relationships, contagion, flows, density. So the galaxy must earn its place by visualizing **structure and causality**, not prices. Prices belong in 2D.

### 1.4 What's actually strong (and underexploited)

Buried in the brief are the real diamonds:

1. **The multi-agent debate.** SAGE vs ATLAS vs ORACLE *disagreeing* is far more interesting, more honest, and more teachable than a single oracle handing down a verdict. Markets ARE a debate. Nobody has productized the *disagreement* well.
2. **The Learning Engine — expected vs. actual, success/failure rates.** This is the single most differentiated idea in the entire document and it's listed as feature #9 of 20. **It should be the spine of the product.** A system that *publicly and ruthlessly tracks how often its own AI was wrong* is the opposite of every snake-oil "AI stock picker." It's trustworthy, it's novel, it's defensible, and it's viral.
3. **Causality and structure visualization.** "News becomes energy pulses, events create shockwaves, correlation creates links, capital flows become streams of light." If the 3D shows *why the market moved and what's connected to what,* that's a genuinely new way to see markets.

## 2. The redesign: from "AI stock picker" to "the market's reasoning, made visible and accountable"

Here is the reframe I'd stake the company on.

> **Stop building an oracle that tells people what to buy.**
> **Build the world's most transparent, accountable, and visual *reasoning* engine for markets — one that teaches you to *think* like a desk, shows its agents argue, and keeps an unforgiving public scoreboard of how right it's been.**

The product's promise changes from *"follow our AI and get rich"* (legally toxic, commoditized, low-trust) to:

> **"Understand why the world's markets are moving today — and watch our AI analysts debate it, commit to falsifiable calls, and get publicly graded on every one."**

This is defensible because the moat isn't the prediction (anyone can predict) — **the moat is the accountability layer and the accumulated track record.** A 3-year history of calibrated, graded, timestamped agent calls is something a competitor cannot copy on day one. It compounds.

### 2.1 The three pillars of the redesigned FinBot 100

**Pillar 1 — The Living Market Map (the 3D Nexus, but functional).**
A real-time spatial model of the market where position = relationship, not price. Sectors are constellations, correlation is gravity, capital flow is light, news is a pulse that propagates through *connected* assets so you literally *see contagion.* Its job: answer "what is connected to what, and what's moving through the system right now?" — the one question 2D dashboards genuinely cannot answer.

**Pillar 2 — The Analyst Council (multi-agent debate, not oracle).**
6 agents with distinct mandates, data, and *temperaments* who produce **theses, not orders.** They explicitly disagree. The user sees a structured debate: ORACLE is bullish NVDA on momentum; ATLAS flags concentration risk; SAGE says macro tailwind intact; SENTINEL flags an export-control headline. The output is a **reasoned, multi-sided brief** — the thing a junior analyst would kill to sit in on. Crucially: agents make **falsifiable predictions with explicit horizons,** which feeds Pillar 3.

**Pillar 3 — The Accountability Ledger (the Learning Engine, promoted to the spine).**
Every agent call is logged: thesis, confidence (as a *calibrated probability,* honestly), horizon, catalyst. When the horizon expires, it's **automatically graded** against reality. Each agent has a permanent, public **calibration score** (Brier score / hit-rate / "when SAGE says 70%, it happens 68% of the time"). The product *celebrates being wrong well and calls out being confidently wrong.* This is the trust engine and the viral engine simultaneously ("FinBot's ORACLE went 0-for-5 on crypto this month 💀" is a shareable moment).

### 2.2 Fixing the €100 and the engagement loop

Keep the €100 as an **onboarding metaphor**, not the core loop. Reframe it: the user doesn't "paper trade for fake gains" — the user **allocates €100 of conviction across the agents and their theses, then watches whose reasoning actually paid off.** You're betting on *whose thinking is right,* not on price. This turns a dead paper-trading loop into a *daily reason to return:* "Did my analysts' calls play out? Did my read of the market beat ORACLE's?"

Add a **"You vs. the Council"** mechanic: the user records their own prediction *before* seeing the agents', and gets their own calibration score over time. Now the product is teaching you to think, measuring whether you're learning, and making it a game. *That* is a retention loop.

### 2.3 The one-line positioning after redesign

> **FinBot 100 — See why the market moves. Watch the AI argue. Keep the receipts.**

---

# PART II — THE DELIVERABLES (against the redesigned concept)

## 3. Executive Summary

FinBot 100 is an **educational financial-intelligence platform** that makes global markets *legible* through three integrated experiences: a functional real-time **3D market map** (relationships, contagion, capital flow), an **AI Analyst Council** of six specialized agents that debate the market and issue falsifiable theses, and an **Accountability Ledger** that grades every call and publishes the AI's true track record. Users explore with €100 of "conviction capital," compete against the Council's reasoning, and build their own market-thinking skill — measured by a personal calibration score.

The strategic wager: **in a market flooded with black-box "AI stock pickers," radical transparency about reasoning *and* accuracy is the only durable moat.** The product is positioned as educational and explicitly avoids issuing executable buy/sell advice on real assets — a deliberate choice that is both the core differentiator and the primary regulatory safeguard.

**Build recommendation:** Proceed, but **not** as the brief is written. Adopt the redesign. Ship a tightly-scoped MVP (US equities + crypto only; 3 of 6 agents; 2D-first with one "hero" 3D view) and let the track record compound before broadening.

## 4. Product Vision, Mission, Positioning

- **Vision:** A world where any curious person can understand *why* markets move as clearly as a hedge-fund analyst — and can tell the difference between insight and confident nonsense.
- **Mission:** Make market reasoning visible, multi-sided, and accountable.
- **Positioning:** *The explainable, accountable market-intelligence layer.* Not a broker, not a signal service, not a chatroom. Sits between "news" (what happened) and "brokerage" (where you act) and owns "**why, and according to whom, and were they right last time.**"
- **Value proposition (by segment):**
  - *Curious beginner:* "Finally understand the market without a finance degree, safely."
  - *Engaged retail/learner:* "Sharpen your own market judgment and prove it's improving."
  - *Pro/prosumer:* "A calibrated, multi-agent reasoning console with a verifiable track record."

## 5. Market Analysis

- **TAM framing:** retail investing + fintech-edu + market-data/intelligence. Hundreds of millions of retail investors globally; tens of millions actively seeking *understanding,* not just execution.
- **Macro tailwinds (2026):** retail participation structurally high; AI-native expectations; deep distrust of finfluencers and black-box signals (regulatory crackdowns have made audiences cynical → *accountability sells*).
- **Headwinds:** AI-finance noise saturation; data-licensing cost; regulatory scrutiny of anything resembling advice; hard direct monetization of "education."
- **Wedge:** the *accountability + explainability* angle is currently unoccupied at consumer scale.

## 6. Competitive Benchmark

| Product | Core job | Strength | Weakness FinBot exploits |
|---|---|---|---|
| **TradingView** | Charting/social | Best charts, huge community | No reasoning layer; no AI accountability; chart-centric |
| **Bloomberg Terminal** | Pro data/intel | Depth, authority | $24k/yr, ugly, intimidating, no explainability for non-pros |
| **eToro** | Social/copy trading | Copy trading, social proof | "Copy" = black box; real-money risk; no teaching of *why* |
| **Robinhood** | Execution | Frictionless trading | Gamifies *trading,* not *understanding*; thin analysis |
| **Yahoo Finance** | Data portal | Free, broad | Commodity data, no synthesis, no opinion-with-receipts |
| **Seeking Alpha** | Opinion/analysis | Deep human takes | No track-record enforcement; quality variance; paywalled noise |
| **Finimize** | Bite-size edu | Great UX, digestible | One voice, no debate, no personalization, no accountability |
| **Delta / CMC** | Portfolio/crypto tracking | Clean tracking | Tracking only; no intelligence; no teaching |

**Whitespace owned by FinBot:** *explainable multi-agent reasoning + enforced public accuracy ledger + functional relationship visualization.* No incumbent combines even two of these.

## 7. Product Strategy

- **Strategy:** Win trust first (accountability), then engagement (debate + game), then monetize (depth + status). Be the "Rotten Tomatoes + replay booth" of market opinions.
- **Competitive advantages / moats (ranked):**
  1. **Accumulated, verifiable track record** (compounding data moat).
  2. **Calibration as a brand** (hard to copy without admitting your own AI is often wrong — incumbents won't).
  3. **Multi-agent debate IP** (orchestration + persona design + disagreement modeling).
  4. **Functional 3D market map** (demo/virality + genuine UX edge).
  5. **Community of "calibrated thinkers"** (your top users become a status hierarchy).
- **Sequencing:** narrow asset coverage early; depth-then-breadth; let the ledger age.

## 8. User Personas & Journeys

**Personas**
1. *Lina, 24, curious beginner.* Wants to understand headlines, scared of losing money. Hook: safe exploration + "I finally get it."
2. *Marc, 34, engaged retail.* Trades a bit, wants an edge and to learn. Hook: You-vs-Council, calibration score, debate.
3. *Priya, 41, prosumer/analyst.* Semi-pro, distrusts hype. Hook: verifiable track record, multi-agent rigor, exportable theses.
4. *(Future) Sofia, 29, creator/educator.* Wants content + credibility. Hook: shareable graded calls, public profile.

**Journey — Marc, day 1 → day 30**
- *Min 0–3:* Lands on Living Market Map mid-event ("Fed surprise rippling through rate-sensitive sectors — watch the shockwave"). Instant *alive* feeling.
- *Min 3–10:* Opens today's Council Brief on a hot asset; sees ORACLE vs ATLAS disagree; reads the *why.*
- *Min 10–15:* Makes his own prediction before revealing the Council's; allocates conviction €.
- *Day 2–7:* Returns to see which calls resolved; his calibration score appears.
- *Day 30:* Has a personal accuracy trend, a streak, follows two agents, shares a "called it" card.

## 9. Feature Catalog (MVP → later)

**MVP (must-have to prove the thesis)**
- Living Market Map (one hero 3D view: sector constellations + correlation gravity + live news pulses) — *US equities + BTC/ETH only.*
- Analyst Council with **3 agents** (SAGE macro, ORACLE momentum/technical, ATLAS risk).
- Council Brief: structured multi-agent debate with explicit disagreement on a given asset/theme.
- **Accountability Ledger:** every call logged, auto-graded at horizon, per-agent calibration score.
- €100 Conviction allocation + **You-vs-Council** prediction game + personal calibration.
- Daily "Market Pulse" narrative (what moved, why, what's connected).
- Auth, persistence, portfolio/positions, decision history.

**Phase 2**
- Full 6-agent council (SCOUT news, SENTINEL geopolitics, ALCHEMIST optimizer).
- More assets (ETFs, FX, commodities, more crypto).
- Deeper 3D (contagion replay, capital-flow streams, volatility motion).
- Personalized agent (learns the user's interests/risk literacy).

**Phase 3 (design only — do not build now)**
- Paper-trading competitions / leagues; strategy marketplace; community theses; premium tiers; *(far future, heavily gated)* real-brokerage read-only integration. **Real-money execution is explicitly out of scope and a regulatory tripwire — see §13 & §22.**

## 10. AI Agent Architecture (The Council)

**Design principles:** theses not orders; explicit disagreement; falsifiable + horizon-bound; every claim cites evidence; confidence is a *calibrated probability,* shown with its historical reliability.

| Agent | Role | Personality | Primary inputs | Output |
|---|---|---|---|---|
| **SAGE** | Macro economist | Measured, long-horizon, contrarian to hype | Rates, inflation, central-bank comms, econ releases | Macro regime thesis |
| **ORACLE** | Market/technical/momentum | Fast, probabilistic, blunt about uncertainty | Price/volume, momentum, flows | Directional thesis + horizon |
| **ATLAS** | Risk manager | Skeptical, defensive, the "no" voice | Volatility, correlation, concentration, drawdown | Risk assessment + counter-thesis |
| **SCOUT** | News intelligence | Curious, fast, source-cautious | News feeds, filings, earnings | Event detection + summary + relevance |
| **SENTINEL** | Geopolitics | Strategic, cautious, scenario-driven | Geopolitical events, policy, commodities-as-signal | Scenario/risk flags |
| **ALCHEMIST** | Portfolio optimizer | Systematic, dispassionate | Outputs of others + user's portfolio | Allocation/diversification view |

**Orchestration:** an *Editor/Moderator* layer (not a 7th opinion) that (1) routes a question to relevant agents, (2) runs a bounded debate protocol (claim → rebuttal → synthesis), (3) extracts falsifiable predictions for the Ledger, (4) enforces the "cite evidence" and "honest uncertainty" rules, (5) produces the user-facing brief. Implemented as a typed multi-agent graph (see §12). Anti-hallucination: agents may only assert facts traceable to a retrieved source; numeric market claims must come from the data layer, not the LLM.

## 11. Data Architecture

**Pipeline:** Providers → ingestion (streaming + scheduled) → normalization/entity-resolution (every asset/company/country/event is a node with a stable ID) → time-series store (prices/indicators) + document store (news/filings) + **knowledge graph** (relationships: sector membership, supply-chain, correlation, ownership, geography) → feature/embedding store → agent retrieval (RAG over news + graph + time-series) → Ledger (predictions & outcomes) → analytics.

The **knowledge graph is the substrate for both the 3D map and the agents' reasoning** — same entities, same edges. That's the architectural unlock: viz and reasoning share one model of the world.

## 12. Technical Architecture (recommended stack, with justification)

> Principle: **boring, proven, single-language where possible.** This is a complex product; the stack should be unremarkable so the *product* can be remarkable. A solo/small founder team should not also be debugging exotic infra.

- **Frontend:** **Next.js (React, TypeScript)** + **Tailwind** + **Three.js / react-three-fiber** for the 3D map + **D3/visx** for 2D + **TanStack Query**. *Why:* one ecosystem, best-in-class 3D-in-browser via R3F, huge talent pool, SSR for SEO on the "why the market moved" content (a growth channel).
- **Backend:** **TypeScript (Node) for the API/BFF**; **Python for the AI/quant/agent services** (FastAPI). *Why:* TS keeps front/back unified; Python is non-negotiable for the data-science/agent ecosystem. Split along that natural seam, communicate over a typed contract.
- **Agent framework:** **LangGraph** (or a thin custom orchestrator) for the typed multi-agent debate graph; **structured outputs** for all agent responses.
- **AI providers:** **Anthropic Claude (Opus for the heavy reasoning/debate synthesis, Haiku for cheap classification/routing)** as primary; keep a provider-abstraction so a second model (e.g. for redundancy/cost) can slot in. *Why Claude:* strong reasoning + tool use + steerability for persona/honesty constraints; abstraction avoids lock-in.
- **Database:** **PostgreSQL** (primary, relational + JSONB) + **TimescaleDB** extension for time-series prices + **pgvector** for embeddings. *Why:* one database engine covers relational, time-series, and vector — radically simpler ops than 3 systems. Add a dedicated **graph** layer only if Postgres recursive queries prove insufficient (start with Postgres; graph DB is a Phase-2 question, not a day-1 commitment).
- **Cache / realtime:** **Redis** (cache, rate-limit, pub/sub) + **WebSocket** gateway for live map/pulse updates.
- **Hosting:** **Vercel** (frontend) + **a managed container platform (Railway/Render/Fly, or AWS ECS/Fargate as you scale)** for services + **managed Postgres (Neon/Supabase/RDS)**. *Why:* minimize ops; pay for managed reliability over self-hosting heroics at this stage.
- **Monitoring/Observability:** **Sentry** (errors), **OpenTelemetry + Grafana/Datadog** (traces/metrics), **structured logs**, and a dedicated **LLM-observability** tool (Langfuse/Helicone) for token cost, latency, and *agent-output auditing* — essential when your brand is "we're accountable."

## 13. Security Architecture

- **AuthN:** managed identity (Clerk/Auth0/Supabase Auth) — passwordless + OAuth + MFA. Don't roll your own auth.
- **AuthZ:** role-based + row-level security in Postgres (users see only their data).
- **Secrets:** a managed vault (cloud KMS / Doppler); **no secrets in code or env files committed anywhere**; rotation policy.
- **Encryption:** TLS everywhere; encryption at rest (DB + backups); field-level encryption for any PII.
- **API protection:** gateway with per-user + per-IP **rate limiting**, request signing for internal service calls, strict input validation, WAF.
- **AI-specific:** prompt-injection defenses (treat retrieved news/web content as untrusted; never let it issue tool calls), output filtering, cost guardrails per user/session.
- **Audit trails:** immutable, append-only log of every agent decision and every user action (this *doubles* as the Ledger's integrity guarantee — tamper-evidence is part of the trust pitch).
- **Compliance posture:** GDPR by design; clear data-retention; and — critically — a **legal/compliance review of the "educational, not advice" boundary before launch.** Disclaimers, the absence of executable real-asset orders, and the framing of agents as opinion-with-track-record are deliberate design choices to stay on the right side of that line. *This is a board-level risk, not a footnote.*

## 14. UX Concept

- **Principle: 2D-first for answers, 3D for understanding.** Never force the user into 3D to do a simple thing.
- **Three "rooms":**
  1. **The Map** (3D Living Universe) — explore structure & contagion.
  2. **The Council** (debate room) — read/participate in the reasoning.
  3. **The Ledger** (track record) — see who was right, including yourself.
- **Tone:** calm intelligence, not casino. Dark, spatial, cinematic — but legible. No confetti for "wins"; the reward is *insight* and *being calibrated.*
- **Signature moments:** the "shockwave" when major news hits the map; the "reveal" when you compare your prediction to the Council's; the monthly "report card" for each agent and for you.

## 15. 3D Visualization Concept (functional, not decorative)

- **Spatial grammar:**
  - *Position* = sector/region clustering (constellations), **not** price.
  - *Gravity / link strength* = correlation. Highly correlated assets pull together; you *see* clusters form and break.
  - *Brightness/size* = attention/volume/market cap.
  - *Color* = regime (risk-on/off) or your own holdings.
  - *Light streams* = capital flow direction.
  - *Pulses/shockwaves* = news/events propagating **through connected nodes** → visible contagion ("the chip-export headline lights up SCOUT's node, then ripples to semis, then to their suppliers in Asia").
  - *Motion/jitter* = volatility.
- **The rule that keeps it from being a gimmick:** every visual encodes a variable a 2D view can't show simultaneously (relationship + flow + propagation in one frame). If a view doesn't pass that test, it's a chart, and it should be a chart.
- **Performance:** instanced rendering, LOD, GPU particles for flows; degrade gracefully to 2D on weak devices.

## 16. Database Model (core entities)

- `users`, `user_settings`
- `entities` (polymorphic node: asset | company | sector | country | event | macro_indicator) + stable IDs
- `entity_relationships` (edge: type ∈ {correlation, sector, supply_chain, ownership, geography}, weight, as_of)
- `prices` / `market_data` (Timescale hypertable: entity_id, ts, ohlcv, indicators)
- `news_items` (source, url, ts, entities[], embedding) — **store references, never republish full licensed text**
- `agents` (id, role, persona, config)
- `agent_predictions` (**the spine**: id, agent_id, entity_id, thesis, stance ∈ {bull/bear/neutral}, calibrated_confidence, horizon, catalyst, evidence_refs[], created_at)
- `prediction_outcomes` (prediction_id, resolved_at, actual_outcome, score/brier, hit boolean)
- `agent_calibration` (rolling per-agent accuracy, brier, hit-rate by asset/horizon)
- `council_sessions` (a debate: question, agents[], transcript, synthesis, predictions[])
- `user_predictions` + `user_calibration` (the You-vs-Council game)
- `portfolios`, `positions` (the €100 conviction allocation), `transactions`
- `audit_log` (append-only)

## 17. API Architecture

- **Pattern:** typed BFF (Node) for the client; internal **REST/RPC + a typed contract (OpenAPI/tRPC/protobuf)** between BFF and the Python AI services; **WebSocket** channel for live map/pulse/ledger updates.
- **Key surfaces:** `/map/state` (+ ws stream), `/council/session` (ask → debate → brief), `/ledger/agents/:id` (track record), `/predictions` (user submit), `/portfolio`. Versioned, rate-limited, idempotent writes.
- **Agent layer:** internal-only; never exposes raw model access to clients (cost + injection control).

## 18. Scalability Strategy

- **Stateless services** behind autoscaling; **Redis** for hot reads; **Timescale** for time-series compression/continuous aggregates.
- **Cost is dominated by (a) data licensing and (b) LLM tokens.** Mitigate with: cache agent briefs (most users see the *same* market, so debates are largely **shared, not per-user** — compute once, personalize the framing); cheap models for routing/classification, expensive only for synthesis; batch grading jobs for the Ledger; aggressive prompt caching.
- **Read-heavy, fan-out architecture:** one market truth, many viewers → CDN/edge cache the public "why the market moved" content (also the SEO/growth engine).

## 19. Monetization Strategy (with a reality check)

**Reality check first:** "education + virtual money" is *hard* to monetize directly; do not assume people pay to learn. Monetize **status, depth, and edge** — not access to basics.

- **Free:** Map, daily pulse, Council briefs on major assets, basic Ledger, the €100 game. (This tier is the growth/SEO/virality engine — keep it generous.)
- **Premium (€/mo):** all 6 agents, deep/historical Ledger analytics, personal calibration coaching, alerts, more assets, "ask the Council" on any asset, export.
- **Pro/Prosumer:** API access to graded theses + calibration data, advanced 3D analytics, multiple watch-universes.
- **Later (design-only):** strategy marketplace (rev-share), creator profiles, competitions with sponsorships, B2B/education licensing (the "accountable AI reasoning" engine licensed to schools/media — *potentially the biggest line, and the most defensible*).
- **Explicitly rejected:** payment-for-order-flow, anything tied to real execution, selling "signals." These poison the trust moat.

## 20. Roadmap

- **Phase 0 (now):** this dossier → **legal/compliance opinion on the advice boundary** → tracer-bullet spike (one asset, one agent, one ledger entry, end-to-end) to validate the data+agent+grading loop. *Do not build the galaxy first.*
- **Phase 1 — MVP (the thesis test):** US equities + BTC/ETH; 3 agents; one hero 3D view; Ledger + You-vs-Council; daily pulse. **Goal: prove people return for the reasoning + accountability, and that calibration works.**
- **Phase 2 — Depth:** 6 agents; more assets; richer 3D (contagion replay, flows); personalization; premium tier.
- **Phase 3 — Network:** community theses, competitions, marketplace, B2B licensing; *(gated, far)* read-only brokerage view.

## 21. Risks (ranked)

1. **Regulatory — being treated as investment advice.** *Mitigation:* the redesign (theses not orders, no real execution, accountability framing), legal review pre-launch, jurisdiction-aware disclaimers, possibly geo-gating.
2. **Trust collapse if the AI is confidently wrong and you hid it.** *Mitigation:* the Ledger *is* the mitigation — make accuracy public and calibration honest. Turn the risk into the brand.
3. **Data licensing cost & terms** (esp. news republication, market data). *Mitigation:* store references not content; negotiate; start narrow.
4. **LLM cost / latency / hallucination.** *Mitigation:* shared (not per-user) debates, model tiering, RAG-grounded facts, structured outputs, LLM observability.
5. **3D gimmick / abandonment.** *Mitigation:* the "must encode what 2D can't" rule; 2D-first; graceful degrade.
6. **Engagement (paper-trading death spiral).** *Mitigation:* You-vs-Council game + calibration progression replaces the dead paper loop.
7. **Scope explosion** (the brief is enormous). *Mitigation:* ruthless MVP; 3 agents, 2 asset classes, 1 hero view.

## 22. Recommendations (what I'd do Monday)

1. **Adopt the redesign.** Reposition from "AI stock picker with confidence scores" to "explainable, accountable, visual market-reasoning." This is the single highest-leverage decision.
2. **Kill the executable "BUY NVIDIA 84%" pattern.** Replace with falsifiable *theses* that get graded. Protects you legally and differentiates you.
3. **Promote the Learning Engine to the spine.** The Accountability Ledger is the moat and the brand.
4. **Get a real compliance opinion before writing product code.** One lawyer-day now saves the company later.
5. **Run a 1-asset tracer-bullet** to de-risk the data→agent→debate→grade loop before touching the 3D galaxy.
6. **Make 3D earn its place.** One functional hero view, not a decorative universe.
7. **Stay narrow in MVP.** US equities + BTC/ETH, 3 agents. Let the track record age — that's the asset competitors can't clone.

## 23. The verdict

The original FinBot 100 is a *good idea with a dangerous core and an underused gem.* As briefed, it's an undifferentiated, legally exposed AI stock-picker dressed in a beautiful but decorative galaxy. **Redesigned around accountability, debate, and functional visualization, it becomes something genuinely defensible and genuinely new: the trust layer for AI market reasoning.** That's a company. The other version is a feature.

Proceed — on the redesign, narrowly scoped, compliance-checked, and ledger-first.
