/**
 * Pitch it to me: WebMCP personalization layer for the hyperize.ai EN homepage.
 *
 * Slice 2 (Marc, 2026-08-30): the visitor's agent WRITES the page. The layout,
 * section order, proof points, prices, logos, seals and quotes never change.
 * What changes is the text inside the explaining sections, rewritten by the
 * visitor's own agent inside per-field contracts:
 *
 *  - Every personalizable field carries a job (what the text must do), the
 *    original text as material, and a hard length budget derived from the
 *    original (~original +25%), so the layout never breaks and the page
 *    never bloats. Oversized or em-dash text is rejected with the budget.
 *  - The agent discovers the tools on its own (WebMCP), starts a session
 *    with the visitor's context, then writes section by section. The page
 *    transforms live, headline fields decode (terminal morph), prose
 *    crossfades, and the banner counts progress.
 *  - Facts stay facts: product claims quoted from this page, client logos,
 *    DAX 40 numbers, prices, the BSFZ seal and real testimonials are not
 *    writable. Personalized text is labeled as written by the agent.
 *  - Context stays in this browser: no URL params, no server calls. The
 *    snapshot form gets prefilled, never submitted.
 *  - Whole init in try/catch: if anything throws, today's homepage stays.
 */

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* ── Context contract ─────────────────────────────────────────────────── */

const LIMITS = Object.freeze({
  organization: 80,
  industry: 100,
  visitor_role: 80,
  decision_maker: 80,
  mission: 220,
  mission_short: 48,
  deadline: 100,
  situation: 220,
  company_profile: 260,
  why_now: 260,
  website_url: 140,
  work_email: 140,
  listItems: 6,
  listItem: 120,
});

const TEXT_FIELDS = Object.freeze([
  "organization",
  "industry",
  "visitor_role",
  "decision_maker",
  "mission",
  "mission_short",
  "deadline",
  "situation",
  "company_profile",
  "why_now",
  "website_url",
  "work_email",
]);
const LIST_FIELDS = Object.freeze([
  "priorities",
  "constraints",
  "current_stack",
  "success_metrics",
  "pain_points",
]);

const PROFILE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    organization: { type: "string", maxLength: LIMITS.organization, description: "The visitor's organization, only when the user approved sharing it." },
    industry: { type: "string", maxLength: LIMITS.industry },
    visitor_role: { type: "string", maxLength: LIMITS.visitor_role },
    decision_maker: { type: "string", maxLength: LIMITS.decision_maker, description: "The person whose decision criteria the visitor needs to satisfy." },
    mission: { type: "string", minLength: 5, maxLength: LIMITS.mission, description: "The concrete job the visitor was asked to solve." },
    mission_short: { type: "string", maxLength: LIMITS.mission_short, description: "A three-to-five word handle for the mission." },
    priorities: { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.listItem } },
    constraints: { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.listItem } },
    current_stack: { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.listItem } },
    success_metrics: { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.listItem } },
    deadline: { type: "string", maxLength: LIMITS.deadline },
    situation: { type: "string", maxLength: LIMITS.situation, description: "How the work runs today, in the visitor's own words." },
    pain_points: { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.listItem }, description: "What hurts about the current setup, in the visitor's own words." },
    company_profile: { type: "string", maxLength: LIMITS.company_profile, description: "One or two sentences on what the visitor's company is and does. Rendered as visitor context, never as a Hyperize claim." },
    why_now: { type: "string", maxLength: LIMITS.why_now, description: "Why this mission matters right now." },
    website_url: { type: "string", maxLength: LIMITS.website_url, description: "The visitor's company website. Used to prefill the free-snapshot form on this page; never submitted by the page." },
    work_email: { type: "string", maxLength: LIMITS.work_email, description: "The visitor's work email. Used to prefill the free-snapshot form on this page; never submitted by the page." },
  },
  required: ["mission"],
});

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}
function wordCount(text) {
  return cleanText(text) ? cleanText(text).split(" ").length : 0;
}
function truncate(value, length = 76) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function validateProfile(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["Profile must be an object."];
  const allowed = new Set([...TEXT_FIELDS, ...LIST_FIELDS]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors.push(`Unknown profile field: ${key}.`);
  }
  for (const field of TEXT_FIELDS) {
    if (input[field] != null && typeof input[field] !== "string") errors.push(`${field} must be text.`);
    if (cleanText(input[field]).length > LIMITS[field]) errors.push(`${field} is longer than ${LIMITS[field]} characters.`);
  }
  for (const field of LIST_FIELDS) {
    if (input[field] != null && !Array.isArray(input[field])) {
      errors.push(`${field} must be a list.`);
      continue;
    }
    const values = cleanList(input[field]);
    if (values.length > LIMITS.listItems) errors.push(`${field} may contain at most ${LIMITS.listItems} items.`);
    if (values.some((item) => item.length > LIMITS.listItem)) errors.push(`${field} contains an item longer than ${LIMITS.listItem} characters.`);
  }
  if (cleanText(input.mission).length < 5) errors.push("mission must contain at least 5 characters.");
  return errors;
}

function normalizeProfile(input) {
  const errors = validateProfile(input);
  if (errors.length) throw new Error(errors.slice(0, 4).join(" "));
  const normalized = {};
  for (const field of TEXT_FIELDS) normalized[field] = cleanText(input[field]);
  for (const field of LIST_FIELDS) normalized[field] = cleanList(input[field]);
  return normalized;
}

/* ── Product truth (verbatim from this page and site) ─────────────────── */

const PRODUCT_FACTS = Object.freeze({
  product: "Hyperize",
  whatItIs: "Agent Enablement Platform. Hyperize measures and fixes how AI agents find, trust, and transact with a brand.",
  system: "Two outcomes: AI visibility and AI usability. We measure where agents find you, engineer what they cite, and make tools they can call.",
  firstStep: "Free Agent Success Snapshot: one URL, two gates, one score, 48 hours. Free, no commitment, no sales call.",
  proof: "DAX 40 Agent Success Index: how well Germany's leading brands let AI agents succeed. https://www.hyperize.ai/en/dax40-index",
  timeline: "Typical: Evidence Pages indexed within 5–10 days. First agent citations within 2–3 weeks. Measurable Agent Success Score improvement by Day 30.",
  offers: "Free snapshot (48 hours). Agent success audit (€1,900). Founding program (€4,500).",
  company: "Hyperize is a MING Labs venture. Fifteen years of enterprise delivery, focused entirely on making brands usable by agents.",
  personalizationRule: "Rewrite the explaining text for the visitor inside each field budget. Never invent Hyperize customers, numbers, prices or guarantees; product claims only from these facts.",
});

const STYLE_RULES = Object.freeze([
  "Write in English, the page's language, whatever language the visitor speaks.",
  "Short sentences dominate. Contrast pairs land: 'One asks. One knows.'",
  "Name the visitor's company where it hits (headlines, the closer). Not in every sentence; twice per section is the ceiling.",
  "Every field carries one concrete detail the visitor will recognize (their market, their buyer, their tool). No generic praise.",
  "Stay inside each field's max_words and max_chars budget. The budgets protect the layout.",
  "No em dashes. No hedging (perhaps, might, could). No filler adverbs (really, very, actually).",
  "Never invent Hyperize customers, numbers, prices or guarantees. Product claims only from productFacts.",
  "Plain text only. No markdown, no HTML, no line breaks inside a field.",
]);

/* ── Field contracts: what the agent may write, where it lands ────────── */

/* Budgets are derived from each field's ORIGINAL text at capture time:
   max_words = ceil(original*1.3)+2, max_chars = ceil(original*1.35)+12.
   jobs tell the agent what the text must do; kind picks the animation. */

