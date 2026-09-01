// End-zu-End über Chromes NATIVE WebMCP-API (getTools/executeTool) — exakt
// der Pfad, den die Challenge-Judges in Chrome 149+ mit Flag benutzen.
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:4321/en";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-features=WebMCPTesting"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 150)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const result = await page.evaluate(async () => {
  const mc = document.modelContext;
  const out = {};
  const tools = await mc.getTools();
  out.nativeToolCount = tools.length;
  out.nativeToolNames = tools.map((t) => t.name).sort();
  const find = (n) => tools.find((t) => t.name === n);

  // 1. String-Return-Beweis (read-only Tool)
  const capsRet = await mc.executeTool(find("get_adaptation_capabilities"), JSON.stringify({ detail: "express" }));
  out.capsReturnType = typeof capsRet;
  let capsText = capsRet;
  if (typeof capsRet !== "string") capsText = capsRet?.content?.[0]?.text ?? JSON.stringify(capsRet);
  const bp = JSON.parse(capsText);
  out.capsParsable = Array.isArray(bp.sections);

  // 2. Kompletter Lauf nativ
  const startRet = await mc.executeTool(find("start_personalization"), JSON.stringify({
    profile: { organization: "Native Judge Probe", mission: "Verify the native Chrome WebMCP path end to end" },
  }));
  out.startReturnType = typeof startRet;
  await new Promise((r) => setTimeout(r, 700));
  out.mintVisible = [...document.querySelectorAll("h2")].some((h) => h.textContent.includes("Native Judge Probe"));

  const sections = {};
  for (const s of bp.sections) { sections[s.section_id] = {}; for (const f of s.fields) sections[s.section_id][f.field_id] = f.original; }
  const writeRet = await mc.executeTool(find("write_all"), JSON.stringify({ sections }));
  out.writeReturnType = typeof writeRet;
  const writeParsed = JSON.parse(typeof writeRet === "string" ? writeRet : writeRet?.content?.[0]?.text ?? "{}");
  out.writeRejected = (writeParsed.written ?? []).reduce((n, s) => n + s.rejected.length, 0);
  await new Promise((r) => setTimeout(r, 3400));
  out.banner = document.querySelector(".p2m-banner")?.textContent?.trim();

  // 3. Site-Tool nativ (String-Return auch dort; fehlt auf der Standalone-Demo)
  const scoreTool = find("get_brand_agent_success_score");
  if (scoreTool) {
    const scoreRet = await mc.executeTool(scoreTool, JSON.stringify({ brand: "Allianz" }));
    out.siteToolReturnType = typeof scoreRet;
  } else {
    out.siteToolReturnType = "absent (demo page)";
  }

  // 4. Reset nativ
  await mc.executeTool(find("reset_experience"), "{}");
  await new Promise((r) => setTimeout(r, 500));
  out.resetH1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
  return out;
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
