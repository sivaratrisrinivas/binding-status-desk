import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHtml, parseMarkdown, parseUscisStatus } from "../convex/lib/parseStatus.ts";

const markdown = readFileSync(
  new URL("../docs/fixtures/uscis-delivered.md", import.meta.url),
  "utf8",
);

const fromMd = parseMarkdown(markdown);
assert.equal(fromMd.lookupOk, true);
assert.equal(fromMd.statusTitle, "Card Was Delivered To Me By The Post Office");
assert.match(fromMd.description, /August 10, 2015/);
assert.equal(fromMd.eventDate, "August 10, 2015");

const html = `<h2 id="landing-page-header">Case Is Being Actively Reviewed By USCIS</h2><p>On May 1, 2024, we are actively reviewing your Form I-765, Receipt Number MSC2190012345.</p>`;
const fromHtml = parseHtml(html);
assert.equal(fromHtml.lookupOk, true);
assert.equal(fromHtml.statusTitle, "Case Is Being Actively Reviewed By USCIS");
assert.equal(fromHtml.formType, "I-765");
assert.equal(fromHtml.eventDate, "May 1, 2024");

const landing = parseUscisStatus({
  markdown: "# Case Status Online\n\n## Check Case Status\n\nEnter a Receipt Number\n",
});
assert.equal(landing.lookupOk, false);

console.log("parse tests passed");
