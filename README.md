# Personalize this page

**Your agent rewrites the page for you. Live on a real company website.**

Every website speaks to an average visitor. But the visitor arriving with an
AI agent is not average: the agent knows who they are, what they run, and what
they came to solve. This project inverts the usual WebMCP pattern. Instead of
the agent using page tools to operate the site, the page hands the agent a
**writing contract**, and the agent rewrites the site's own copy for its
human, live, inside guardrails the page enforces.

- **Live URL:** https://www.hyperize.ai/en (production, not a contest sandbox)
- **Demo video:** https://youtu.be/bgSNNJMuna8 ("Every website becomes your
  website. Your AI agent rewrites it, live (WebMCP)")
- **Devpost:** https://devpost.com/software/personalize-this-page
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
   "Adapted to <your company>". Click it for the receipt: the context your
   agent used, quoted word for word, and how many fields it rewrote in each
   section. **Reset** puts every original text back.

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
itself. No backend, no account, and no profile or written text ever leaves
the browser.

## What the human and the agent accomplish together

The human brings intent ("I run sales at an industrial pump maker; engineers
and procurement agents should shortlist us"). The agent brings that context to
the page. The page brings its own material: the original text of every field,
the job that field does, a hard length budget, and the published product facts
the agent is told to argue from. The result is a third thing none of them could
produce alone: the company's actual website, arguing its actual case, in the
visitor's own terms. The receipt and the one-click reset keep the human in
charge of the collaboration at all times.

## How it improves the experience

- A generic homepage answers a pump maker's real questions ("What happens to
  our configurator and catalog?") instead of generic vendor FAQs, and argues
  in a shopper's terms for an outdoor apparel brand the next minute.
- The conversion form arrives prefilled from the profile the agent already
  holds; the visitor only clicks.
- Speed is engineered on the page's side. The brand headlines mint
  deterministically from the profile, with no round trip, and a single
  `write_all` call carries all 29 express fields. The page then stages the
  reveal itself at 380ms per section (a constant in the module), so seven
  sections resolve in under three seconds. How long the agent needs to write
  is the agent's business; the page adds no waiting of its own.

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
| `reset_experience` | write | Puts every field, the banner and the form back to their original text. |

### Field contracts, not free rein

Every writable field carries a job description, its original text, and a
hard budget derived from the original (`ceil(words × 1.3) + 2` words,
`ceil(chars × 1.35) + 12` characters). On submit the page enforces four rules
and returns an actionable error for each violation: no empty text, no angle
brackets (plain text only, so nothing can land as markup), no em dashes, and
nothing over budget. The budget is what protects the layout, so layout cannot
break.

The fact rules are contract, not enforcement. The style rules handed to the
agent say: never invent customers, numbers, prices or guarantees, and pin
product claims to the published `productFacts`. The page does not verify them.
An agent that ignores the contract can put an invented sentence in front of the
visitor who asked for it, client-side, for that one visitor, until reset.
Checking claims against the published facts in code is the next piece of work,
not something we claim today.

What is verified: [`tests/native-chrome-run.mjs`](tests/native-chrome-run.mjs)
submits all 29 express fields on the live page in one `write_all` call over
Chrome's native API and asserts 0 rejections. Run it yourself with `npm test`.
The third-party agent runs from the submission window are logged in
[`evidence/PROVENANCE.md`](evidence/PROVENANCE.md).

### Security posture (why this is injection-resistant by design)

- The agent can only write **text into whitelisted fields with budgets**;
  no HTML, no attributes, no selectors, no navigation, everything lands via
  `textContent`.
- The one form-submitting site tool (`request_snapshot`) reuses the human form
  path, and its tool description instructs the agent to confirm the website URL
  and the email address with the user before calling it. That is an instruction
  to the agent, not a gate: the page cannot verify that the confirmation
  happened.
- Everything is client-side and per-visitor; a reload restores the original
  page. Crawlers and no-JS visitors always see the canonical page (the
  flag's entire HTML footprint is one `<script>` tag).
- Each tool call sends the tool name, and only the name, to a public usage
  counter (`POST /.netlify/functions/webmcp-telemetry`). Profiles, prompts and
  written text never leave the browser.
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
profile, `--enable-features=WebMCPTesting`): `getTools()` lists all 10, every
`executeTool` returns a string, a full run passes 29 of 29 fields with 0
rejections, and reset restores the page. That is not a screenshot, it is the
test suite: [`tests/native-chrome-run.mjs`](tests/native-chrome-run.mjs).

## Repository layout

```
src/pitch-to-me.mjs          the personalization layer (the submission)
src/WebMcp.astro             the site's four pre-existing site tools (context)
demo/index.html              standalone demo page (serve over HTTP, see below)
tests/native-chrome-run.mjs  end-to-end over Chrome's native WebMCP API
package.json                 npm test (live) and npm run test:demo
evidence/PROVENANCE.md       dated prior-work vs. new-work record (rules req.)
evidence/git-log-hyperize-website.txt   commit trace from the private site repo
```

### Run the tests

```bash
npm install
npm test           # real Chrome, native WebMCP API, against www.hyperize.ai/en
npm run test:demo  # the same run against demo/index.html, served locally
```

Both runs launch Chrome with `--enable-features=WebMCPTesting` themselves.
`CHROME_PATH` overrides the binary; the default is the macOS Chrome path.

### Run the standalone demo

```bash
python3 -m http.server 8080
# then open http://localhost:8080/demo/ in a WebMCP-enabled browser
node tests/native-chrome-run.mjs http://localhost:8080/demo/
```

The demo is a reduced page. It exposes the six personalization tools over fewer
fields than the live homepage (15 express fields instead of 29) and none of the
site's four other tools, so `get_brand_agent_success_score` and its siblings are
absent there. Off site, the usage-counter POST has nowhere to land and fails
silently; nothing else about the run changes.

## Team

Hyperize (a MING Labs GmbH venture), Munich. The production site this runs
on is the company's real homepage; the layer shipped to production on
2026-09-01 during the submission window. Prior-work boundary and dated PR
evidence: [`evidence/PROVENANCE.md`](evidence/PROVENANCE.md).
