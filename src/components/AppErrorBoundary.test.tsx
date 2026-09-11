import { Suspense, lazy } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function Broken(): never { throw new Error("test crash with secret credential"); }

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessionStorage.setItem("session-fixture", "signed-in");
    localStorage.setItem("auth-fixture", "retained");
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear(); });

  it("replaces a render crash with safe recovery controls and preserves session", () => {
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
    expect(document.body).not.toHaveTextContent("secret credential");
    expect(sessionStorage.getItem("session-fixture")).toBe("signed-in");
    expect(localStorage.getItem("auth-fixture")).toBe("retained");
  });

  it("catches failures in a provider above its route content", () => {
    function BrokenProvider(): never { throw new Error("provider crash"); }
    render(<AppErrorBoundary><BrokenProvider /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("catches rejected lazy route imports", async () => {
    const Route = lazy(() => Promise.reject(new Error("chunk failed")));
    render(<AppErrorBoundary><Suspense fallback="Loading"><Route /></Suspense></AppErrorBoundary>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("renders healthy children on a fresh mount after recovery", () => {
    const crashed = render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    crashed.unmount();
    render(<AppErrorBoundary><p>Recovered app</p></AppErrorBoundary>);
    expect(screen.getByText("Recovered app")).toBeVisible();
    expect(localStorage.getItem("auth-fixture")).toBe("retained");
  });
});
