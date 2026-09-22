const RECEIPT_RE = /^[A-Z]{3}[A-Z0-9*]{10}$/;

export function normalizeReceipt(raw: string): string {
  return raw.replace(/[-\s]/g, "").toUpperCase();
}

export function isValidReceipt(raw: string): boolean {
  return RECEIPT_RE.test(normalizeReceipt(raw));
}

export function findReceiptInText(text: string): string | null {
  const match = text.toUpperCase().match(/\b([A-Z]{3}[A-Z0-9*]{10})\b/);
  return match ? match[1] : null;
}