const SECTION_CONTRACTS = Object.freeze([
  {
    id: "hero",
    title: "Hero",
    purpose: "The first thing the visitor reads. Keep the sentence skeleton, make it theirs.",
    fields: [
      { id: "headline_verb", kind: "headline", special: "verb", job: "The last word(s) of 'Be the brand AI agents ___'. One or two words plus period, chosen for the visitor's mission (use. buy. cite. shortlist. recommend. book.)." },
      { id: "lede", kind: "prose", selector: "p", pick: 0, job: "Replace the generic promise with the visitor's reality: what agents do in THEIR market, and what Hyperize makes sure of for THEM." },
    ],
  },
  {
    id: "whatwedo",
    title: "A system, not a service",
    purpose: "Explains the three layers (be found, be recommended, do business). Rewrite each for the visitor's world.",
    fields: [
      { id: "subtitle", kind: "prose", selector: ".text-center p", pick: 0, job: "The two-outcome promise (AI visibility, AI usability), said for the visitor's business." },
      { id: "card1_title", kind: "headline", selector: "h3", pick: 0, job: "Layer 1 headline: being found, in the visitor's category. Two or three words, period." },
      { id: "card1_body", kind: "prose", selector: "h3", pick: 0, sibling: "p", job: "Where agents look in the visitor's market and what measured presence means for them." },
      { id: "card2_title", kind: "headline", selector: "h3", pick: 1, job: "Layer 2 headline: being recommended. Two or three words, period." },
      { id: "card2_body", kind: "prose", selector: "h3", pick: 1, sibling: "p", job: "What evidence agents need to shortlist the visitor's company, concretely." },
      { id: "card3_title", kind: "headline", selector: "h3", pick: 2, job: "Layer 3 headline: doing business. Two or three words, period." },
      { id: "card3_body", kind: "prose", selector: "h3", pick: 2, sibling: "p", job: "What an agent should be able to complete with the visitor's company (book, quote, order) instead of hitting a form." },
    ],
  },
  {
    id: "whatyouface",
    title: "The problem with legacy brand sites",
    purpose: "The visitor's actual gap. Name their pains here, in their words.",
    fields: [
      { id: "subtitle", kind: "prose", selector: ".text-center p", pick: 0, job: "The core problem, said for the visitor's site and audience." },
      { id: "gap1_title", kind: "headline", selector: "h3", pick: 0, job: "Pain 1 as one word or two." },
      { id: "gap1_body", kind: "prose", selector: "h3", pick: 0, sibling: "p", job: "Pain 1 made concrete for the visitor's company." },
      { id: "gap2_title", kind: "headline", selector: "h3", pick: 1, job: "Pain 2 as one word or two." },
      { id: "gap2_body", kind: "prose", selector: "h3", pick: 1, sibling: "p", job: "Pain 2 made concrete for the visitor's company." },
      { id: "gap3_title", kind: "headline", selector: "h3", pick: 2, job: "Pain 3 as one word or two." },
      { id: "gap3_body", kind: "prose", selector: "h3", pick: 2, sibling: "p", job: "Pain 3 made concrete for the visitor's company." },
    ],
  },
  {
    id: "architecture",
    title: "How agents read your brand",
    purpose: "The architecture diagram stays; frame its two prose lines for the visitor.",
    fields: [
      { id: "intro", kind: "prose", match: "One brand-owned surface.", job: "What the diagram means for the visitor's brand surface, one breath." },
      { id: "closing", kind: "prose", match: "The more you invest", job: "The compounding argument, addressed to the visitor." },
    ],
  },
  {
    id: "headless",
    title: "Rebuild your brand for agents",
    purpose: "The dark thesis section. The headline takes the visitor's name; the quotes and rails are real and stay.",
    fields: [
      { id: "headline", kind: "headline", selector: "h2", pick: 0, job: "Mint the imperative for the visitor, e.g. 'Rebuild <company> for agents.'" },
      { id: "argument", kind: "prose", selector: "p", pick: 0, job: "Why the interface shift hits the visitor's business next, in their category's terms." },
    ],
  },
  {
    id: "snapshot",
    title: "Free snapshot",
    purpose: "The conversion moment. Make the test personal; the form is prefilled from the profile, the visitor only clicks.",
    fields: [
      { id: "headline", kind: "headline", selector: "h2", pick: 0, job: "The visitor's brand, tested by agents. Use their name." },
      { id: "subtitle", kind: "prose", selector: ".text-center p", pick: 0, job: "The offer in one breath (one URL, two gates, one score, 48 hours), pointed at the visitor." },
      { id: "include1", kind: "textnode", selector: "ul li", pick: 0, job: "Deliverable line 1, for their market." },
      { id: "include2", kind: "textnode", selector: "ul li", pick: 1, job: "Deliverable line 2, for their market." },
      { id: "include3", kind: "textnode", selector: "ul li", pick: 2, job: "Deliverable line 3, for their market." },
      { id: "include4", kind: "textnode", selector: "ul li", pick: 3, job: "Deliverable line 4, benchmark framing." },
    ],
  },
  {
    id: "minglabs",
    title: "Who we are",
    purpose: "Numbers, seal and credentials are facts and stay. The one writable line says why Hyperize fits THIS visitor.",
    fields: [
      { id: "fit", kind: "prose", selector: ".text-center p", pick: 0, job: "Why Hyperize is a fit for the visitor's company specifically. Start from 'Hyperize is a MING Labs venture.' and land the fit argument." },
    ],
  },
  {
    id: "process",
    title: "What happens after you say yes",
    purpose: "Four steps stay four steps with their week labels. Rewrite what each step means for the visitor.",
    fields: [
      { id: "step1", kind: "prose", special: "process", pick: 0, job: "Week 1 for the visitor: their category mapped, their competitors in the fleet run." },
      { id: "step2", kind: "prose", special: "process", pick: 1, job: "Week 2 for the visitor: what their findings review covers." },
      { id: "step3", kind: "prose", special: "process", pick: 2, job: "Weeks 3 and 4 for the visitor: what gets built on their domain, approved by their team." },
      { id: "step4", kind: "prose", special: "process", pick: 3, job: "Day 30 for the visitor: same fleet, same queries, what proof looks like for them." },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    purpose: "The questions THIS visitor would actually ask before reaching out, answered for them. Keep the count.",
    fields: Array.from({ length: 9 }, (_, i) => [
      { id: `q${i + 1}`, kind: "textnode", special: "faq-q", pick: i, job: `Question ${i + 1} this visitor would really ask.` },
      { id: `a${i + 1}`, kind: "prose", special: "faq-a", pick: i, job: `The answer for this visitor. Product claims only from productFacts. Shorter than the original is fine.` },
    ]).flat(),
  },
  {
    id: "closer",
    title: "Closing",
    purpose: "The final push. Address the visitor's company by name; the three offer rows with prices stay.",
    fields: [
      { id: "headline", kind: "headline", selector: "h2", pick: 0, job: "'The agent is recommending. It should be <company>.' or an equally short mint." },
      { id: "line1", kind: "prose", selector: ".text-center p", pick: 0, job: "What agents are deciding in the visitor's category right now." },
      { id: "line2", kind: "prose", selector: ".text-center p", pick: 1, job: "The one-line question that lands it." },
    ],
  },
]);

/* The express contract agents get by default: hero, cards, closer, and the
   full FAQ (Marc, 2026-08-31: half-personalized FAQs read broken). Fields
   default, sized for one thinking pass. detail:"full" returns everything. */
const EXPRESS_FIELDS = Object.freeze([
  "hero.lede",
  "whatwedo.subtitle", "whatwedo.card1_title", "whatwedo.card1_body",
  "whatwedo.card2_title", "whatwedo.card2_body", "whatwedo.card3_title", "whatwedo.card3_body",
  "headless.argument",
  "snapshot.subtitle",
  "minglabs.fit",
  "closer.line1", "closer.line2",
  "faq.q1", "faq.a1", "faq.q2", "faq.a2", "faq.q3", "faq.a3",
  "faq.q4", "faq.a4", "faq.q5", "faq.a5", "faq.q6", "faq.a6",
  "faq.q7", "faq.a7", "faq.q8", "faq.a8", "faq.q9", "faq.a9",
]);

/* ── Page map ─────────────────────────────────────────────────────────── */

const SECTION_MARKERS = Object.freeze([
  { key: "whatwedo", h2: "A system, not a service." },
  { key: "architecture", domId: "architecture" },
  { key: "whatyouface", h2: "The problem with legacy brand sites." },
  { key: "headless", h2: "Rebuild your brand for agents." },
  { key: "snapshot", domId: "snapshot" },
  { key: "minglabs", h2: "Not a startup. Not an agency." },
  { key: "process", h2: "What happens after you say yes." },
  { key: "faq", domId: "faq" },
  { key: "closer", h2: "The agent is recommending. It should be you." },
]);

const state = {
  mode: "generic",
  profile: null,
  written: new Map(),   /* sectionId -> Set(fieldIds) */
  toolCount: 0,
  agentSeen: false,     /* a script-driven agent executed a tool */
  skelWatchdog: 0,
};

const dom = { sections: new Map(), fields: new Map() };
const ui = {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function resolveFieldNode(sectionEl, field) {
  if (field.special === "verb") {
    const h1 = document.querySelector("main h1");
    if (!h1) return null;
    const textNodes = [...h1.childNodes].filter((n) => n.nodeType === 3 && n.data.trim());
    return textNodes.at(-1) ?? null;
  }
  if (field.special === "process") {
    const rows = sectionEl.querySelectorAll(".border.border-border > div");
    const row = rows[field.pick];
    if (!row) return null;
    const spans = row.querySelectorAll("span");
    return spans[spans.length - 1] ?? null;
  }
  if (field.special === "faq-q") {
    const item = sectionEl.querySelectorAll("details")[field.pick];
    return item?.querySelector("summary span") ?? null;
  }
  if (field.special === "faq-a") {
    const item = sectionEl.querySelectorAll("details")[field.pick];
    return item?.querySelector(".faq-content") ?? null;
  }
  if (field.match) {
    return [...sectionEl.querySelectorAll("p")].find((p) => cleanText(p.textContent).startsWith(field.match)) ?? null;
  }
  let node = sectionEl.querySelectorAll(field.selector)[field.pick ?? 0] ?? null;
  if (node && field.sibling) node = node.nextElementSibling?.matches(field.sibling) ? node.nextElementSibling : null;
  if (node && field.kind === "textnode") {
    /* Write only the element's text node so inline SVGs (check icons) survive. */
    const textNode = [...node.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).at(-1);
    return textNode ?? null;
  }
  return node;
}

function capturePage() {
  const main = document.querySelector("main");
  if (!main) throw new Error("No <main> found.");
  const sections = [...main.querySelectorAll(":scope > section")];
  const hero = sections.find((s) => s.querySelector("h1"));
  if (!hero) throw new Error("No hero found.");
  const byKey = new Map([["hero", hero]]);
  for (const marker of SECTION_MARKERS) {
    let match = null;
    if (marker.domId) match = sections.find((s) => s.id === marker.domId);
    if (!match && marker.h2) {
      match = sections.find((s) => {
        const h2 = s.querySelector("h2");
        return h2 && cleanText(h2.textContent) === marker.h2;
      });
    }
    if (match) byKey.set(marker.key, match);
  }
  dom.main = main;
  dom.sections = byKey;
  dom.chip = [...hero.querySelectorAll("span")].find(
    (n) => n.childElementCount === 0 && n.textContent.trim().startsWith("Behind every AI agent"),
  ) ?? null;
  dom.chipOriginal = dom.chip ? dom.chip.textContent : "";
  dom.urlInput = document.getElementById("snapshot-url");
  dom.emailInput = document.getElementById("snapshot-email");

  /* Resolve every contracted field once; store node, original, budget. */
  for (const contract of SECTION_CONTRACTS) {
    const sectionEl = byKey.get(contract.id);
    if (!sectionEl) continue;
    for (const field of contract.fields) {
      const node = resolveFieldNode(contract.id === "hero" ? sectionEl : sectionEl, field);
      if (!node) continue;
      const original = cleanText(node.textContent);
      if (!original) continue;
      const words = wordCount(original);
      dom.fields.set(`${contract.id}.${field.id}`, {
        section: contract.id,
        field,
        node,
        original,
        maxWords: Math.max(3, Math.ceil(words * 1.3) + 2),
        maxChars: Math.max(28, Math.ceil(original.length * 1.35) + 12),
      });
    }
  }
}

/* ── Blueprint for the agent ──────────────────────────────────────────── */

function blueprint(detail = "express") {
  const express = new Set(EXPRESS_FIELDS);
  return SECTION_CONTRACTS
    .filter((c) => dom.sections.has(c.id))
    .map((c) => ({
      section_id: c.id,
      title: c.title,
      purpose: c.purpose,
      fields: c.fields
        .map((f) => ({ entry: dom.fields.get(`${c.id}.${f.id}`), key: `${c.id}.${f.id}` }))
        .filter((x) => x.entry && (detail === "full" || express.has(x.key)))
        .map(({ entry }) => ({
          field_id: entry.field.id,
          job: entry.field.job,
          original: entry.original,
          max_words: entry.maxWords,
          max_chars: entry.maxChars,
        })),
    }))
    .filter((c) => c.fields.length);
}

function sectionsRemaining() {
  return blueprint("full")
    .map((c) => c.section_id)
    .filter((id) => !state.written.has(id));
}

/* ── Morph + crossfade ────────────────────────────────────────────────── */

function fieldElement(entry) {
  const node = entry.node;
  return node.nodeType === 3 ? null : node;  /* text nodes (hero verb, includes) get no skeleton */
}

function skeletonOn(entry) {
  const target = fieldElement(entry);
  if (!target || target.classList.contains("p2m-skel")) return;
  target.classList.add("p2m-skel");
  target.setAttribute("aria-busy", "true");
}

function skeletonOff(entry) {
  const target = fieldElement(entry);
  if (!target) return;
  target.classList.remove("p2m-skel");
  target.removeAttribute("aria-busy");
}

function clearAllSkeletons() {
  clearTimeout(state.skelWatchdog);
  for (const entry of dom.fields.values()) skeletonOff(entry);
}

/* Preview: lay the shimmer rows onto the next unwritten section so the
   visitor sees where text is about to appear. A watchdog lifts them if the
   agent stops writing. */
function previewNextSkeleton() {
  clearAllSkeletons();
  const nextId = blueprint("full").map((c) => c.section_id).find((id) => !state.written.has(id));
  if (!nextId || !state.profile) return;
  for (const [key, entry] of dom.fields) {
    if (key.startsWith(`${nextId}.`)) skeletonOn(entry);
  }
  state.skelWatchdog = setTimeout(clearAllSkeletons, 30000);
}

function setFieldText(entry, value) {
  const target = fieldElement(entry);
  if (target && target.classList.contains("p2m-skel")) {
    entry.node.textContent = value;
    skeletonOff(entry);
    target.classList.remove("p2m-fresh");
    void target.offsetWidth;
    target.classList.add("p2m-fresh");
    return;
  }
  crossfadeTo(entry.node, value);
  if (target) {
    setTimeout(() => {
      target.classList.remove("p2m-fresh");
      void target.offsetWidth;
      target.classList.add("p2m-fresh");
    }, 340);
  }
}

function crossfadeTo(node, newText) {
  const target = node.nodeType === 3 ? node.parentElement : node;
  if (reducedMotion.matches || document.visibilityState !== "visible" || !target) {
    node.textContent = newText;
    return;
  }
  target.style.transition = "opacity 0.16s cubic-bezier(0, 0, 0.2, 1)";
  target.style.opacity = "0";
  setTimeout(() => {
    node.textContent = newText;
    target.style.transition = "opacity 0.28s cubic-bezier(0.4, 0, 1, 1)";
    target.style.opacity = "1";
    setTimeout(() => {
      target.style.removeProperty("transition");
      target.style.removeProperty("opacity");
    }, 320);
  }, 170);
}

let statusTimer = null;
function announce(message) {
  clearTimeout(statusTimer);
  ui.status.textContent = message;
  ui.status.classList.add("p2m-show");
  statusTimer = setTimeout(() => ui.status.classList.remove("p2m-show"), 2200);
}

/* ── Session flows ────────────────────────────────────────────────────── */

function contextLabel(profile) {
  const parts = [profile.organization, profile.mission_short || truncate(profile.mission, 44)].filter(Boolean);
  return `Prepared for ${parts.join(" · ")}`;
}

function mintVerbFromProfile(profile) {
  const text = [
    ...TEXT_FIELDS.map((f) => profile[f]),
    ...LIST_FIELDS.flatMap((f) => profile[f]),
  ].join(" ").toLowerCase();
  if (/procure|supplier|shortlist|rfp|sourcing|vendor|agency|partner/.test(text)) return " shortlist.";
  if (/book|reservation|stay|travel|hotel|camp/.test(text)) return " book.";
  if (/buy|commerce|shop|checkout|cart|order|sell/.test(text)) return " buy.";
  if (/cite|citation|content|answer|visib|seo|search|found|mention/.test(text)) return " cite.";
  if (/recommend|advis|suggest|compare|choose|pick/.test(text)) return " recommend.";
  return " use.";
}

function startPersonalization(profileInput) {
  markAgentSeen();
  const profile = normalizeProfile(profileInput);
  state.profile = profile;
  state.mode = "personalized";
  state.written = new Map();

  /* No-brainers, instant: context chip, labeled context block, verb mint
     (the agent can overwrite it via hero.headline_verb), snapshot prefill. */
  if (dom.chip) crossfadeTo(dom.chip, contextLabel(profile));
  const verbEntry = dom.fields.get("hero.headline_verb");
  if (verbEntry) crossfadeTo(verbEntry.node, mintVerbFromProfile(profile));
  /* Instant brand mints: the page transforms before the agent writes a
     word (Marc, 2026-08-31: perceived latency is the product). The agent
     may overwrite any of these via write_section/write_all. */
  if (profile.organization) {
    const org = profile.organization;
    const mint = (key, text) => {
      const entry = dom.fields.get(key);
      if (entry) setFieldText(entry, text);
    };
    mint("headless.headline", `Rebuild ${org} for agents.`);
    mint("snapshot.headline", `${org}, tested by agents.`);
    mint("closer.headline", `The agent is recommending. It should be ${org}.`);
  }
  prefillSnapshot(profile);
  previewNextSkeleton();
  renderBanner();
  renderPill();
  announce(`Personalizing for ${profile.organization || "you"} · your agent is writing`);
  return blueprint();
}

function prefillSnapshot(profile) {
  const setInput = (input, value) => {
    if (!input || !value) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  setInput(dom.urlInput, profile.website_url);
  setInput(dom.emailInput, profile.work_email);
}

function validateFieldText(entry, text) {
  const value = cleanText(text);
  if (!value) return { error: "Empty text. Omit the field to keep the original." };
  /* Echoing the original verbatim always passes: confirming a field
     unchanged is legitimate, and some originals predate the style rules
     enforced on NEW text (em-dash ban). */
  if (value === entry.original) return { value };
  if (/[<>]/.test(value)) return { error: "No angle brackets. Plain text only." };
  if (value.includes("—")) return { error: "No em dashes on this site. Restructure the sentence." };
  const words = wordCount(value);
  if (words > entry.maxWords || value.length > entry.maxChars) {
    return { error: `Over budget for ${entry.field.id}: max ${entry.maxWords} words / ${entry.maxChars} characters (you sent ${words} words / ${value.length}). Shorten it; the budget protects the layout.` };
  }
  return { value };
}

async function writeAll(sectionsInput) {
  if (!state.profile) throw new Error("Call start_personalization with the visitor's profile first.");
  if (!sectionsInput || typeof sectionsInput !== "object" || Array.isArray(sectionsInput)) {
    throw new Error("sections must be an object of section_id -> {field_id: text}.");
  }
  const order = blueprint("full").map((c) => c.section_id).filter((id) => id in sectionsInput);
  const results = [];
  let delay = 0;
  for (const id of order) {
    const contract = SECTION_CONTRACTS.find((c) => c.id === id);
    const writes = [];
    const rejected = [];
    for (const [fieldId, text] of Object.entries(sectionsInput[id])) {
      const entry = dom.fields.get(`${id}.${fieldId}`);
      if (!entry) { rejected.push({ field_id: fieldId, error: `Unknown field for ${id}.` }); continue; }
      const check = validateFieldText(entry, text);
      if (check.error) { rejected.push({ field_id: fieldId, error: check.error }); continue; }
      writes.push({ entry, value: entry.field.special === "verb" ? ` ${check.value}` : check.value });
    }
    if (writes.length) {
      const writtenSet = state.written.get(id) ?? new Set();
      for (const w of writes) writtenSet.add(w.entry.field.id);
      state.written.set(id, writtenSet);
      /* Staggered reveal: skeleton on, then resolve, section by section. */
      for (const w of writes) skeletonOn(w.entry);
      setTimeout(() => {
        for (const w of writes) setFieldText(w.entry, w.value);
        renderBanner();
      }, delay);
      delay += 380;
    }
    results.push({ section_id: id, written: writes.map((w) => w.entry.field.id), rejected });
  }
  clearTimeout(state.skelWatchdog);
  setTimeout(() => { if (!runComplete()) previewNextSkeleton(); renderBanner(); }, delay + 100);
  announce(`Personalized in one pass · ${state.written.size} sections`);
  return { written: results, sections_remaining: sectionsRemaining() };
}

async function writeSection(sectionId, fieldsInput) {
  markAgentSeen();
  if (!state.profile) throw new Error("Call start_personalization with the visitor's profile first.");
  const contract = SECTION_CONTRACTS.find((c) => c.id === sectionId);
  if (!contract || !dom.sections.has(sectionId)) {
    throw new Error(`Unknown section_id: ${sectionId}. Valid: ${blueprint("full").map((c) => c.section_id).join(", ")}.`);
  }
  if (!fieldsInput || typeof fieldsInput !== "object" || Array.isArray(fieldsInput)) {
    throw new Error("fields must be an object of field_id -> text.");
  }
  const writes = [];
  const rejected = [];
  for (const [fieldId, text] of Object.entries(fieldsInput)) {
    const entry = dom.fields.get(`${sectionId}.${fieldId}`);
    if (!entry) {
      rejected.push({ field_id: fieldId, error: `Unknown field for ${sectionId}.` });
      continue;
    }
    const result = validateFieldText(entry, text);
    if (result.error) {
      rejected.push({ field_id: fieldId, error: result.error });
      continue;
    }
    writes.push({ entry, value: entry.field.special === "verb" ? ` ${result.value}` : result.value });
  }
  if (!writes.length) {
    throw new Error(`No valid fields for ${sectionId}. ${rejected.map((r) => `${r.field_id}: ${r.error}`).join(" ")}`);
  }

  /* Render: skeleton rows resolve into the new text; a brief fading wash
     marks each freshly written field. */
  for (const write of writes) setFieldText(write.entry, write.value);

  const writtenSet = state.written.get(sectionId) ?? new Set();
  for (const write of writes) writtenSet.add(write.entry.field.id);
  state.written.set(sectionId, writtenSet);
  if (!runComplete()) previewNextSkeleton();
  renderBanner();
  const total = blueprint("full").length;
  announce(`${contract.title} personalized · ${state.written.size} of ${total} sections`);
  return {
    section_id: sectionId,
    written: writes.map((w) => w.entry.field.id),
    rejected,
    sections_remaining: sectionsRemaining(),
  };
}

function restoreOriginal() {
  clearAllSkeletons();
  for (const entry of dom.fields.values()) {
    const target = fieldElement(entry);
    target?.classList.remove("p2m-fresh");
    entry.node.textContent = entry.field.special === "verb" ? ` ${entry.original}` : entry.original;
  }
  if (dom.chip) dom.chip.textContent = dom.chipOriginal;
  if (dom.urlInput) dom.urlInput.value = "";
  if (dom.emailInput) dom.emailInput.value = "";
  ui.banner.hidden = true;
  document.body.style.removeProperty("padding-top");
  state.mode = "generic";
  state.profile = null;
  state.written = new Map();
  renderPill();
}

async function resetExperience() {
  if (ui.dialog.open) ui.dialog.close();
  restoreOriginal();
  announce("Original page restored");
}

/* ── Decision brief ───────────────────────────────────────────────────── */

function joinNatural(items, fallback) {
  const values = items.filter(Boolean);
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}
function sentence(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/[.!?]+$/, "") + ".";
}

function listLine(items) {
  return items.filter(Boolean).join(" · ");
}

function decisionBrief(profile, audience) {
  let who = audience || profile.decision_maker || "the buying team";
  /* "Prepared for The owner family" reads broken; lowercase a leading article. */
  who = who.replace(/^(The|A|An|Our|My)\s/, (m) => m.toLowerCase());
  const rows = [
    { label: "Mission", value: sentence(profile.mission) },
    { label: "What Hyperize is", value: PRODUCT_FACTS.whatItIs },
    { label: "First step", value: PRODUCT_FACTS.firstStep },
    { label: "Proof reference", value: PRODUCT_FACTS.proof },
  ];
  if (profile.why_now) rows.splice(1, 0, { label: "Why now", value: sentence(profile.why_now) });
  if (profile.priorities.length) rows.push({ label: "What matters", value: listLine(profile.priorities) });
  if (profile.constraints.length) rows.push({ label: "Boundaries", value: listLine(profile.constraints) });
  if (profile.success_metrics.length) rows.push({ label: "Success", value: listLine(profile.success_metrics) });
  if (profile.deadline) rows.push({ label: "Timing", value: sentence(profile.deadline) });
  return {
    audience: who,
    eyebrow: `Decision brief · prepared for ${who}`,
    title: `Should ${profile.organization || "the team"} make its brand the one AI agents pick?`,
    rows,
    next: `Run the free Agent Success Snapshot on ${profile.organization ? `${profile.organization}'s` : "your"} website (one URL, results in 48 hours) and judge the score against this mission.`,
  };
}

function briefToMarkdown(decision) {
  return [
    `# ${decision.title}`,
    "",
    `Prepared for ${decision.audience} · via hyperize.ai`,
    "",
    ...decision.rows.map((row) => `- **${row.label}:** ${row.value}`),
    "",
    `**Recommended next decision:** ${decision.next}`,
    "",
    "_Context was supplied by the visitor or their agent and stays in their browser. Product statements are quoted from hyperize.ai._",
  ].join("\n");
}

function briefToEmail(decision, profile) {
  const subject = truncate(`Decision brief: ${profile.mission}`, 140);
  const body = [
    decision.title,
    "",
    ...decision.rows.map((row) => `${row.label}: ${row.value}`),
    "",
    `Recommended next decision: ${decision.next}`,
    "",
    "Prepared with my approved context on hyperize.ai.",
  ].join("\n");
  return { subject, body: body.length > 1800 ? `${body.slice(0, 1799)}…` : body };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function briefToHtmlDocument(decision) {
  const rows = decision.rows
    .map((row) => `<div class="row"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
    .join("\n      ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(decision.title)}</title>
<style>
  body { margin: 0; padding: 48px 24px; background: #fafafa; color: #121212; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.5; }
  main { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; padding: 32px; }
  p.eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #737373; }
  h1 { margin: 0 0 24px; font-size: 22px; line-height: 1.3; font-weight: 500; }
  dl { margin: 0; display: grid; gap: 14px; }
  .row dt { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #737373; margin-bottom: 2px; }
  .row dd { margin: 0; font-size: 15px; }
  .next { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
  footer { max-width: 640px; margin: 16px auto 0; font-size: 12px; color: #737373; }
</style>
</head>
<body>
<main>
  <p class="eyebrow">${escapeHtml(decision.eyebrow)}</p>
  <h1>${escapeHtml(decision.title)}</h1>
  <dl>
      ${rows}
  </dl>
  <div class="next"><p class="eyebrow">Recommended next decision</p><p>${escapeHtml(decision.next)}</p></div>
</main>
<footer>Context was supplied by the visitor or their agent and stays in their browser. Product statements are quoted from hyperize.ai.</footer>
</body>
</html>`;
}

async function showDecisionBrief(audience = "") {
  if (!state.profile) throw new Error("Call start_personalization first.");
  const who = cleanText(audience);
  if (who.length > 80) throw new Error("Decision audience is longer than 80 characters.");
  const decision = decisionBrief(state.profile, who);
  renderBrief(decision);
  showView("brief");
  if (!ui.dialog.open) ui.dialog.showModal();
  announce(`Decision brief prepared for ${decision.audience}`);
  return decision;
}

/* ── UI: banner, dialog, status ───────────────────────────────────────── */

/* Async clipboard is permission-gated in some browsers (Comet denied it,
   2026-08-31). Fall back to the classic textarea + execCommand path. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function showView(view) {
  ui.viewStart.hidden = view !== "start";
  ui.viewReceipt.hidden = view !== "receipt";
  ui.viewBrief.hidden = view !== "brief";
}

function markAgentSeen() {
  if (state.agentSeen) return;
  state.agentSeen = true;
  renderPill();
}

function renderPill() {
  const connected = state.toolCount > 0 || state.agentSeen;
  ui.pill.textContent = connected
    ? `Agent connected · ${state.toolCount || (window.__hzWebMcpTools || []).length || toolDefinitions().length} page tools`
    : "No agent connected yet";
  ui.pill.classList.toggle("p2m-connected", connected);
}

/* Completion is judged against the tier the agent actually wrote: an
   express pass (the default contract) is done at its own section count,
   not at the full blueprint's (it would sit on "Adapting · 7 of 10"
   forever). Writing any beyond-express section switches to the full bar. */
function runTotal() {
  const expressIds = new Set(blueprint("express").map((c) => c.section_id));
  const beyondExpress = [...state.written.keys()].some((id) => !expressIds.has(id));
  return beyondExpress ? blueprint("full").length : expressIds.size;
}

function runComplete() {
  return state.written.size >= runTotal();
}

function renderBanner() {
  if (!state.profile) return;
  const total = runTotal();
  const done = state.written.size;
  const who = state.profile.organization || "you";
  ui.bannerText.textContent = done < total
    ? `Adapting to ${who} · ${done} of ${total}`
    : `Adapted to ${who}`;
  ui.banner.hidden = false;
  positionBanner();
}

function positionBanner() {
  const header = document.getElementById("site-header");
  const top = header ? header.getBoundingClientRect().height : 0;
  ui.banner.style.top = `${Math.round(top)}px`;
  document.body.style.paddingTop = `${Math.ceil(ui.banner.getBoundingClientRect().height)}px`;
}

function renderReceipt() {
  if (!state.profile) return;
  ui.receiptLabel.textContent = `Personalized for ${state.profile.organization || "you"}`;
  const rows = [];
  for (const field of TEXT_FIELDS) if (state.profile[field]) rows.push([field.replaceAll("_", " "), state.profile[field]]);
  for (const field of LIST_FIELDS) if (state.profile[field].length) rows.push([field.replaceAll("_", " "), state.profile[field].join(" · ")]);
  ui.receiptData.replaceChildren(...rows.map(([label, value]) => {
    const row = el("div");
    row.append(el("dt", "", label), el("dd", "", value));
    return row;
  }));
  const changes = [];
  for (const [sectionId, fields] of state.written) {
    const contract = SECTION_CONTRACTS.find((c) => c.id === sectionId);
    changes.push(`${contract?.title ?? sectionId}: ${fields.size} ${fields.size === 1 ? "field" : "fields"} rewritten by your agent.`);
  }
  if (dom.urlInput?.value || dom.emailInput?.value) changes.push("Prefilled the free-snapshot form. Nothing is submitted without your click.");
  if (!changes.length) changes.push("Session started; no sections written yet.");
  ui.receiptChanges.replaceChildren(...changes.map((c) => el("li", "", c)));
  ui.receiptDisclaimer.textContent = "The personalized text was written by your agent from context you gave it, inside this page's field budgets. It stays in this browser: it never enters a URL and is never sent to a server. Layout, prices, client logos, measured scores and quotes are unchanged Hyperize content.";
}

function renderBrief(decision) {
  ui.briefEyebrow.textContent = decision.eyebrow;
  ui.briefTitle.textContent = decision.title;
  ui.briefRows.replaceChildren(...decision.rows.map((row) => {
    const item = el("div");
    item.append(el("dt", "", row.label), el("dd", "", row.value));
    return item;
  }));
  ui.briefNext.textContent = `Recommended next decision: ${decision.next}`;
  const email = briefToEmail(decision, state.profile);
  ui.briefEmail.href = `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  ui.briefDecision = decision;
}

function openDialog(view = "start") {
  if (view === "receipt") renderReceipt();
  showView(view);
  renderPill();
  if (!ui.dialog.open) ui.dialog.showModal();
}

function buildDialog() {
  const dialog = el("dialog", "p2m-dialog");
  dialog.setAttribute("aria-labelledby", "p2m-title");

  const head = el("div", "p2m-head");
  const headText = el("div");
  headText.append(el("p", "p2m-eyebrow", "WebMCP"));
  const title = el("h2", "", "Make this page pitch to you.");
  title.id = "p2m-title";
  headText.append(title);
  const close = el("button", "p2m-x", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", () => dialog.close());
  head.append(headText, close);

  const body = el("div", "p2m-body");

  const viewStart = el("div");
  const pill = el("span", "p2m-pill", "No agent connected yet");
  viewStart.append(pill);
  viewStart.append(el("p", "p2m-label", "Your request, word for word"));
  viewStart.append(el("p", "p2m-prompt", AGENT_REQUEST));
  const copyActions = el("div", "p2m-actions");
  const copyRequest = el("button", "p2m-btn p2m-btn-primary", "Copy the request for your assistant");
  copyRequest.type = "button";
  copyRequest.addEventListener("click", async () => {
    const ok = await copyText(AGENT_REQUEST);
    copyRequest.textContent = ok
      ? "Copied. Paste it into your assistant."
      : "Copy blocked here. Tap the request above; it selects itself.";
    setTimeout(() => { copyRequest.textContent = "Copy the request for your assistant"; }, 2600);
  });
  copyActions.append(copyRequest);
  viewStart.append(copyActions);

  viewStart.append(el("p", "p2m-label", "No agent in this browser? Open a chat"));
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const sharePrompt = SHARE_PROMPT_FOR(canonical);
  const shareRow = el("div", "p2m-actions");
  const providers = [
    ["Open in ChatGPT", "https://chatgpt.com/?q=" + encodeURIComponent(sharePrompt)],
    /* claude.ai overlays its standard notice on any prefilled link. A blank
       chat plus clipboard confused people more (Marc, 2026-08-30: nobody
       knows to paste), so we prefill and let the note set the expectation. */
    ["Open in Claude", "https://claude.ai/new?q=" + encodeURIComponent(sharePrompt)],
    ["Open in Perplexity", "https://www.perplexity.ai/search?q=" + encodeURIComponent(sharePrompt)],
  ];
  for (const [label, href] of providers) {
    const link = el("a", "p2m-btn", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    shareRow.append(link);
  }
  viewStart.append(shareRow);
  viewStart.append(el("p", "p2m-note", "Each button opens a new chat with the request above prefilled; Claude also shows its standard notice for prefilled links. The chat pitches from the public page; the live transformation needs an agent in this browser."));

  const viewReceipt = el("div");
  viewReceipt.hidden = true;
  viewReceipt.append(el("p", "p2m-label", "Why this page changed"));
  const receiptLabel = el("p", "", "");
  receiptLabel.style.fontSize = "15px";
  receiptLabel.style.fontWeight = "500";
  viewReceipt.append(receiptLabel);
  viewReceipt.append(el("p", "p2m-label", "Context used"));
  const receiptData = el("dl", "p2m-rows");
  viewReceipt.append(receiptData);
  viewReceipt.append(el("p", "p2m-label", "Changes"));
  const receiptChanges = el("ul", "p2m-changes");
  viewReceipt.append(receiptChanges);
  const receiptDisclaimer = el("p", "p2m-disclaimer", "");
  viewReceipt.append(receiptDisclaimer);
  const receiptActions = el("div", "p2m-actions");
  const resetBtn = el("button", "p2m-btn", "Reset the page");
  resetBtn.type = "button";
  resetBtn.addEventListener("click", () => resetExperience().catch((e) => announce(String(e?.message ?? e))));
  const receiptClose = el("button", "p2m-btn", "Close");
  receiptClose.type = "button";
  receiptClose.addEventListener("click", () => dialog.close());
  receiptActions.append(resetBtn, receiptClose);
  viewReceipt.append(receiptActions);

  const viewBrief = el("div");
  viewBrief.hidden = true;
  const briefEyebrow = el("p", "p2m-label", "Decision brief");
  viewBrief.append(briefEyebrow);
  const briefTitle = el("h3", "", "");
  briefTitle.style.fontSize = "18px";
  briefTitle.style.fontWeight = "500";
  briefTitle.style.lineHeight = "1.3";
  briefTitle.style.letterSpacing = "-0.01em";
  viewBrief.append(briefTitle);
  const briefRows = el("dl", "p2m-rows");
  viewBrief.append(briefRows);
  const briefNext = el("p", "p2m-brief-next", "");
  viewBrief.append(briefNext);
  const briefActions = el("div", "p2m-actions");
  const briefCopy = el("button", "p2m-btn", "Copy as Markdown");
  briefCopy.type = "button";
  briefCopy.addEventListener("click", async () => {
    const ok = await copyText(briefToMarkdown(ui.briefDecision));
    announce(ok ? "Brief copied as Markdown" : "Copy blocked. Use the download instead.");
  });
  const briefDownload = el("button", "p2m-btn", "Download");
  briefDownload.type = "button";
  briefDownload.addEventListener("click", () => {
    try {
      const html = briefToHtmlDocument(ui.briefDecision);
      const slug = (state.profile?.mission || "brief").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "brief";
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const link = el("a");
      link.href = url;
      link.download = `hyperize-decision-brief-${slug}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      announce("Brief downloaded");
    } catch (e) {
      announce(String(e?.message ?? e));
    }
  });
  const briefEmail = el("a", "p2m-btn", "Draft the email");
  const briefBack = el("button", "p2m-btn", "Back");
  briefBack.type = "button";
  briefBack.addEventListener("click", () => openDialog("receipt"));
  briefActions.append(briefCopy, briefDownload, briefEmail, briefBack);
  viewBrief.append(briefActions);
  viewBrief.append(el("p", "p2m-disclaimer", "The brief opens in your own mail client or clipboard. Nothing is sent by this page."));

  body.append(viewStart, viewReceipt, viewBrief);
  dialog.append(head, body);
  document.body.append(dialog);

  Object.assign(ui, {
    dialog, pill, viewStart, viewReceipt, viewBrief,
    receiptLabel, receiptData, receiptChanges, receiptDisclaimer,
    briefEyebrow, briefTitle, briefRows, briefNext, briefEmail,
  });
}

function buildBanner() {
  const banner = el("div", "p2m-banner");
  banner.hidden = true;
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Personalization receipt");
  const inner = el("div", "p2m-banner-inner");
  const text = el("button", "p2m-banner-text", "");
  text.type = "button";
  text.title = "Why this page changed";
  text.addEventListener("click", () => openDialog("receipt"));
  const reset = el("button", "p2m-banner-reset", "Reset");
  reset.type = "button";
  reset.addEventListener("click", () => resetExperience().catch((e) => announce(String(e?.message ?? e))));
  inner.append(text, reset);
  banner.append(inner);
  document.body.append(banner);
  ui.banner = banner;
  ui.bannerText = text;
  window.addEventListener("resize", () => {
    if (!banner.hidden) requestAnimationFrame(positionBanner);
  }, { passive: true });
}

function buildStatus() {
  const status = el("div", "p2m-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.append(status);
  ui.status = status;
}

const CTA_LABEL = "Personalize this page";
const NAV_LABEL = "Personalize";  /* header space is tight; the badge carries the rest */

/* One-click handoff for a visitor whose assistant is open in a panel: the
   click is the human's intent, the copied request names the exact tool path
   so any agent can act without exploring first. Carries no visitor data. */
/* Prefilled prompt for the AI share buttons. Opens a NEW chat in another
   tab, which cannot reach this tab's WebMCP tools; instead it reads the
   public page (Markdown twin + llms.txt) and pitches in the chat. Generic
   by design: visitor data never enters a URL. */
const SHARE_PROMPT_FOR = (url) =>
  `Read ${url} and its llms.txt. I want to know how Hyperize would help my company. Ask me who we are and what I was asked to solve, then pitch the page to me as if it were written for us, and end with the single next step: the free Agent Success Snapshot.`;

const AGENT_REQUEST = "Personalize this page for me using its WebMCP tools: call start_personalization with what you know about me and my company, then submit all texts in one write_all call. No web research needed. Page tools only; do not modify any files.";

function webmcpBadge(mobile = false) {
  /* Same visual grammar as the header's NEW badge. */
  return el("span", mobile
    ? "ml-3 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider bg-chip text-white leading-none"
    : "ml-1.5 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider bg-chip text-white leading-none",
  "WebMCP");
}

function swapHeroCta() {
  /* Replace the secondary hero CTA with the personalization entry (Marc,
     2026-08-30). JS-only swap: without the flag build or without JS the
     original "Free snapshot" link stays, so crawlers see today's page. */
  const hero = dom.sections.get("hero");
  if (!hero) return;
  const secondary = [...hero.querySelectorAll("a[href='#snapshot']")]
    .find((a) => !a.classList.contains("btn-sweep"));
  if (!secondary) return;
  secondary.textContent = "";
  secondary.append(document.createTextNode(CTA_LABEL), webmcpBadge());
  secondary.addEventListener("click", (event) => {
    event.preventDefault();
    openDialog(state.mode === "generic" ? "start" : "receipt");
  });
}

function buildNavButtons() {
  const desktopNav = document.querySelector("#site-header .header-bar nav");
  if (desktopNav) {
    const button = el("button", "p2m-navbtn header-nav-link flex items-center text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors duration-200");
    button.type = "button";
    button.append(document.createTextNode(NAV_LABEL), webmcpBadge());
    button.addEventListener("click", () => openDialog(state.mode === "generic" ? "start" : "receipt"));
    desktopNav.insertBefore(button, desktopNav.querySelector("a.header-cta-secondary") ?? null);
  }
  const mobileNav = document.querySelector("#mobile-nav nav");
  const mobileToggle = document.getElementById("mobile-nav-toggle");
  if (mobileNav) {
    const button = el("button", "p2m-navbtn-mobile flex items-center py-4 text-2xl md:text-3xl font-medium text-foreground");
    button.type = "button";
    button.append(document.createTextNode(NAV_LABEL), webmcpBadge(true));
    button.addEventListener("click", () => {
      if (mobileToggle?.getAttribute("aria-expanded") === "true") mobileToggle.click();
      openDialog(state.mode === "generic" ? "start" : "receipt");
    });
    mobileNav.append(button);
  }
}

/* ── WebMCP tools ─────────────────────────────────────────────────────── */

/* Agents disagree on the execute() return shape: some read the raw object,
   some expect the MCP CallToolResult ({content: [{type, text}]}). Field
   finding from an Opus run, 2026-08-30. Serve both: the raw object plus an
   MCP-shaped content array carrying the same JSON. */
function mcpResult(raw) {
  return { ...raw, content: [{ type: "text", text: JSON.stringify(raw) }] };
}

/* Same counting the four site tools use (WebMcp.astro): tool NAME only,
   never inputs or profile data. The personalization promise ("stays in
   your browser") holds: what a visitor's agent writes is never sent. */
function countToolCall(tool) {
  try {
    fetch("/.netlify/functions/webmcp-telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* counting is optional by design */ }
}

function withCount(tool) {
  const inner = tool.execute;
  return { ...tool, execute: async (input) => { countToolCall(tool.name); return inner(input); } };
}

function toolDefinitions() {
  return rawToolDefinitions().map(withCount);
}

function rawToolDefinitions() {
  return [
    {
      name: "get_adaptation_capabilities",
      title: "Read this page's writing contract",
      annotations: { readOnlyHint: true },
      description:
        "Read how the hyperize.ai homepage lets a visitor's agent rewrite it: the per-section field contracts (each with the field's job, the original text and a hard length budget), the style rules, the stable product facts, and the accepted visitor profile. Call this first.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { detail: { type: "string", enum: ["express", "full"], description: "express (default): the highest-impact fields incl. the complete FAQ, sized for one writing pass. full: every field." } },
      },
      annotations: { readOnlyHint: true },
      execute: async ({ detail = "express" } = {}) => mcpResult({
        product: PRODUCT_FACTS.product,
        productFacts: PRODUCT_FACTS,
        styleRules: STYLE_RULES,
        profileSchema: PROFILE_SCHEMA,
        sections: blueprint(detail),
        currentMode: state.mode,
        next: "Do NOT research the visitor's company on the web; use what the user told you and what you already know. Call start_personalization with the profile (the page transforms its brand lines instantly), then submit ALL texts in ONE write_all call.",
      }),
    },
    {
      name: "start_personalization",
      title: "Start personalizing this page",
      description:
        "Start a personalization session from the visitor's context. The page immediately labels itself with their context, mints the headline verb, prefills the free-snapshot form from website_url and work_email, and shows a live progress receipt. Then write the sections one by one with write_section, hero first. Nothing is sent to a server; the context stays in the browser.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { profile: PROFILE_SCHEMA },
        required: ["profile"],
      },
      annotations: { readOnlyHint: false },
      execute: async ({ profile }) => {
        const sections = startPersonalization(profile);
        return mcpResult({
          started: true,
          sections,
          styleRules: STYLE_RULES,
          next: "The page already minted its brand lines from the profile. Now write ALL fields in ONE write_all call ({sections: {hero: {lede: ...}, ...}}). No web research; use what the user told you. Respect every max_words/max_chars budget.",
        });
      },
    },
    {
      name: "write_all",
      title: "Write the whole page in one pass",
      description:
        "Submit the rewritten text for ALL sections in one call: {sections: {hero: {lede: \"...\"}, whatwedo: {...}, ...}}. The page validates every field against its length budget and reveals the sections one after another, so one call still reads as a live transformation. Prefer this over many write_section calls. Do not research the visitor on the web first; use what the user told you.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          sections: {
            type: "object",
            description: "section_id -> {field_id: rewritten plain text}.",
            additionalProperties: { type: "object", additionalProperties: { type: "string", maxLength: 900 } },
          },
        },
        required: ["sections"],
      },
      annotations: { readOnlyHint: false },
      execute: async ({ sections }) => mcpResult(await writeAll(sections)),
    },
    {
      name: "write_section",
      title: "Write one section for the visitor",
      description:
        "Submit the rewritten text for one section's fields. The page validates every field against its length budget (protecting the layout), then renders it live: headline fields decode, prose crossfades, the progress receipt counts up. Omit a field to keep its original text. Product claims only from productFacts; never invent customers, numbers, prices or guarantees.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          section_id: { type: "string", minLength: 2, maxLength: 40 },
          fields: {
            type: "object",
            description: "field_id -> rewritten plain text, inside that field's budget.",
            additionalProperties: { type: "string", maxLength: 900 },
          },
        },
        required: ["section_id", "fields"],
      },
      annotations: { readOnlyHint: false },
      execute: async ({ section_id, fields }) => mcpResult(await writeSection(section_id, fields)),
    },
    {
      name: "show_decision_brief",
      title: "Prepare the decision brief",
      description:
        "Prepare a compact internal decision brief from the visitor's context and this page's published product truth. Returns brief_markdown for the agent to hand over; the page offers copy, download and an email draft.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { audience: { type: "string", maxLength: 80, description: "Optional role or decision-maker the brief is for." } },
      },
      annotations: { readOnlyHint: false },
      execute: async ({ audience = "" } = {}) => {
        const decision = await showDecisionBrief(audience);
        return mcpResult({
          prepared: true,
          audience: decision.audience,
          title: decision.title,
          brief_markdown: briefToMarkdown(decision),
          handoff: "brief_markdown is the ready artifact. Hand it to the user or paste it into the message they asked you to prepare.",
        });
      },
    },
    {
      name: "reset_experience",
      title: "Restore the original page",
      description:
        "Remove the visitor's context and every rewritten text and restore the exact original homepage, including the empty snapshot form.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: { readOnlyHint: false },
      execute: async () => {
        await resetExperience();
        return mcpResult({ reset: true, mode: "generic" });
      },
    },
  ];
}

