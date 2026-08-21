import { supabase } from "@/integrations/supabase/client";

export interface ConciergeHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeRequestPayload {
  question: string;
  eventId: string;
  requestId: string;
  history: ConciergeHistoryItem[];
  timezone?: string;
}

export type ConciergeContextStatus = "ready" | "profile_completion_required" | "no_matches" | "no_people_checked_in";

export interface ConciergePersonResult {
  profileId: string;
  matchId: string;
  name: string;
  title: string | null;
  company: string | null;
  matchScore: number;
  reason: string | null;
}

export interface ConciergeMeetingResult {
  meetingId: string;
  matchId: string;
  otherProfileId: string;
  otherName: string;
  scheduledAt: string | null;
  duration: number | null;
  location: string | null;
  status: "accepted" | "scheduled";
}

export interface ConciergeEdgeResponse {
  success: true;
  requestId: string;
  eventId: string;
  answer?: string;
  people: ConciergePersonResult[];
  meetings: ConciergeMeetingResult[];
  context: {
    status: ConciergeContextStatus;
    authenticatedUserId: string;
    event: { id: string; name: string };
    checkedInMatchCount: number;
    conversationCount: number;
    activeMeetingCount: number;
    allowedMatchIds: string[];
    allowedProfileIds: string[];
  };
}

export type ConciergeInvokeResult =
  | { ok: true; response: ConciergeEdgeResponse }
  | {
      ok: false;
      kind: "auth" | "room_access" | "rate_limit" | "timeout" | "network" | "server";
      status?: number;
    };

interface FunctionsClient {
  functions: {
    invoke<T>(name: string, options: { body: Record<string, unknown>; timeout: number }): Promise<{
      data: T | null;
      error: null | { name?: string; message?: string; context?: unknown };
    }>;
  };
}

function errorStatus(error: { context?: unknown }) {
  return error.context instanceof Response ? error.context.status : undefined;
}

export async function invokeConciergeEdge(
  payload: ConciergeRequestPayload,
  client: FunctionsClient = supabase,
): Promise<ConciergeInvokeResult> {
  try {
    const { data, error } = await client.functions.invoke<ConciergeEdgeResponse>("concierge", {
      body: payload,
      timeout: 20_000,
    });

    if (error) {
      const status = errorStatus(error);
      if (status === 401) return { ok: false, kind: "auth", status };
      if (status === 403) return { ok: false, kind: "room_access", status };
      if (status === 429) return { ok: false, kind: "rate_limit", status };
      const errorText = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase();
      if (errorText.includes("timeout") || errorText.includes("abort")) {
        return { ok: false, kind: "timeout", status };
      }
      if (!status || errorText.includes("fetch") || errorText.includes("network")) {
        return { ok: false, kind: "network", status };
      }
      return { ok: false, kind: "server", status };
    }

    if (!data?.success || !data.context?.status || !Array.isArray(data.people) || !Array.isArray(data.meetings)) {
      return { ok: false, kind: "server" };
    }
    if (data.context.status === "ready" && !data.answer?.trim()) return { ok: false, kind: "server" };
    return { ok: true, response: data };
  } catch (error) {
    const text = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : "";
    return { ok: false, kind: text.includes("timeout") || text.includes("abort") ? "timeout" : "network" };
  }
}
