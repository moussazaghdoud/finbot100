# FINBOT 100 — Deep Dives
**Confidential. Founder: Moussa Zaghdoup.** Companion to `FINBOT100_STRATEGY.md`.
Three highest-leverage follow-ups: (A) the compliance boundary, (B) the agent debate protocol, (C) the tracer-bullet spec. **Still no product code.**

---

# A. The Compliance Boundary — "educational, not advice"

> This is not legal advice; it's an engineering/product spec for staying on the safe side of a line that a real lawyer must confirm per jurisdiction before launch. Treat the rules below as **product constraints**, the way you'd treat a security threat model.

## A.1 The core legal risk, stated plainly

Across the US (SEC/FINRA + Investment Advisers Act), EU (MiFID II), and UK (FCA), you can drift into regulated territory three ways:

1. **Investment advice** — a *personal recommendation* to buy/sell/hold a *specific* instrument, presented as suitable for a person. This is the big one.
2. **Financial promotion** — communicating an inducement to engage in investment activity (UK FCA's regime is especially strict; promotions must be issued/approved by an authorized person).
3. **Acting as an adviser/robo-adviser** — automated personalized recommendations = regulated activity requiring registration.

The label "educational" and the fact that money is "virtual" are **mitigating context, not a shield.** Regulators apply substance-over-form. A confident, specific, actionable "BUY NVDA now, 84%" aimed at a user *is* the prototype of a personal recommendation.

## A.2 The bright lines (product rules)

**Rules that keep the Council on the "information/education" side:**

| Do | Don't |
|---|---|
| Present **theses and scenarios** ("here's the bull case and the bear case") | Issue **personal recommendations** ("you should buy X") |
| Make calls **falsifiable and attributed to an agent** ("ORACLE's hypothesis") | Frame output as advice tailored to the user's situation |
| Show **probabilities with track record** ("our calls at this confidence hit ~X%") | Show **standalone actionable signals** ("BUY — 84%") with no accountability context |
| Keep it **general/informational** (about the asset, not about *you*) | Personalize to the user's **financial situation, goals, or suitability** |
| Operate only on the **virtual €100 inside the sim** | Enable, suggest, or one-click into **real-money execution** |
| Persistent, prominent **disclaimers + risk warnings** | Bury or omit disclaimers |
| Geo-aware behavior (gate features by jurisdiction) | Assume one ruleset fits all markets |

**The redesign already does most of this** — that's the point. "Theses, not orders" + "graded track record, not standalone signals" + "no real execution" + "general not personalized" is *the compliance posture and the differentiation simultaneously.*

## A.3 Specific design decisions

- **Output framing engine.** A mandatory presentation layer that wraps every agent output: it is *always* attributed ("ATLAS argues…"), *always* two-sided where material (bull + bear), *always* shown next to that agent's historical calibration, and *never* phrased as "you should." Build this as a hard constraint in the synthesis step, not a UI afterthought.
- **No personalization that implies suitability (MVP).** Don't ask for income, net worth, or goals, and don't tailor recommendations to them. You can personalize *interest* ("you follow semis") without personalizing *advice* ("buy semis"). Keep that distinction explicit in code (a `personalization_scope` flag: `topical` allowed, `suitability` forbidden in MVP).
- **The €100 is a closed sim.** No deposit, no link to a real broker, no "trade this for real" button anywhere in MVP/Phase-1/2. Real-brokerage integration is Phase-3 *design only* and would require its own licensing analysis (likely partnering with an already-regulated broker rather than becoming one).
- **Disclaimers as first-class UI.** Persistent footer + contextual ("This is an educational hypothesis, not investment advice. FinBot is not a financial adviser.") + onboarding acknowledgment. The UK financial-promotion regime in particular wants prominent, balanced risk warnings.
- **Geo-gating.** Detect jurisdiction; be ready to disable/modify features in stricter regimes. Architect for it now (a `jurisdiction` attribute on the session) even if MVP launches in one region.
- **News/data licensing compliance** (overlaps with §11 of the strategy doc): store *references*, link out, never republish full licensed article text; respect provider TOS on derived data.

## A.4 The one action that matters

**Before product code: a paid opinion from a fintech-securities lawyer in your launch jurisdiction**, reviewing (1) the thesis-not-advice framing, (2) the disclaimer set, (3) the no-execution boundary, (4) the financial-promotion angle. One lawyer-day. It either confirms the posture or reshapes the product while reshaping is still free. This is the cheapest insurance the company will ever buy.

---

# B. The Agent Debate Protocol

How the Council actually argues, synthesizes, and emits gradeable predictions. This is the core IP.

## B.1 Design goals

1. **Genuine disagreement** (not 6 agents nodding). Disagreement is the product.
2. **Grounded** — every factual claim traceable to retrieved data; numbers come from the data layer, never the model's memory.
3. **Falsifiable output** — each session yields predictions with stance + horizon + catalyst that the Ledger can auto-grade.
4. **Bounded cost/latency** — debates are *shared* across users (one market, many viewers), computed on a schedule + on-demand, cached.
5. **Honest uncertainty** — confidence is a calibrated probability shown with the agent's historical reliability.

## B.2 The graph (orchestration)

A typed multi-agent graph (LangGraph or a thin custom orchestrator). Nodes:

```
[Trigger]
   │  (scheduled market scan OR user question OR SCOUT news-event)
   ▼
[Router]  ── classifies topic, selects relevant agents, pulls context budget
   ▼
[Retrieval]  ── KG neighborhood + recent news (refs) + time-series facts → grounded "evidence pack"
   ▼
[Round 1: Independent Theses]  ── each selected agent emits a structured thesis (parallel)
   ▼
[Round 2: Cross-Examination]  ── each agent sees others' theses, issues rebuttals/agreements (parallel)
   ▼
[ATLAS Risk Pass]  ── ATLAS always gets a dedicated counter-thesis / risk veto-flag
   ▼
[Moderator/Editor]  ── NOT a 7th opinion. Synthesizes: points of agreement, live disagreements,
   │                    the strongest bull & bear case, residual uncertainty
   ▼
[Prediction Extractor]  ── pulls falsifiable predictions → writes to agent_predictions (Ledger)
   ▼
[Framing/Compliance Layer]  ── wraps as thesis-not-advice, attaches calibration, disclaimers
   ▼
[Brief]  ── cached, served to all users on that asset/theme
```

## B.3 Agent contract (structured output)

Every agent, every round, returns the *same* schema — this is what makes it gradeable and auditable:

```json
{
  "agent": "ORACLE",
  "stance": "bullish | bearish | neutral",
  "thesis": "1-3 sentence claim",
  "confidence": 0.0,            // calibrated probability, not vibes
  "horizon_days": 5,
  "catalyst": "what would prove/disprove this",
  "evidence": [                  // MUST cite retrieved refs; no uncited facts
    {"type":"price|news|macro|kg", "ref":"<id/url>", "claim":"..."}
  ],
  "key_risk": "the thing that breaks this thesis",
  "rebuttal_of": ["ATLAS"]       // round 2 only
}
```

**Hard rules enforced by the orchestrator (reject + retry on violation):**
- No factual/numeric claim without a matching `evidence.ref` from the data layer.
- `confidence` must be accompanied at display time by the agent's historical hit-rate at that confidence band ("ORACLE at ~70% confidence has been right 64% of the time").
- Every thesis must include `key_risk` and `catalyst` (forces falsifiability).

## B.4 Manufacturing genuine disagreement

Agents disagree because they're *built* to weight different evidence, not because of a "be contrarian" instruction (which produces fake conflict):

- **SAGE** weights macro regime + rates + valuation over price action; long horizon.
- **ORACLE** weights price/volume/momentum/flows; short horizon; explicitly probabilistic.
- **ATLAS** is structurally the skeptic: its mandate is to find the strongest *counter*-thesis and flag concentration/volatility/correlation risk. ATLAS gets a permanent seat and a "risk flag" that surfaces even when others agree.
- **SENTINEL/SCOUT** inject exogenous shocks (geopolitics, breaking news) the price-based agents underweight.

When they *do* converge, that's signal too ("rare full-Council agreement"). The Moderator surfaces convergence vs. divergence explicitly — both are interesting.

## B.5 The Moderator (anti-pattern avoidance)

The Moderator does **not** vote or add a 7th opinion (that would collapse the value back into a single oracle). It only: (1) clusters agreements, (2) sharpens the live disagreements into a "here's what they're fighting about," (3) states the strongest bull and bear case verbatim from the agents, (4) names the residual uncertainty. The *user* — or ALCHEMIST, for portfolio context — draws conclusions. This keeps the product educational (you watch experts reason) rather than advisory (a machine tells you the answer).

## B.6 Grading loop (closes to the Ledger)

- Each `agent_prediction` has `horizon_days` + `catalyst`. A scheduled job resolves it at expiry against `market_data`.
- Outcome → `prediction_outcomes` (hit/miss + Brier score against the stated probability).
- Rolling aggregation → `agent_calibration` (hit-rate, Brier, sliced by asset class and horizon).
- **Calibration, not just accuracy, is the headline metric:** "when SAGE says 70%, does it happen ~70% of the time?" A well-calibrated agent that's right 55% of the time is more trustworthy than an overconfident one that's right 60%. This is the honesty that becomes the brand.

## B.7 Cost & latency

- **Debates are shared.** One BTC debate serves every user watching BTC today → compute on a cadence (e.g., on material news + scheduled refresh), cache the brief, personalize only framing.
- **Model tiering:** Haiku for routing/classification/retrieval-grading; Opus for thesis generation + synthesis. Aggressive prompt caching on the static evidence pack.
- **Bounded rounds:** 2 debate rounds max in MVP. More rounds ≠ more insight, just more cost.

---

# C. The Tracer-Bullet Spec (smallest end-to-end slice)

> Goal: validate the *entire spine* — data → agent → debate → falsifiable prediction → auto-grade → calibration — on **one asset, minimal agents, no 3D, no fancy UI.** If this loop works and produces *honest, gradeable, interesting* output, the thesis is alive. If it doesn't, no amount of galaxy saves it. **This is what to build before anything else.**

## C.1 Scope (deliberately tiny)

- **One asset:** BTC (24/7 market, free/cheap data, fast horizons → you can grade calls in days, not wait for earnings).
- **Two agents:** ORACLE (momentum/price) + ATLAS (risk/counter-thesis). Enough to produce *disagreement* — the core thing to validate.
- **One debate cadence:** daily.
- **No 3D. No auth. Minimal UI** (a single page, or even a CLI/notebook that prints the brief + the ledger).
- **One horizon:** 3-day calls (so you accumulate ~10 graded outcomes in 30 days).

## C.2 The loop to prove

```
1. Ingest BTC price/volume (Timescale) + recent BTC news refs (one provider) daily.
2. Build a tiny evidence pack (last N days price stats + top news headlines/refs).
3. ORACLE emits a structured thesis (stance/confidence/horizon/catalyst/evidence).
4. ATLAS emits a counter-thesis + key risk, citing the same evidence pack.
5. Moderator synthesizes: agreement? disagreement? bull vs bear in their words.
6. Prediction extractor writes both agents' calls to agent_predictions.
7. A daily job resolves predictions whose 3-day horizon expired → prediction_outcomes (hit + Brier).
8. Aggregate → agent_calibration. Render the running scoreboard.
```

## C.3 Minimal data model (subset of strategy §16)

`prices(entity_id, ts, ohlcv)` · `news_items(ts, url, headline, ref)` · `agent_predictions(id, agent, stance, thesis, confidence, horizon_days, catalyst, evidence_refs, created_at)` · `prediction_outcomes(prediction_id, resolved_at, actual, hit, brier)` · `agent_calibration(agent, n, hit_rate, brier)`.

## C.4 Tech (smallest viable, consistent with §12)

- Python + FastAPI (or even a script + cron to start) for the agent/grading loop.
- Postgres + Timescale for prices, plain tables for the rest. (pgvector/KG/3D all deferred.)
- Claude: Opus for thesis+synthesis, Haiku for any classification. Provider abstraction from day 1.
- One market-data source (free crypto API) + one news source (refs only).
- LLM observability (Langfuse/Helicone) wired in *from the first call* — you'll want token cost + output audit immediately.

## C.5 Success criteria (decide go/no-go on these, not on vibes)

After ~3–4 weeks of daily runs:

1. **Groundedness:** do agents cite real evidence and avoid hallucinated numbers? (Audit the logs.)
2. **Genuine disagreement:** do ORACLE and ATLAS actually diverge in a useful, readable way — or is it mush?
3. **Falsifiability + grading works:** are predictions auto-resolving correctly against price?
4. **Calibration is meaningful:** is the scoreboard producing an honest, interpretable accuracy signal?
5. **Is the brief *interesting*?** Would *you* read it daily? (The hardest, most important test.)
6. **Unit economics sane:** cost per debate within budget at the shared-compute model?

If 4 of 6 are yes → build MVP (add SAGE, equities, one hero 3D view, the You-vs-Council game, auth). If groundedness or "interesting" fail → the concept needs rework *before* spending on the galaxy.

## C.6 Explicitly NOT in the tracer bullet

3D anything · multiple asset classes · 6 agents · user accounts · the €100 game · payments · mobile · the knowledge graph. All deferred until the spine is proven. **Resist the urge to build the beautiful part first.**

---

## Recommended next step

Pick one to expand into an actionable spec:
- the **tracer-bullet** as a concrete week-1 task breakdown (still design, not code, until you greenlight);
- the **agent persona/prompt designs** (system prompts + evidence rules for ORACLE/ATLAS/SAGE);
- the **compliance disclaimer + framing copy** set, ready for the lawyer review.
