# USCIS Firecrawl spike (2026-09-22)

This is the public Case Status Online lookup at
[https://egov.uscis.gov/](https://egov.uscis.gov/). We did **not** use the
USCIS developer Case Status API (production access requires USCIS approval).
We did **not** log in.

## Naive HTTP

`GET https://egov.uscis.gov/` and the legacy
`/casestatus/mycasestatus.do?appReceiptNum=…` URL both return **HTTP 403**
from Cloudflare (`server: cloudflare`, `Attention Required! | Cloudflare`).
A cookieless fetch cannot see the form.

## Firecrawl scrape of the landing page

Keyless Firecrawl CLI scrape of `https://egov.uscis.gov/` **does** return the
public form, including:

- `#receipt_number` text input (`maxlength="13"`, placeholder `EAC1234567890`)
- `button[name=initCaseSearch]` titled “Check Status”, **disabled** until the
  field is filled
- No Turnstile/reCAPTCHA markup in the scraped HTML for this session

Exact scrape request shape that worked for the **result** page:

```json
POST https://api.firecrawl.dev/v2/scrape
{
  "url": "https://egov.uscis.gov/",
  "formats": ["markdown", "html"],
  "waitFor": 1500,
  "timeout": 90000,
  "actions": [
    { "type": "wait", "milliseconds": 2000 },
    {
      "type": "executeJavascript",
      "script": "(() => { const el = document.getElementById('receipt_number'); if (!el) return; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(el, RECEIPT); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })();"
    },
    { "type": "wait", "milliseconds": 800 },
    { "type": "click", "selector": "button[name=initCaseSearch]" },
    { "type": "wait", "milliseconds": 7000 }
  ]
}
```

The React-controlled input ignores a bare DOM `.value = …` assignment. The
native value setter plus `input`/`change` events is required so “Check Status”
enables.

## Parsed fields from a live result

Test receipt `IOE0900000001` (a public sample that Case Status Online answers):

| Field | Selector / rule | Example |
| --- | --- | --- |
| Status title | `h2#landing-page-header` | Card Was Delivered To Me By The Post Office |
| Description | first `<p>` after that heading | On August 10, 2015, the Post Office delivered… |
| Form type | `Form X-###` in the description, when present | often absent |
| Event date | `Month D, YYYY` in the description | August 10, 2015 |

If the heading is still “Check Case Status”, the submit did not leave the
landing form (captcha/WAF or disabled button). That is treated as a failed
lookup, not a status.

## What did not work

- Firecrawl **Interact** (`POST /v2/scrape/{id}/interact`) returned
  `Forbidden` on the keyless free tier. Product polling uses scrape+actions,
  not Interact.
- Clicking `button` without filling `#receipt_number` via the native setter
  left the landing form on screen.

## Fallback decision

**No product fallback.** Firecrawl returned usable public status text, so the
app stays on the USCIS Case Status Online wedge. A Chicago building-permit
URL was probed only as a contingency and is not used in the product.
