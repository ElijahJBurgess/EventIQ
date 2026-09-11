import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./App", () => ({ default: function BrokenApp(): never { throw new Error("provider failure"); } }));
import { mountApp } from "./bootstrap";

describe("bootstrap", () => {
  afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

  it("places recovery above the entire App and its providers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    document.body.append(root);
    await act(async () => { mountApp(root); });
    expect(root.querySelector('[role="alert"]')).toHaveTextContent("Something went wrong");
    expect(root.querySelector("button")).toHaveTextContent("Reload");
  });
});
