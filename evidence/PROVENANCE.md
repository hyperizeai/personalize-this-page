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
