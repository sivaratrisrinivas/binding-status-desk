/** Stable inbound-mail dedupe key shared by webhook and inbox poll. */
export function inboundMessageDedupeId(input: {
  messageId?: string | null;
  message_id?: string | null;
  id?: string | null;
  eventId?: string | null;
  event_id?: string | null;
}): string | null {
  const messageId =
    input.messageId?.trim() ||
    input.message_id?.trim() ||
    input.id?.trim() ||
    "";
  if (messageId) return messageId;
  const eventId = input.eventId?.trim() || input.event_id?.trim() || "";
  return eventId || null;
}
