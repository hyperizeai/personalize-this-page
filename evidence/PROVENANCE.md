# Provenance: prior work vs. new work

Per the WebMCP Challenge rules, existing projects qualify when they are
"meaningfully extended using WebMCP after the Submission Period start date"
(2026-08-25) with dated evidence.

## Prior work (before 2026-08-25)

- The host website www.hyperize.ai (Astro static site, live since June 2026).
- Four site-wide WebMCP read/act tools (score lookup, insights search,
  readiness probe, snapshot request) registered on `document.modelContext`,
  shipped mid-August 2026. Included here as `src/WebMcp.astro` for context.

## New work (2026-08-25 → 2026-09-01, the submission)

The entire personalization layer (`src/pitch-to-me.mjs`, ~1,800 lines) was
designed, built, shipped to production and hardened INSIDE the submission
window. Production repo (`mingdeveloper/hyperize-website`, private) pull
requests, all merged by squash with dated commits:

| PR | Merged | Squash SHA | What landed |
|----|--------|-----------|-------------|
| #158 | 2026-08-31 | `d99b62b` | The layer: 50 field contracts across 10 sections, 6 personalization tools, skeleton shimmer choreography, transformation receipt, exact reset, feature-flag architecture (byte-identical page without the flag) |
| #163 | 2026-08-31 | `4c7d012` | llms.txt consistency fixes surfaced by a real agent run |
| #164 | 2026-08-31 | `705e324` | Express package: one-call `write_all` with staged reveal, instant brand mints (<1s), full FAQ in the express contract, clipboard fallback |
| #165 | 2026-09-01 | `a9cc9d6` | Production enable on www.hyperize.ai, 10-tool documentation on /en/agents + llms.txt, tool-name-only telemetry, skeleton preview guard |
| #166 | 2026-09-01 | `41641fc` | Native-client hardening: string returns for Chrome's WebMCP prototype and the ChatGPT in-app browser, `readOnlyHint` annotations, validator echo guard |

Third-party verification during the window: Perplexity Comet (Computer mode)
discovered the tools on its own and rewrote all sections on 2026-08-31;
independent Claude agent runs completed 44/44 and 45/45 field passes with
zero budget rejections.

The production repository is private (it carries unrelated commercial
content). This public repository contains the complete source of the
submitted layer; the table above is the dated commit evidence. Access to
the private history can be granted to judges on request.

## 2026-09-03/04: implementation assessment and repo corrections

An internal implementation assessment
(`website-build/docs/webmcp-implementation-assessment-2026-09-03.md`, private)
re-checked the shipped layer on both client paths: over Chrome's native
WebMCP API in real Chrome 152 with the testing flag, and as a script agent
with an injected `document.modelContext`. Both paths ran start, write, brief
and reset end to end, with 29 of 29 express fields accepted and a clean reset.

The same assessment found two honesty gaps between the code and the words
around it, and both were corrected in the README with this commit: the page
enforces plain text, per-field word and character budgets and the em-dash ban,
but it does not verify the fact rules (no invented customers, numbers, prices
or guarantees), which are part of the writing contract handed to the agent;
and every tool call sends the tool name, and only the name, to a public usage
counter, so "nothing leaves the browser" now reads as the narrower claim it
is: no profile and no written text leaves the browser. The receipt claim was
narrowed the same way (it quotes the context used word for word and counts
rewritten fields per section, it does not diff text per field), as was the
`request_snapshot` confirmation claim (the tool description asks the agent to
confirm URL and email with the user; the page cannot check that it happened).

Repo changes in this commit: real demo video and Devpost links at the top of
the README; `demo/index.html` publishes the six design tokens the module reads
as HSL triplets, adds the header and hero entry points the module hooks into,
and styles the injected nav button, so the receipt dialog, banner and skeleton
shimmer render on the standalone page; `tests/native-chrome-run.mjs` became a
real test with named assertions, a PASS/FAIL table and a non-zero exit on
failure, driven by a `package.json` (`npm test` against the live site,
`npm run test:demo` against the demo on a local static server).

### Machine-readable commit trace

The PR numbers in the table above point to a private repository, so
[`git-log-hyperize-website.txt`](git-log-hyperize-website.txt) is the checkable
trace: the verbatim output of

```
git log origin/main --date=iso --format='%h %ad %s' -- \
  public/p2m/pitch-to-me.mjs src/components/WebMcp.astro \
  netlify.toml src/pages/en/agents.astro
```

in `mingdeveloper/hyperize-website`, showing every commit that touched the
submitted layer, the pre-existing site tools, the deploy config and the agent
documentation page, with dates on both sides of the 2026-08-25 boundary.
