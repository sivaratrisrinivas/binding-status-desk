export type SnapshotFields = {
  statusTitle: string;
  description: string;
  formType?: string;
  eventDate?: string;
};

export function diffFields(
  before: SnapshotFields | null,
  after: SnapshotFields,
): string[] {
  if (!before) return [];
  const changed: string[] = [];
  if (before.statusTitle !== after.statusTitle) changed.push("statusTitle");
  if (before.description !== after.description) changed.push("description");
  if ((before.formType ?? "") !== (after.formType ?? "")) changed.push("formType");
  if ((before.eventDate ?? "") !== (after.eventDate ?? "")) changed.push("eventDate");
  return changed;
}

export function fallbackPlainLanguage(
  before: SnapshotFields | null,
  after: SnapshotFields,
): string {
  if (!before) {
    return `The public Case Status Online page currently shows “${after.statusTitle}.” This is a restatement of public website text, not legal advice.`;
  }
  if (before.statusTitle !== after.statusTitle) {
    return `The public status heading changed from “${before.statusTitle}” to “${after.statusTitle}.” This restates the public page only. It is not legal advice and does not predict what happens next.`;
  }
  return `The public description text on Case Status Online changed, while the heading stayed “${after.statusTitle}.” This restates the public page only. It is not legal advice.`;
}
