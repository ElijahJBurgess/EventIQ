import { createClient } from "npm:@supabase/supabase-js@2";
import { deleteAccount, type AccountDeletionPorts } from "./deletion.ts";

const PROFILE_PHOTO_BUCKET = "profile-photos";

const LOCAL_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const DEFAULT_REMOTE_ORIGINS = ["https://event-iq-six.vercel.app"];
const configuredOrigins = (Deno.env.get("DELETE_ACCOUNT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...LOCAL_ORIGINS, ...DEFAULT_REMOTE_ORIGINS, ...configuredOrigins]);

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function responseHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

type ServiceClient = ReturnType<typeof createClient>;

function buildPorts(service: ServiceClient): AccountDeletionPorts {
  return {
    async countOrganizedEvents(userId) {
      const { count, error } = await service
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("organizer_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
    async clearGeneratedReports(userId) {
      const { data, error } = await service
        .from("reports")
        .update({ generated_by: null })
        .eq("generated_by", userId)
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    async deleteProfilePhotos(userId) {
      const { data: objects, error: listError } = await service.storage
        .from(PROFILE_PHOTO_BUCKET)
        .list(userId);
      if (listError) throw listError;
      const paths = (objects ?? [])
        .filter((object: { name: string }) => object.name && object.name !== ".emptyFolderPlaceholder")
        .map((object: { name: string }) => `${userId}/${object.name}`);
      if (paths.length === 0) return 0;
      const { error: removeError } = await service.storage.from(PROFILE_PHOTO_BUCKET).remove(paths);
      if (removeError) throw removeError;
      return paths.length;
    },
    async deleteAuthUser(userId) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };
}

async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return json({ success: false, error: "Origin not allowed." }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed." }, 405, origin);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error("delete-account: Supabase environment is incomplete");
    return json({ success: false, error: "Unable to process request." }, 500, origin);
  }

  const authorizationHeader = request.headers.get("authorization") ?? "";
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  if (!bearerMatch?.[1]) {
    return json({ success: false, error: "Unauthorized." }, 401, origin);
  }

  // The only account this function will ever delete is the caller's own, taken
  // from their verified JWT. No user id is accepted from the request body.
  let userId: string;
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorizationHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.getUser(bearerMatch[1]);
    if (error || !data.user?.id) {
      return json({ success: false, error: "Unauthorized." }, 401, origin);
    }
    userId = data.user.id;
  } catch {
    return json({ success: false, error: "Unauthorized." }, 401, origin);
  }

  const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const result = await deleteAccount(userId, buildPorts(service));
    if (result.status === "blocked_organizer") {
      return json(
        {
          success: false,
          error: "organizer_has_events",
          organizedEventCount: result.organizedEventCount,
        },
        409,
        origin,
      );
    }
    return json(
      { success: true, clearedReports: result.clearedReports, deletedPhotos: result.deletedPhotos },
      200,
      origin,
    );
  } catch (error) {
    console.error(
      "delete-account handler error",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
    return json({ success: false, error: "Unable to process request." }, 500, origin);
  }
}

Deno.serve(handler);
