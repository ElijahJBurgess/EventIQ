export type ConciergeTelemetryStatus = "success" | "controlled_failure" | "provider_failure";

interface InsertResult { error: null | { code?: string } }
interface InsertBuilder { insert(row: Record<string, unknown>): Promise<InsertResult> }
export interface ConciergeTelemetryClient { from(table: "concierge_logs"): InsertBuilder }

export interface ConciergeTelemetryEntry {
  requestId: string;
  userId: string;
  eventId: string;
  status: ConciergeTelemetryStatus;
  recommendedMatchIds?: string[];
  providerRequestId?: string;
  providerErrorCode?: string;
}

export async function logConciergeSearch(
  client: ConciergeTelemetryClient,
  entry: ConciergeTelemetryEntry,
): Promise<"inserted" | "duplicate"> {
  const context: Record<string, string> = {
    source: "concierge_v1",
    request_id: entry.requestId,
    user_id: entry.userId,
    event_id: entry.eventId,
    status: entry.status,
  };
  if (entry.providerRequestId) context.openai_request_id = entry.providerRequestId;
  if (entry.providerErrorCode) context.provider_error_code = entry.providerErrorCode;
  const { error } = await client.from("concierge_logs").insert({
    prompt: "[redacted]",
    recommended_matches: [...new Set(entry.recommendedMatchIds ?? [])],
    context,
  });
  if (!error) return "inserted";
  if (error.code === "23505") return "duplicate";
  throw new Error("Concierge telemetry write failed");
}
