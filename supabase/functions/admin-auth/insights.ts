// LLM helpers for the Enterprise dashboard "Insights" tab. Deliberately
// import-clean (type-only import from stats.ts) so it runs under Vitest --
// see supabase/functions/admin-auth/insights.test.ts.
//
// The OpenAI Responses-API client mirrors supabase/functions/concierge/openai.ts
// (same provider + key: OOO_Intellegence_Open_API_Key). The model only ever
// sees the aggregated EventStats payload -- never raw database rows.
import type { EventStats } from "./stats.ts";

export const INSIGHTS_MODEL_DEFAULT = "gpt-5.4-mini";

export const INSIGHTS_SYSTEM_INSTRUCTIONS =
  `You write short factual observations about an OFFRIP networking event for its organizer.

Rules:
- Use ONLY the numbers present in the supplied EventStats JSON. Never invent, estimate, or extrapolate a figure that is not in the data.
- Every insight must be something a reader could verify by pointing at a field in the data.
- Do not speculate about causes, do not give recommendations, do not predict future events.
- Do not mention any person; the data contains no names or PII and must stay that way.
- Each insight is a single plain-language sentence under 30 words.
- Return 3 to 5 insights, most notable first.`;

export const COPILOT_SYSTEM_INSTRUCTIONS =
  `You are the OFFRIP Organizer Copilot. You answer an organizer's question about their event using ONLY the supplied EventStats JSON.

Rules:
- Use only numbers present in the data. If the data cannot answer the question, say so plainly.
- Never invent people, scores, or figures. Give a recommendation only if the question explicitly asks what the organizer should do.
- Keep the answer to 2-4 sentences, concrete, citing the relevant numbers.
- Never mention a person or any PII.`;

export interface OpenAIResponsesClient {
  create(input: Record<string, unknown>): Promise<{ body: unknown; requestId?: string }>;
}

export class InsightsProviderError extends Error {
  constructor(
    public readonly providerCode: string,
    public readonly providerRequestId?: string,
  ) {
    super("Insights provider request failed");
  }
}

const INSIGHTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    insights: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
  },
  required: ["insights"],
} as const;

const COPILOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { answer: { type: "string" } },
  required: ["answer"],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Extract the model's text output from an OpenAI Responses payload -- handles
// both `output_text` and the `output[].content[]` shape (same as concierge).
function extractOutputText(body: unknown): string {
  if (!isRecord(body)) throw new Error("malformed");
  const direct = typeof body.output_text === "string" ? body.output_text : null;
  const nested = Array.isArray(body.output)
    ? body.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .find((part) => isRecord(part) && part.type === "output_text" && typeof part.text === "string")
    : null;
  const text = direct ?? (isRecord(nested) && typeof nested.text === "string" ? nested.text : null);
  if (typeof text !== "string") throw new Error("malformed");
  return text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("malformed");
  }
}

export async function generateEventInsights(
  client: OpenAIResponsesClient,
  stats: EventStats,
  model = INSIGHTS_MODEL_DEFAULT,
): Promise<string[]> {
  const response = await client.create({
    model,
    store: false,
    tools: [],
    instructions: INSIGHTS_SYSTEM_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `<EVENT_STATS_DATA_ONLY>\n${JSON.stringify(stats)}\n</EVENT_STATS_DATA_ONLY>`,
      },
    ],
    reasoning: { effort: "low" },
    max_output_tokens: 600,
    text: {
      format: { type: "json_schema", name: "offrip_event_insights", strict: true, schema: INSIGHTS_SCHEMA },
    },
  });

  let insights: string[];
  try {
    const parsed = parseJson(extractOutputText(response.body));
    if (!isRecord(parsed) || !Array.isArray(parsed.insights)) throw new Error("malformed");
    insights = parsed.insights
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 400))
      .slice(0, 5);
  } catch {
    throw new InsightsProviderError("malformed_response", response.requestId);
  }
  if (insights.length === 0) throw new InsightsProviderError("empty_response", response.requestId);
  return insights;
}

export async function generateCopilotAnswer(
  client: OpenAIResponsesClient,
  stats: EventStats,
  question: string,
  model = INSIGHTS_MODEL_DEFAULT,
): Promise<string> {
  const trimmed = question.trim().slice(0, 500);
  const response = await client.create({
    model,
    store: false,
    tools: [],
    instructions: COPILOT_SYSTEM_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Question: ${trimmed}\n\n<EVENT_STATS_DATA_ONLY>\n${JSON.stringify(stats)}\n</EVENT_STATS_DATA_ONLY>`,
      },
    ],
    reasoning: { effort: "low" },
    max_output_tokens: 400,
    text: {
      format: { type: "json_schema", name: "offrip_copilot_answer", strict: true, schema: COPILOT_SCHEMA },
    },
  });

  try {
    const parsed = parseJson(extractOutputText(response.body));
    if (!isRecord(parsed) || typeof parsed.answer !== "string" || !parsed.answer.trim()) throw new Error("malformed");
    return parsed.answer.trim().slice(0, 1500);
  } catch {
    throw new InsightsProviderError("malformed_response", response.requestId);
  }
}

export function createOpenAIResponsesClient(apiKey: string, timeoutMs = 18_000): OpenAIResponsesClient {
  return {
    async create(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        const requestId = response.headers.get("x-request-id") ?? undefined;
        const body = await response.json();
        if (!response.ok) {
          const providerCode = isRecord(body) && isRecord(body.error) && typeof body.error.code === "string"
            ? body.error.code
            : `http_${response.status}`;
          throw new InsightsProviderError(providerCode, requestId);
        }
        return { body, requestId };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export async function fingerprintStats(stats: EventStats): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stats));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
