export type ParsedStatus = {
  statusTitle: string;
  description: string;
  formType?: string;
  eventDate?: string;
  lookupOk: boolean;
  error?: string;
};

const NOISE_TITLES = new Set([
  "case status online",
  "check case status",
  "related tools",
  "change of address",
  "submit a case inquiry",
  "uscis processing times information",
  "uscis office locations",
  "already have an account?",
  "login",
]);

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},\\s+\\d{4}\\b`);
const FORM_RE = /\bForm\s+([A-Z]-?\d+[A-Z]?)\b/i;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractFormAndDate(description: string): {
  formType?: string;
  eventDate?: string;
} {
  const form = description.match(FORM_RE)?.[1]?.toUpperCase();
  const eventDate = description.match(DATE_RE)?.[0];
  return {
    formType: form ? form.replace(/^(I|N|G|AR)(\d)/, "$1-$2") : undefined,
    eventDate,
  };
}

function isNoiseTitle(title: string): boolean {
  return NOISE_TITLES.has(title.trim().toLowerCase());
}

export function parseHtml(html: string): ParsedStatus {
  const headerMatch = html.match(
    /<h2[^>]*id=["']landing-page-header["'][^>]*>([\s\S]*?)<\/h2>/i,
  );
  if (!headerMatch) {
    return {
      statusTitle: "No public status heading",
      description: "",
      lookupOk: false,
      error: "missing-header",
    };
  }
  const statusTitle = clean(headerMatch[1].replace(/<[^>]+>/g, ""));
  if (isNoiseTitle(statusTitle)) {
    return {
      statusTitle,
      description: "",
      lookupOk: false,
      error: "still-on-landing-form",
    };
  }
  const after = html.slice(html.indexOf(headerMatch[0]) + headerMatch[0].length);
  const pMatch = after.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const description = pMatch
    ? clean(pMatch[1].replace(/<[^>]+>/g, " "))
    : "";
  const extras = extractFormAndDate(description);
  return {
    statusTitle,
    description,
    lookupOk: true,
    ...extras,
  };
}

export function parseMarkdown(markdown: string): ParsedStatus {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title: string | null = null;
  const body: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      const candidate = clean(heading[1]);
      if (!title && !isNoiseTitle(candidate)) {
        title = candidate;
        continue;
      }
      if (title && isNoiseTitle(candidate)) {
        break;
      }
      if (title) break;
      continue;
    }
    if (title) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("Enter Another Receipt") ||
        trimmed.startsWith("Check Status")
      ) {
        break;
      }
      if (trimmed.length > 0) body.push(trimmed);
    }
  }
  if (!title) {
    return {
      statusTitle: "No public status heading",
      description: "",
      lookupOk: false,
      error: "missing-markdown-heading",
    };
  }
  const description = clean(body.join(" "));
  const extras = extractFormAndDate(description);
  return {
    statusTitle: title,
    description,
    lookupOk: true,
    ...extras,
  };
}

export function parseUscisStatus(input: {
  markdown?: string;
  html?: string;
}): ParsedStatus {
  if (input.html) {
    const fromHtml = parseHtml(input.html);
    if (fromHtml.lookupOk) return fromHtml;
    if (input.markdown) {
      const fromMd = parseMarkdown(input.markdown);
      if (fromMd.lookupOk) return fromMd;
    }
    return fromHtml;
  }
  if (input.markdown) return parseMarkdown(input.markdown);
  return {
    statusTitle: "No status text",
    description: "",
    lookupOk: false,
    error: "empty-fetch",
  };
}

export function snapshotHash(parsed: ParsedStatus): string {
  return [
    parsed.statusTitle,
    parsed.description,
    parsed.formType ?? "",
    parsed.eventDate ?? "",
  ].join("\n---\n");
}