const P2M_CSS = `
  /* ── Pitch it to me (p2m-). Additive layer, only present when the build
     flag is on. Reads the site tokens, defines none. ─────────────────── */

  /* Nav entry (injected into the existing desktop nav + mobile menu). */
  .p2m-navbtn {
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
  }
  .p2m-navbtn-mobile {
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  /* Receipt banner under the fixed header once the page is adapted. */
  .p2m-banner {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 40;
    background: hsl(var(--background));
    border-bottom: 1px dashed hsl(var(--border));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
  }
  .p2m-banner-inner {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 18px;
    padding: 7px 16px;
  }
  .p2m-banner-reset {
    background: none;
    border: 0;
    cursor: pointer;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: hsl(var(--muted-foreground));
    padding: 0;
  }
  .p2m-banner-reset:hover {
    color: hsl(var(--foreground));
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .p2m-banner-text {
    background: none;
    border: 0;
    cursor: pointer;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: hsl(var(--foreground));
    padding: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .p2m-banner-text:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Dialog. */
  .p2m-dialog {
    width: min(640px, calc(100vw - 32px));
    max-height: min(86vh, 780px);
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    padding: 0;
    margin: auto;
  }
  .p2m-dialog::backdrop {
    background: hsl(var(--foreground) / 0.55);
  }
  .p2m-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 24px 16px;
    border-bottom: 1px dashed hsl(var(--border));
  }
  .p2m-head h2 {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 6px 0 0;
  }
  .p2m-x {
    background: none;
    border: 1px solid hsl(var(--border));
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    color: hsl(var(--muted-foreground));
    flex: none;
  }
  .p2m-x:hover {
    background: hsl(var(--foreground));
    color: hsl(var(--background));
  }
  .p2m-body {
    padding: 20px 24px 24px;
    overflow-y: auto;
    max-height: calc(min(86vh, 780px) - 92px);
  }
  .p2m-eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
    margin: 0;
  }
  .p2m-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid hsl(var(--border));
    padding: 6px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
  }
  .p2m-pill::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: hsl(var(--border));
    flex: none;
  }
  .p2m-pill.p2m-connected {
    color: hsl(var(--foreground));
    border-color: hsl(var(--chip) / 0.5);
  }
  .p2m-pill.p2m-connected::before {
    background: hsl(var(--chip));
  }
  .p2m-skel,
  .p2m-skel * {
    color: transparent !important;
  }
  .p2m-skel {
    border-radius: 3px;
    background-image: linear-gradient(100deg, hsl(var(--muted)) 32%, hsl(var(--border)) 50%, hsl(var(--muted)) 68%);
    background-size: 220% 100%;
    animation: p2m-shimmer 1.8s ease-in-out infinite;
    -webkit-mask-image: repeating-linear-gradient(to bottom, black 0, black calc(1lh - 0.42em), transparent calc(1lh - 0.42em), transparent 1lh);
    mask-image: repeating-linear-gradient(to bottom, black 0, black calc(1lh - 0.42em), transparent calc(1lh - 0.42em), transparent 1lh);
  }
  @keyframes p2m-shimmer {
    from { background-position: 120% 0; }
    to { background-position: -120% 0; }
  }
  .p2m-fresh {
    animation: p2m-fresh 1.4s ease-out both;
  }
  @keyframes p2m-fresh {
    from { background-color: hsl(var(--muted)); }
    to { background-color: transparent; }
  }
  .p2m-prompt {
    border: 1px solid hsl(var(--border));
    border-left: 2px solid hsl(var(--chip));
    padding: 12px 14px;
    margin: 0;
    font-size: 14.5px;
    line-height: 1.55;
    user-select: all;
  }
  .p2m-note {
    font-size: 12px;
    line-height: 1.5;
    color: hsl(var(--muted-foreground));
    margin: 10px 0 0;
  }
  .p2m-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
    margin: 22px 0 10px;
  }
  .p2m-btn {
    background: none;
    border: 1px solid hsl(var(--border));
    cursor: pointer;
    font-size: 13px;
    padding: 10px 14px;
    color: hsl(var(--foreground));
    transition: background 0.15s, color 0.15s;
  }
  .p2m-btn:hover {
    background: hsl(var(--foreground));
    color: hsl(var(--background));
  }
  .p2m-btn-primary {
    background: hsl(var(--foreground));
    color: hsl(var(--background));
    border-color: hsl(var(--foreground));
  }
  .p2m-btn-primary:hover {
    background: hsl(var(--background));
    color: hsl(var(--foreground));
  }
  .p2m-btn[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .p2m-rows {
    margin: 12px 0 0;
    border: 1px solid hsl(var(--border));
  }
  .p2m-rows > div {
    display: grid;
    grid-template-columns: 128px 1fr;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px dashed hsl(var(--border));
  }
  .p2m-rows > div:last-child {
    border-bottom: 0;
  }
  .p2m-rows dt {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
    padding-top: 2px;
  }
  .p2m-rows dd {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .p2m-changes {
    margin: 12px 0 0;
    padding: 0 0 0 18px;
    font-size: 13.5px;
    line-height: 1.55;
  }
  .p2m-changes li {
    margin-bottom: 6px;
  }
  .p2m-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .p2m-brief-next {
    border-top: 1px dashed hsl(var(--border));
    margin-top: 14px;
    padding-top: 12px;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .p2m-disclaimer {
    font-size: 11.5px;
    color: hsl(var(--muted-foreground));
    line-height: 1.5;
    margin: 14px 0 0;
  }



  /* Reveal + status. */
  .p2m-status {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 70;
    background: hsl(var(--foreground));
    color: hsl(var(--background));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    padding: 8px 14px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
    max-width: calc(100vw - 32px);
    text-align: center;
  }
  .p2m-status.p2m-show {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .p2m-skel {
      animation: none;
      background-image: linear-gradient(hsl(var(--muted)), hsl(var(--muted)));
    }
    .p2m-fresh {
      animation: none;
    }
    .p2m-status {
      transition: none;
    }
    .p2m-btn {
      transition: none;
    }
  }
`;

