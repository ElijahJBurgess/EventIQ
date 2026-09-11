import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp } from "./startup";

describe("startApp", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement("div"); document.body.append(root);
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("auth-fixture", "retained");
  });
  afterEach(() => { root.remove(); vi.doUnmock("./bootstrap"); vi.unstubAllEnvs(); vi.restoreAllMocks(); localStorage.clear(); });

  it.each([
    ["VITE_SUPABASE_URL", ""], ["VITE_SUPABASE_PUBLISHABLE_KEY", ""],
    ["VITE_SUPABASE_URL", "malformed-secret-value"],
  ])("does not load the app when %s is invalid", async (name, value) => {
    vi.stubEnv(name, value);
    const load = vi.fn();
    await startApp(root, load);
    expect(load).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).toHaveTextContent("Unable to start");
    expect(root.textContent).not.toContain("malformed-secret-value");
    expect(root.querySelector("button")).toHaveTextContent("Reload");
    expect(root.querySelector("a")).toHaveAttribute("href", "/");
    expect(localStorage.getItem("auth-fixture")).toBe("retained");
  });

  it.each(["rejected import", "module evaluation", "synchronous mount"])("recovers from %s failure", async (failure) => {
    const error = new Error("private diagnostic with credential");
    // A module factory throwing models a top-level evaluation failure during import.
    if (failure === "module evaluation") vi.doMock("./bootstrap", () => { throw error; });
    const load = failure === "synchronous mount"
      ? async () => ({ mountApp() { throw error; } })
      : failure === "module evaluation"
        ? () => import("./bootstrap")
        : () => Promise.reject(error);
    await startApp(root, load);
    expect(root.querySelector('[role="alert"]')).toHaveTextContent("Unable to start");
    expect(root.textContent).not.toContain(error.message);
    expect(console.error).not.toHaveBeenCalledWith(expect.anything(), error);
    expect(localStorage.getItem("auth-fixture")).toBe("retained");
  });

  it("mounts successfully and can recover after configuration is corrected", async () => {
    const mountApp = vi.fn((element: HTMLElement) => { element.textContent = "App ready"; });
    const load = vi.fn(async () => ({ mountApp }));
    vi.stubEnv("VITE_SUPABASE_URL", "");
    await startApp(root, load);
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    await startApp(root, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(mountApp).toHaveBeenCalledWith(root);
    expect(root).toHaveTextContent("App ready");
    expect(localStorage.getItem("auth-fixture")).toBe("retained");
  });
});
