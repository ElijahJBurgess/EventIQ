import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const authState = vi.hoisted(() => ({ user: null as unknown, loading: false }));

vi.mock("./AuthProvider", () => ({ useAuth: () => authState }));

afterEach(cleanup);

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <Routes>
        <Route path="/v2/auth" element={<div>Sign in screen</div>} />
        <Route path="/v2" element={<ProtectedRoute><div>Attendee dashboard</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects without an authenticated user", () => {
    authState.user = null;
    authState.loading = false;
    renderProtected();
    expect(screen.getByText("Sign in screen")).toBeInTheDocument();
  });

  it("renders protected content only for an authenticated user", () => {
    authState.user = { id: "authenticated-user" };
    authState.loading = false;
    renderProtected();
    expect(screen.getByText("Attendee dashboard")).toBeInTheDocument();
  });

  it("does not render protected content while session validation is pending", () => {
    authState.user = null;
    authState.loading = true;
    renderProtected();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Attendee dashboard")).not.toBeInTheDocument();
  });
});
