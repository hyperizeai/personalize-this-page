/*
 * End to end over Chrome's NATIVE WebMCP API (getTools / executeTool):
 * exactly the path a judge walks in Chrome 149+ with
 * chrome://flags/#enable-webmcp-testing set to Enabled.
 *
 *   node tests/native-chrome-run.mjs                     against the live site
 *   node tests/native-chrome-run.mjs --demo              against demo/index.html
 *   node tests/native-chrome-run.mjs <url>               against any deployment
 *
 * CHROME_PATH overrides the browser binary. Exit code 0 means every
 * assertion held; 1 means at least one failed and the table says which.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME_PATH = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIVE_URL = "https://www.hyperize.ai/en";

const arg = process.argv[2] || LIVE_URL;
const isDemo = arg === "--demo";

/* Tiny static server so `npm run test:demo` needs no extra dependency. */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    try {
      const raw = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const rel = normalize(raw).replace(/^([/\\])+/, "");
      if (rel.split(sep).includes("..")) { res.writeHead(403).end("forbidden"); return; }
      const target = raw.endsWith("/") ? join(root, rel, "index.html") : join(root, rel);
      const body = await readFile(target);
      res.writeHead(200, { "content-type": MIME[extname(target)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

let staticServer = null;
let url = arg;
if (isDemo) {
  staticServer = await startStaticServer(REPO_ROOT);
  url = `http://127.0.0.1:${staticServer.port}/demo/`;
}

const expectedToolCount = isDemo ? 6 : 10;

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  args: ["--enable-features=WebMCPTesting"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

let out;
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  out = await page.evaluate(async () => {
    const mc = document.modelContext ?? navigator.modelContext;
    if (!mc) throw new Error("No document.modelContext. Is --enable-features=WebMCPTesting set?");
    const o = {};

    const tools = await mc.getTools();
    o.toolCount = tools.length;
    o.toolNames = tools.map((t) => t.name).sort();
    const find = (n) => tools.find((t) => t.name === n);

    /* The H1 before anything is written. Reset has to bring this wording
       back unchanged. */
    o.h1Before = document.querySelector("h1")?.textContent ?? null;

    /* 1. Writing contract, read-only tool. */
    const capsRet = await mc.executeTool(
      find("get_adaptation_capabilities"),
      JSON.stringify({ detail: "express" }),
    );
    o.capsReturnType = typeof capsRet;
    const capsText = typeof capsRet === "string"
      ? capsRet
      : capsRet?.content?.[0]?.text ?? JSON.stringify(capsRet);
    const contract = JSON.parse(capsText);
    o.capsSections = Array.isArray(contract.sections) ? contract.sections.length : -1;

    /* 2. Start: instant brand mint from the profile. */
    const startRet = await mc.executeTool(find("start_personalization"), JSON.stringify({
      profile: {
        organization: "Native Judge Probe",
        mission: "Verify the native Chrome WebMCP path end to end",
      },
    }));
    o.startReturnType = typeof startRet;
    await new Promise((r) => setTimeout(r, 700));
    o.mintVisible = [...document.querySelectorAll("h2")]
      .some((h) => h.textContent.includes("Native Judge Probe"));

    /* 3. write_all echoing every original: a valid submission by contract,
          so the expected rejection count is exactly 0. */
    const sections = {};
    for (const s of contract.sections) {
      sections[s.section_id] = {};
      for (const f of s.fields) sections[s.section_id][f.field_id] = f.original;
    }
    o.fieldsSubmitted = Object.values(sections).reduce((n, s) => n + Object.keys(s).length, 0);
    const writeRet = await mc.executeTool(find("write_all"), JSON.stringify({ sections }));
    o.writeReturnType = typeof writeRet;
    const written = JSON.parse(typeof writeRet === "string"
      ? writeRet
      : writeRet?.content?.[0]?.text ?? "{}");
    o.writeRejected = (written.written ?? []).reduce((n, s) => n + s.rejected.length, 0);

    /* The page stages the reveal itself, roughly 380ms per section. */
    await new Promise((r) => setTimeout(r, 3400));
    o.banner = document.querySelector(".p2m-banner")?.textContent?.trim() ?? "";

    /* 4. One of the site's own tools, present on the live page only. */
    const scoreTool = find("get_brand_agent_success_score");
    o.siteToolPresent = Boolean(scoreTool);
    if (scoreTool) {
      const scoreRet = await mc.executeTool(scoreTool, JSON.stringify({ brand: "Allianz" }));
      o.siteToolReturnType = typeof scoreRet;
    }

    /* 5. Reset: every field back to its original text. */
    const resetRet = await mc.executeTool(find("reset_experience"), "{}");
    o.resetReturnType = typeof resetRet;
    await new Promise((r) => setTimeout(r, 600));
    o.h1After = document.querySelector("h1")?.textContent ?? null;
    return o;
  });
} finally {
  await browser.close();
  if (staticServer) staticServer.server.close();
}

/* ── Assertions ───────────────────────────────────────────────────────── */

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

check(
  `native tool count is ${expectedToolCount}`,
  out.toolCount === expectedToolCount,
  `got ${out.toolCount}: ${out.toolNames.join(", ")}`,
);
check(
  isDemo ? "site tools absent on the demo" : "site tools present on live",
  out.siteToolPresent === !isDemo,
  `get_brand_agent_success_score ${out.siteToolPresent ? "present" : "absent"}`,
);

const returnTypes = [
  ["get_adaptation_capabilities", out.capsReturnType],
  ["start_personalization", out.startReturnType],
  ["write_all", out.writeReturnType],
  ["reset_experience", out.resetReturnType],
  ...(out.siteToolPresent ? [["get_brand_agent_success_score", out.siteToolReturnType]] : []),
];
const nonString = returnTypes.filter(([, t]) => t !== "string");
check(
  "every executeTool return is a string",
  nonString.length === 0,
  nonString.length ? nonString.map(([n, t]) => `${n} returned ${t}`).join("; ") : `${returnTypes.length} calls`,
);

check(
  "capabilities parse into sections",
  out.capsSections > 0,
  `${out.capsSections} sections in the express contract`,
);
check(
  "brand mint visible after start_personalization",
  out.mintVisible,
  'an h2 carries "Native Judge Probe"',
);
check(
  "write_all rejects 0 fields when echoing the originals",
  out.writeRejected === 0,
  `${out.writeRejected} rejected of ${out.fieldsSubmitted} submitted`,
);
check(
  'banner reads "Adapted to ..."',
  out.banner.startsWith("Adapted to"),
  JSON.stringify(out.banner.slice(0, 70)),
);
/* Rendered text, not raw node data: the page restores every field to its
   original wording, but insignificant whitespace inside the source markup
   (a trailing newline after the last text node) is normalised on the way
   back. What a reader sees has to match exactly. */
const rendered = (s) => (s === null ? null : String(s).replace(/\s+/g, " ").trim());
check(
  "reset restores the H1 exactly as it reads",
  out.h1After !== null && rendered(out.h1After) === rendered(out.h1Before),
  rendered(out.h1After) === rendered(out.h1Before)
    ? JSON.stringify(rendered(out.h1After).slice(0, 60))
    : `before ${JSON.stringify(out.h1Before)} vs after ${JSON.stringify(out.h1After)}`,
);
check(
  "no uncaught page errors",
  pageErrors.length === 0,
  pageErrors.length ? pageErrors.join(" | ") : "none",
);

/* ── Report ───────────────────────────────────────────────────────────── */

const width = Math.max(...checks.map((c) => c.name.length));
console.log(`\nnative WebMCP run: ${url}`);
console.log(`chrome: ${CHROME_PATH}\n`);
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(width)}  ${c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
process.exit(failed.length ? 1 : 0);
