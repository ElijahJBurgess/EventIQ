/** Shared by the dependency-light browser entry and Vite's build preflight. */
export function validatePublicEnv(env: Record<string, unknown>): void {
  const invalid: string[] = [];
  const url = env.VITE_SUPABASE_URL;
  try {
    if (typeof url !== "string" || !url.trim()) throw new Error();
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
  } catch {
    invalid.push("VITE_SUPABASE_URL");
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof key !== "string" || !key.trim()) invalid.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  // Never include env values or underlying URL parser errors in diagnostics.
  if (invalid.length) throw new Error(`Invalid public configuration: ${invalid.join(", ")}`);
}
