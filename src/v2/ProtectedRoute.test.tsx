import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const mocks = vi.hoisted(() => ({
  authState: { user: null as unknown, loading: false },
  maybeSingle: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({ useAuth: () => mocks.authState }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  },
}));

afterEach(cleanup);

function renderProtected(requireCompletedProfile = false) {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <Routes>
        <Route path="/v2/auth" element={<div>Sign in screen</div>} />
        <Route path="/v2/setup" element={<div>Profile setup</div>} />
        <Route path="/v2" element={<ProtectedRoute requireCompletedProfile={requireCompletedProfile}><div>Attendee dashboard</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects without an authenticated user", () => {
    mocks.authState.user = null;
    mocks.authState.loading = false;
    renderProtected();
    expect(screen.getByText("Sign in screen")).toBeInTheDocument();
  });

  it("renders protected content only for an authenticated user", () => {
    mocks.authState.user = { id: "authenticated-user" };
    mocks.authState.loading = false;
    renderProtected();
    expect(screen.getByText("Attendee dashboard")).toBeInTheDocument();
  });

  it("does not render protected content while session validation is pending", () => {
    mocks.authState.user = null;
    mocks.authState.loading = true;
    renderProtected();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Attendee dashboard")).not.toBeInTheDocument();
  });

  it("redirects an authenticated user with an incomplete profile to setup", async () => {
    mocks.authState.user = { id: "incomplete-user" };
    mocks.authState.loading = false;
    mocks.maybeSingle.mockResolvedValue({ data: { profile_completed: false }, error: null });
    renderProtected(true);

    expect(await screen.findByText("Profile setup")).toBeInTheDocument();
    expect(screen.queryByText("Attendee dashboard")).not.toBeInTheDocument();
  });

  it("renders the dashboard for an authenticated user with a completed profile", async () => {
    mocks.authState.user = { id: "complete-user" };
    mocks.authState.loading = false;
    mocks.maybeSingle.mockResolvedValue({ data: { profile_completed: true }, error: null });
    renderProtected(true);

    expect(await screen.findByText("Attendee dashboard")).toBeInTheDocument();
  });
});
