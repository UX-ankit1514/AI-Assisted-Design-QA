#!/usr/bin/env node
/*
 * Generates the bundled sample pair (PRD §17 Phase 5): one Arnifi-style homepage rendered twice with
 * system Chrome — the "Figma design" and the "developed website" with six intentional differences.
 * Both renders use the same fonts and engine, so every highlighted region is a real, known change.
 *
 * Writes public/samples/arnifi-home-design.png, arnifi-home-build.png and manifest.json (the bounding box
 * of each intentional change, used by the detection-rate test).
 *
 *   npm run samples
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/samples");
mkdirSync(out, { recursive: true });

const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(path.join(root, "node_modules/@fontsource", pkg, "files", file)).toString("base64")}`;
const logo = readFileSync(path.join(root, "public/brand/arnifi-logo.svg"), "utf8").replace(/width="\d+" height="\d+"/, 'width="126" height="35"');

const CHANGES = [
  { id: "hero-heading", label: "Hero heading set smaller" },
  { id: "header-cta", label: "Header CTA uses an off-token blue" },
  { id: "nav", label: "Navigation links spaced more tightly" },
  { id: "banking-icon", label: "Corporate banking icon missing" },
  { id: "visa-copy", label: "Visa card copy changed" },
  { id: "footer-links", label: "Footer links use a different colour" },
];

function html(build) {
  const icon = (glyph) => `<span class="icon">${glyph}</span>`;
  const svg = {
    building: '<svg viewBox="0 0 24 24"><path d="M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/></svg>',
    passport: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/></svg>',
    bank: '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    stamp: '<svg viewBox="0 0 24 24"><path d="M5 21h14M6 17h12l-1-4H7zM9 13V9a3 3 0 1 1 6 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  };
  const services = [
    ["building", "Company formation", "Mainland, free zone and offshore companies, set up end to end."],
    ["passport", "Visas & Emirates ID", build ? "Residence visas for you and your family members." : "Residence visas for founders, partners and family."],
    ["bank", "Corporate banking", "Introductions to UAE banks that fit your business model."],
    ["chart", "Accounting & tax", "Bookkeeping, VAT and corporate tax filings handled for you."],
    ["stamp", "PRO services", "Government paperwork, approvals and renewals on your behalf."],
    ["shield", "Trademarks", "Protect your brand name and logo across the GCC."],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(${font("inter", "inter-latin-400-normal.woff2")})}
@font-face{font-family:Inter;font-weight:500;src:url(${font("inter", "inter-latin-500-normal.woff2")})}
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter", "inter-latin-600-normal.woff2")})}
@font-face{font-family:Inter;font-weight:700;src:url(${font("inter", "inter-latin-700-normal.woff2")})}
@font-face{font-family:Lora;font-weight:500;src:url(${font("lora", "lora-latin-500-normal.woff2")})}
@font-face{font-family:Lora;font-weight:600;src:url(${font("lora", "lora-latin-600-normal.woff2")})}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1440px;font-family:Inter;color:#21272A;background:#fff;-webkit-font-smoothing:antialiased}
.wrap{width:1120px;margin:0 auto}
.announce{height:48px;background:#F5F5FF;display:flex;align-items:center;justify-content:center;font:500 15px/24px Inter;color:#6262CC;gap:8px}
.announce a{color:#2E2EA3;text-decoration:underline}
header{height:88px;border-bottom:1px solid #DDE1E6}
header .wrap{height:100%;display:flex;align-items:center;gap:40px}
nav{display:flex;gap:${build ? 24 : 32}px;font:500 15px/24px Inter;color:#4D5358;width:560px}
.chip{margin-left:auto;height:36px;padding:0 12px;border:1px solid #DDE1E6;border-radius:4px;background:#F7F3F2;display:flex;align-items:center;font:500 14px Inter}
.cta{display:inline-flex;height:48px;border-radius:2px;overflow:hidden;color:#fff;font:500 14px/20px Inter}
.cta span{display:flex;align-items:center;padding:0 20px;background:#2E2EA3}
.cta i{display:flex;width:48px;align-items:center;justify-content:center;background:#16167A;font-style:normal;font-size:20px}
.header-cta span{background:${build ? "#3939CC" : "#2E2EA3"}}
.hero{background:linear-gradient(#fff,#F5F5FF);padding:80px 0 96px}
.hero .wrap{display:grid;grid-template-columns:1fr 440px;gap:64px;align-items:center}
.eyebrow{font:600 12px/18px Inter;letter-spacing:.12em;color:#6262CC}
.hero-title{height:208px;margin-top:16px}
.hero h1{font:500 ${build ? "50px/62px" : "56px/68px"} Lora;letter-spacing:-.02em;color:#16167A}
.hero h1 em{font-style:normal;color:#6262CC}
.hero p.lead{margin-top:12px;font:400 18px/28px Inter;color:#697077;max-width:560px}
.actions{display:flex;gap:12px;margin-top:32px}
.ghost{height:48px;padding:0 20px;border:1px solid #DDE1E6;border-radius:2px;display:flex;align-items:center;font:500 14px Inter;background:#fff}
.trust{margin-top:28px;display:flex;gap:24px;font:500 14px/20px Inter;color:#4D5358}
.trust b{color:#16167A}
.panel{background:#fff;border:1px solid #DDE1E6;border-radius:10px;padding:28px;box-shadow:0 4px 8px rgb(0 0 0/.1),0 2px 6px rgb(0 0 0/.15)}
.panel h3{font:600 18px/24px Inter;color:#16167A}
.step{display:flex;gap:14px;align-items:center;margin-top:18px;font:500 14px/20px Inter}
.dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 12px Inter;color:#fff;background:#2E2EA3}
.dot.todo{background:#EBEBFF;color:#2E2EA3}
.bar{height:8px;border-radius:4px;background:#F2F4F8;margin-top:24px;overflow:hidden}.bar i{display:block;width:62%;height:100%;background:#6262CC}
section.services{padding:96px 0}
.title{text-align:center}
.title h2{font:500 36px/44px Lora;color:#16167A}
.title p{margin-top:12px;font:400 18px/28px Inter;color:#697077}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px}
.card{border:1px solid #DDE1E6;border-radius:8px;padding:28px;min-height:212px}
.icon{width:40px;height:40px;border-radius:6px;background:#EBEBFF;display:flex;align-items:center;justify-content:center}
.icon svg{width:22px;height:22px;fill:none;stroke:#2E2EA3;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.icon.empty{background:transparent}
.card h3{margin-top:20px;font:600 18px/24px Inter;color:#21272A}
.card p{margin-top:8px;font:400 15px/22px Inter;color:#697077}
.stats{background:#16167A;color:#fff;padding:64px 0}
.stats .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.stats b{display:block;font:500 44px/52px Lora}
.stats span{font:400 15px/22px Inter;color:#C7C7FF}
.how{padding:96px 0;background:#F7F3F2}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:48px}
.num{width:48px;height:48px;border-radius:50%;background:#6262CC;color:#fff;display:flex;align-items:center;justify-content:center;font:600 20px Inter}
.steps h3{margin-top:20px;font:600 18px/24px Inter}
.steps p{margin-top:8px;font:400 15px/22px Inter;color:#697077}
.quote{padding:96px 0}
.quote .box{border:1px solid #DDE1E6;border-radius:8px;padding:40px;display:flex;gap:32px;align-items:center}
.quote blockquote{font:400 20px/32px Inter;color:#21272A}
.quote mark{background:#EBEBFF;color:inherit;border-radius:4px;padding:0 4px}
.quote cite{display:block;margin-top:16px;font:600 15px Inter;font-style:normal;color:#16167A}
.avatar{width:72px;height:72px;border-radius:50%;background:#D6D6FF;flex:none;display:flex;align-items:center;justify-content:center;font:600 24px Inter;color:#2E2EA3}
.band{background:#F5F5FF;padding:64px 0}
.band .wrap{display:flex;align-items:center;justify-content:space-between}
.band h2{font:500 32px/40px Lora;color:#16167A}
footer{padding:64px 0 32px;border-top:1px solid #DDE1E6}
.cols{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px}
.cols h4{font:600 12px/18px Inter;letter-spacing:.12em;color:#6262CC}
.cols ul{list-style:none;margin-top:16px;display:grid;gap:10px;font:500 15px/22px Inter;color:#4D5358}
.cols .company{color:${build ? "#0958D9" : "#4D5358"}}
.addr{margin-top:16px;font:400 15px/24px Inter;color:#697077;max-width:300px}
.legal{margin-top:48px;padding-top:24px;border-top:1px solid #DDE1E6;display:flex;justify-content:space-between;font:400 13px/20px Inter;color:#697077}
</style></head><body>
<div class="announce">New: free zone licences from AED 5,750 <a>See packages</a></div>
<header><div class="wrap">${logo}
  <nav data-change="nav"><span>Company Setup</span><span>Visas</span><span>Banking</span><span>Accounting &amp; Tax</span><span>Pricing</span></nav>
  <span class="chip">AED</span>
  <a class="cta header-cta" data-change="header-cta"><span>Book a Free Consultation</span><i>→</i></a>
</div></header>
<section class="hero"><div class="wrap"><div>
  <p class="eyebrow">BUSINESS SETUP IN THE UAE</p>
  <div class="hero-title"><h1 data-change="hero-heading">Start your business in Dubai with <em>experts</em> by your side</h1></div>
  <p class="lead">Licences, visas, banking and compliance in one place — with a dedicated advisor from your first question to your first invoice.</p>
  <div class="actions"><a class="cta"><span>Get Started Today</span><i>→</i></a><a class="ghost">View Packages</a></div>
  <div class="trust"><span><b>4.9</b> average rating</span><span><b>10,000+</b> companies set up</span><span><b>7</b> countries</span></div>
</div>
<div class="panel"><h3>Your setup plan</h3>
  <div class="step"><span class="dot">✓</span>Choose your activity</div>
  <div class="step"><span class="dot">✓</span>Pick a free zone</div>
  <div class="step"><span class="dot">3</span>Submit documents</div>
  <div class="step"><span class="dot todo">4</span>Open your bank account</div>
  <div class="bar"><i></i></div>
</div></div></section>
<section class="services"><div class="wrap">
  <div class="title"><h2>Everything you need to set up</h2><p>One team for every step, from licence to launch.</p></div>
  <div class="grid">${services
    .map(([glyph, title, body]) => {
      const missing = build && glyph === "bank";
      const iconAttr = glyph === "bank" ? ' data-change="banking-icon"' : "";
      const copyAttr = glyph === "passport" ? ' data-change="visa-copy"' : "";
      return `<div class="card"><div${iconAttr}>${missing ? '<span class="icon empty"></span>' : icon(svg[glyph])}</div><h3>${title}</h3><p${copyAttr}>${body}</p></div>`;
    })
    .join("")}</div>
</div></section>
<section class="stats"><div class="wrap">
  <div><b>10,000+</b><span>companies formed</span></div><div><b>48 hrs</b><span>average licence approval</span></div>
  <div><b>30+</b><span>free zones covered</span></div><div><b>4.9/5</b><span>from 2,000+ reviews</span></div>
</div></section>
<section class="how"><div class="wrap">
  <div class="title"><h2>How it works</h2><p>Three steps, one advisor, no surprises.</p></div>
  <div class="steps">
    <div><span class="num">1</span><h3>Tell us about your business</h3><p>Answer a few questions and we recommend the right licence and location.</p></div>
    <div><span class="num">2</span><h3>We handle the paperwork</h3><p>Your advisor prepares, submits and tracks every application for you.</p></div>
    <div><span class="num">3</span><h3>Start trading</h3><p>Receive your licence, visas and bank account — ready to do business.</p></div>
  </div>
</div></section>
<section class="quote"><div class="wrap"><div class="box"><span class="avatar">SR</span><div>
  <blockquote>“Arnifi made our free zone setup <mark>simple and fast</mark>. We had our licence and bank account sorted <mark>within three weeks</mark>.”</blockquote>
  <cite>Sara Rahman, Founder at Lumen Studio</cite></div></div></div></section>
<section class="band"><div class="wrap"><h2>Ready to start your business?</h2><a class="cta"><span>Book a Free Consultation</span><i>→</i></a></div></section>
<footer><div class="wrap">
  <div class="cols">
    <div>${logo}<p class="addr">Office 1204, Bay Square 13, Business Bay, Dubai, United Arab Emirates</p></div>
    <div><h4>SERVICES</h4><ul><li>Company Setup</li><li>Visas</li><li>Banking</li><li>Accounting &amp; Tax</li></ul></div>
    <div data-change="footer-links"><h4>COMPANY</h4><ul class="company"><li>About Us</li><li>Careers</li><li>Partners</li><li>Contact</li></ul></div>
    <div><h4>RESOURCES</h4><ul><li>Guides</li><li>Free Zone Finder</li><li>Cost Calculator</li><li>FAQs</li></ul></div>
  </div>
  <div class="legal"><span>© 2026 Arnifi. All rights reserved.</span><span>Privacy Policy · Terms of Use · Cookie Settings</span></div>
</div></footer>
</body></html>`;
}

async function render(browser, build) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html(build), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const rects = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-change]")].map((el) => {
        const r = el.getBoundingClientRect();
        return [el.getAttribute("data-change"), { x: Math.floor(r.x), y: Math.floor(r.y + window.scrollY), width: Math.ceil(r.width), height: Math.ceil(r.height) }];
      }),
    ),
  );
  const png = await page.screenshot({ fullPage: true, animations: "disabled" });
  await page.close();
  return { png, rects };
}

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const design = await render(browser, false);
  const build = await render(browser, true);
  writeFileSync(path.join(out, "arnifi-home-design.png"), design.png);
  writeFileSync(path.join(out, "arnifi-home-build.png"), build.png);
  const width = design.png.readUInt32BE(16);
  const height = design.png.readUInt32BE(20);
  const manifest = {
    note: "Generated sample data with intentional differences. Not a real Arnifi page or capture.",
    width,
    height,
    changes: CHANGES.map((c) => ({ ...c, rect: union(design.rects[c.id], build.rects[c.id]) })),
  };
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${width} × ${height} sample pair with ${CHANGES.length} intentional changes to public/samples/`);
} finally {
  await browser.close();
}
