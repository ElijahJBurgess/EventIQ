import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildConciergeContext,
  createSupabaseContextSource,
  type ConciergeQueryClient,
} from "./context.ts";
import { createConciergeHandler, type ConciergeSupabaseClient } from "./handler.ts";
import {
  createOpenAIResponsesClient,
  DEFAULT_CONCIERGE_MODEL,
  generateConciergeAnswer,
} from "./openai.ts";
import { logConciergeSearch, type ConciergeTelemetryClient } from "./telemetry.ts";

const LOCAL_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const configuredOrigins = (Deno.env.get("CONCIERGE_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...LOCAL_ORIGINS, ...configuredOrigins]);

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAIApiKey = Deno.env.get("OOO_Intellegence_Open_API_Key");
const conciergeModel = Deno.env.get("CONCIERGE_OPENAI_MODEL") ?? DEFAULT_CONCIERGE_MODEL;

const openAI = openAIApiKey ? createOpenAIResponsesClient(openAIApiKey) : null;
const telemetryClient = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as ConciergeTelemetryClient
  : null;

const handler = createConciergeHandler({
  allowedOrigins,
  createClient: (authorizationHeader) => {
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase environment is unavailable");
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorizationHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as ConciergeSupabaseClient;
  },
  gatherContext: (client, authenticatedUserId, eventId) => buildConciergeContext(
    createSupabaseContextSource(client as unknown as ConciergeQueryClient),
    authenticatedUserId,
    eventId,
  ),
  answerQuestion: (context, question, history, timezone) => {
    if (!openAI) throw new Error("OpenAI environment is unavailable");
    return generateConciergeAnswer(openAI, context, question, history, timezone, conciergeModel);
  },
  logSearch: (entry) => {
    if (!telemetryClient) throw new Error("Telemetry environment is unavailable");
    return logConciergeSearch(telemetryClient, entry);
  },
});

Deno.serve(handler);
