import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // The full-Dashboard render tests do a lot of work per test; 5s is marginal
    // once the suite runs enough files in parallel. Give every test headroom so
    // load-related flakiness doesn't masquerade as a real failure.
    testTimeout: 15000,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/match-engine/scorer.test.ts",
      "supabase/functions/match-engine/canonical.test.ts",
      "supabase/functions/admin-auth/stats.test.ts",
      "supabase/functions/admin-auth/insights.test.ts",
      "supabase/functions/admin-auth/report.test.ts",
      "supabase/functions/admin-auth/createEvent.test.ts",
      "supabase/functions/delete-account/deletion.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
