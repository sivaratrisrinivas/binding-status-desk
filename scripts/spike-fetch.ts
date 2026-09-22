import { Firecrawl } from "firecrawl";
import { parseUscisStatus } from "../convex/lib/parseStatus.ts";

const receipt = process.argv[2] ?? "IOE0900000001";
const firecrawl = new Firecrawl();
const value = JSON.stringify(receipt);
const script = `(() => { const el = document.getElementById("receipt_number"); if (!el) return; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(el, ${value}); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); })();`;

const doc = await firecrawl.scrape("https://egov.uscis.gov/", {
  formats: ["markdown", "html"],
  waitFor: 1500,
  timeout: 90_000,
  actions: [
    { type: "wait", milliseconds: 2000 },
    { type: "executeJavascript", script },
    { type: "wait", milliseconds: 800 },
    { type: "click", selector: "button[name=initCaseSearch]" },
    { type: "wait", milliseconds: 7000 },
  ],
});

const parsed = parseUscisStatus({ markdown: doc.markdown, html: doc.html });
console.log(JSON.stringify({ lookupOk: parsed.lookupOk, ...parsed }, null, 2));
if (!parsed.lookupOk) process.exit(1);
