# Personalize this page

**Your agent rewrites the page for you. Live on a real company website.**

Every website speaks to an average visitor. But the visitor arriving with an
AI agent is not average: the agent knows who they are, what they run, and what
they came to solve. This project inverts the usual WebMCP pattern. Instead of
the agent using page tools to operate the site, the page hands the agent a
**writing contract**, and the agent rewrites the site's own copy for its
human, live, inside hard guardrails the page enforces.

- **Live URL:** https://www.hyperize.ai/en (production, not a contest sandbox)
- **Demo video:** [YouTube link]
- **Machine-readable surface docs:** https://www.hyperize.ai/en/agents

## Try it in 60 seconds

**ChatGPT in-app browser** (native WebMCP) or **Chrome 149+** with
`chrome://flags/#enable-webmcp-testing` set to Enabled:

1. Open https://www.hyperize.ai/en
2. Tell your agent:

> Personalize this page for me using its WebMCP tools: call
> start_personalization with what you know about me and my company, then
> submit all texts in one write_all call. No web research needed. Page tools
> only; do not modify any files.

3. Watch the page: the brand headlines re-mint in under a second, then every
   section resolves through a staged skeleton reveal. The banner reads
   "Adapted to <your company>". Click it for a word-for-word receipt of what
   changed and which context was used. **Reset** restores the original,
   character for character.

No agent in your browser? The "Personalize" button on the page shows the
exact request to copy, plus one-click handoffs to ChatGPT, Claude and
Perplexity.

## Why this use case belongs to WebMCP

Personalization used to mean surveillance: cookies, trackers, profiles built
server-side. WebMCP flips the direction of knowledge. The agent already
holds the visitor's context, with their consent, on their side. The page
never needs to know who you are; it only needs to publish **what may be
rewritten and by which rules**. That contract is exactly what WebMCP tools
express: typed, discoverable, permission-gated capabilities on the page
itself. No backend, no account, no data leaving the browser.

## What the human and the agent accomplish together

The human brings intent ("I run a family campsite in the Allgäu; we need
off-season bookings"). The agent brings that context to the page. The page
brings truth: real product facts, real prices, real constraints, and refuses
anything invented. The result is a third thing none of them could produce
alone: the company's actual website, arguing its actual case, in the
visitor's own terms, and every claim still grounded in what the site really
says. The receipt and the one-click reset keep the human in charge of the
collaboration at all times.

## How it improves the experience

- A B2B homepage answers a campsite owner's real questions ("Does this
  replace our website relaunch?") instead of generic vendor FAQs.
- The conversion form arrives prefilled from the profile the agent already
  holds; the visitor only clicks.
- Speed is engineered: three headline mints render in under a second (page
  transforms deterministically from the profile), then a single `write_all`
  call carries all 29 express fields and the page stages the reveal itself
  (~380ms per section). Page-side cost of a full personalization: under 6
  seconds.

## Implementation

One self-contained ES module ([`src/pitch-to-me.mjs`](src/pitch-to-me.mjs),
no dependencies, injects its own CSS) served from the production site behind
a build flag. Six personalization tools join the site's four existing tools
into one 10-tool surface.

| Tool | Kind | What it does |
|------|------|--------------|
| `get_adaptation_capabilities` | read-only | The writing contract: per-field job description, original text, hard length budgets, style rules, stable product facts. `detail: "express"` (29 highest-impact fields, default) or `"full"` (50). |
| `start_personalization` | write | Accepts the visitor profile (validated schema), instantly mints the brand headlines, prefills the form, arms the progress banner. |
| `write_all` | write | All texts in ONE call; the page validates every field and stages a section-by-section skeleton reveal. |
| `write_section` | write | Section-wise path for incremental runs. |
| `show_decision_brief` | read/UI | A structured decision brief (Markdown + download + mail draft) generated from profile + what was written. |
| `reset_experience` | write | Character-exact restoration of every field, banner and form. |

### Field contracts, not free rein

Every writable field carries a job description, its original text, and a
hard budget derived from the original (`ceil(words × 1.3) + 2` words,
`ceil(chars × 1.35) + 12` characters). The page validates every submission:
over budget, markup, em-dashes, invented facts territory (style rules pin
product claims to the published `productFacts`). Layout can never break
because the budget protects it. In four independent third-party agent runs
(Claude in Chrome, Perplexity Comet Computer mode, two scripted Claude
verification agents), 0 of 150+ submitted fields broke layout; rejections
return actionable errors the agent can fix.

### Security posture (why this is injection-resistant by design)

- The agent can only write **text into whitelisted fields with budgets**;
  no HTML, no attributes, no selectors, no navigation, everything lands via
  `textContent`.
- Consequential actions stay confirmed: the one form-submitting site tool
  reuses the human form path and expects explicit user confirmation.
- Everything is client-side and per-visitor; a reload restores the original
  page. Crawlers and no-JS visitors always see the canonical page (the
  flag's entire HTML footprint is one `<script>` tag).
- Telemetry counts tool NAMES only; profiles and texts never leave the
  browser.
- Read-only tools are annotated `readOnlyHint: true` per the WebMCP draft.

### Native + script clients, one surface

Registered on `document.modelContext ?? navigator.modelContext` with a
knock-forever loop (panel clients inject the context late), identity guards
(WeakSet, max 3 context generations), and never-abort semantics (some
clients treat abort as deregistration). Native clients (Chrome's prototype,
ChatGPT browser) receive string-returning wrappers per Chrome's imperative
API; script-driven clients read the same tools from the inspectable
`window.__hzWebMcpTools` array with raw object + MCP `content` shapes.

Verified end to end over Chrome's NATIVE API (real Chrome 152, isolated
profile, `--enable-features=WebMCPTesting`): `getTools()` lists all 10,
`executeTool` returns strings, full run + exact reset, 0 rejections. See
[`tests/native-chrome-run.mjs`](tests/native-chrome-run.mjs).

## Repository layout

```
src/pitch-to-me.mjs      the personalization layer (the submission)
src/WebMcp.astro         the site's four pre-existing site tools (context)
demo/index.html          standalone demo page (serve over HTTP, see below)
tests/native-chrome-run.mjs  end-to-end over Chrome's native WebMCP API
evidence/PROVENANCE.md   dated prior-work vs. new-work record (rules req.)
```

### Run the standalone demo

```bash
python3 -m http.server 8080
# then open http://localhost:8080/demo/ in a WebMCP-enabled browser
node tests/native-chrome-run.mjs http://localhost:8080/demo/
```

## Team

Hyperize (a MING Labs GmbH venture), Munich. The production site this runs
on is the company's real homepage; the layer shipped to production on
2026-09-01 during the submission window. Prior-work boundary and dated PR
evidence: [`evidence/PROVENANCE.md`](evidence/PROVENANCE.md).