function injectStyles() {
  if (document.getElementById("p2m-css")) return;
  const style = document.createElement("style");
  style.id = "p2m-css";
  style.textContent = P2M_CSS;
  document.head.append(style);
}

/* ── Discovery bridge: the shared inspectable tool array ──────────────── */

/* Browser agents without a native WebMCP surface (e.g. Claude in Chrome
   today) discover this site's tools by inspecting window.__hzWebMcpTools,
   the array the site-wide surface (WebMcp.astro) already exposes. Publish
   the personalization tools into the same array, in the same object shape,
   so every agent finds one complete, directly executable surface. Merge is
   idempotent; the late retries win over the site script overwriting the
   array after us (both load order and timing vary). */
function publishInspectableTools() {
  try {
    const mine = toolDefinitions();
    const existing = Array.isArray(window.__hzWebMcpTools) ? window.__hzWebMcpTools : [];
    window.__hzWebMcpTools = [
      ...existing.filter((tool) => !mine.some((m) => m.name === tool.name)),
      ...mine,
    ];
  } catch (error) {
    console.warn("[p2m] could not publish inspectable tools:", error);
  }
}

/* ── Registration: 30 s attach window + focus re-register ─────────────── */

let registeredContexts = new WeakSet();
let registeredContext = null;
let contextGenerations = 0;
let registrationInFlight = false;

