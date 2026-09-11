import { describe, expect, it } from "vitest";
import { validatePublicEnv } from "./publicEnv";

const valid = { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-key" };
describe("validatePublicEnv", () => {
  it("accepts a valid public configuration", () => expect(() => validatePublicEnv(valid)).not.toThrow());
  it.each([
    ["VITE_SUPABASE_URL", undefined], ["VITE_SUPABASE_URL", ""],
    ["VITE_SUPABASE_URL", "secret-invalid-url"], ["VITE_SUPABASE_URL", "javascript:secret"],
    ["VITE_SUPABASE_PUBLISHABLE_KEY", undefined], ["VITE_SUPABASE_PUBLISHABLE_KEY", "   "],
  ])("rejects invalid %s without exposing values", (name, value) => {
    expect(() => validatePublicEnv({ ...valid, [name]: value })).toThrow(`Invalid public configuration: ${name}`);
  });
});