/* Chrome's WebMCP prototype (imperative-api doc) expects execute to RETURN
   A STRING; an object return can break or blur to "[object Object]" in
   native clients (Chrome 149+ flag, ChatGPT in-app browser). Natively we
   register a wrapper returning the JSON text; the inspectable script
   surface (window.__hzWebMcpTools) keeps the dual object+content shape. */
function nativeToolShape(tool) {
  return {
    ...tool,
    execute: async (input, opts) => {
      const r = await tool.execute(input, opts);
      if (typeof r === "string") return r;
      const text = r?.content?.[0]?.text;
      if (typeof text === "string") return text;
      try { return JSON.stringify(r); } catch { return String(r); }
    },
  };
}

async function registerWebMcpTools() {
  if (registrationInFlight) return;
  const context = document.modelContext ?? navigator.modelContext;
  if (!context || typeof context.registerTool !== "function") return;
  if (context === registeredContext || registeredContexts.has(context)) return;
  /* Guard against clients that hand out a fresh proxy per access: after a
     few distinct context objects, stop re-registering instead of looping. */
  contextGenerations++;
  if (contextGenerations > 3) {
    console.warn("[p2m] modelContext identity keeps changing; keeping the first registrations.");
    return;
  }
  registrationInFlight = true;
  let registered = 0;
  /* Register the WHOLE shared surface, not just our five: the site-wide
     script registers its four tools only once at load, so a client that
     attaches late would natively see just ours (Opus field finding,
     2026-08-30). Never abort earlier registrations: some clients treat an
     abort as deregistration (Comet preview finding, 2026-08-31). */
  const surface = Array.isArray(window.__hzWebMcpTools) && window.__hzWebMcpTools.length
    ? window.__hzWebMcpTools
    : toolDefinitions();
  for (const tool of surface) {
    try {
      await context.registerTool(nativeToolShape(tool));
      registered++;
    } catch (error) {
      console.warn(`[p2m] registerTool rejected: ${tool.name}`, error);
    }
  }
  registeredContexts.add(context);
  registeredContext = context;
  state.toolCount = registered;
  document.body.dataset.p2mToolCount = String(registered);
  registrationInFlight = false;
  if (registered) console.info(`[p2m] registered ${registered} tools on modelContext`);
  renderPill();
}

/* ── Init ─────────────────────────────────────────────────────────────── */

try {
  capturePage();
  injectStyles();
  buildDialog();
  buildBanner();
  buildStatus();
  buildNavButtons();
  swapHeroCta();
  renderPill();

  window.__p2m = {
    ready: true,
    get state() {
      return {
        mode: state.mode,
        toolCount: state.toolCount,
        sectionsWritten: [...state.written.keys()],
        sectionsRemaining: sectionsRemaining(),
        fieldCount: dom.fields.size,
      };
    },
    get tools() { return toolDefinitions(); },
    get blueprint() { return blueprint(); },
    startPersonalization,
    writeSection,
    showDecisionBrief,
    resetExperience,
    openDialog,
  };

  publishInspectableTools();
  setTimeout(publishInspectableTools, 0);
  setTimeout(publishInspectableTools, 1200);
  setTimeout(publishInspectableTools, 4000);

  registerWebMcpTools();
  /* Keep knocking forever: browser agents may inject modelContext only when
     their panel opens, minutes after load (Comet, 2026-08-31). The check is
     two property reads per second while unregistered; once registered, the
     identity guard makes it a no-op. */
  const attachTimer = setInterval(registerWebMcpTools, 1000);
  for (const eventName of ["focus", "visibilitychange", "pageshow"]) {
    window.addEventListener(eventName, () => registerWebMcpTools());
  }
  window.addEventListener("pagehide", () => clearInterval(attachTimer));
} catch (error) {
  console.error("[p2m] Pitch-it-to-me layer disabled:", error);
}
