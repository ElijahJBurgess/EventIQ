import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Landing from "./Landing";

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string },
    loading: false,
  },
  maybeSingle: vi.fn(),
}));

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  },
}));

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/v2/auth" element={<div>OFFRIP auth</div>} />
        <Route path="/v2/setup" element={<div>OFFRIP onboarding</div>} />
        <Route path="/v2" element={<div>OFFRIP dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.auth.loading = false;
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
});

afterEach(cleanup);

describe("Landing intentional app entry", () => {
  it("keeps a logged-out visitor on the public homepage until they choose to sign in", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /Know.*Off rip/i })).toBeInTheDocument();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("OFFRIP auth")).toBeInTheDocument();
  });

  it("keeps a direct visit and refresh of / on the public landing page", () => {
    mocks.auth.user = { id: "complete-user" };
    const firstVisit = renderLanding();
    expect(screen.getByRole("heading", { level: 1, name: /Know.*Off rip/i })).toBeInTheDocument();
    firstVisit.unmount();

    renderLanding();
    expect(screen.getByRole("heading", { level: 1, name: /Know.*Off rip/i })).toBeInTheDocument();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("keeps an incomplete authenticated user on the homepage and sends deliberate entry to onboarding", async () => {
    mocks.auth.user = { id: "incomplete-user" };
    mocks.maybeSingle.mockResolvedValue({ data: { profile_completed: false }, error: null });
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /Know.*Off rip/i })).toBeInTheDocument();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enter OFFRIP" }));
    expect(await screen.findByText("OFFRIP onboarding")).toBeInTheDocument();
  });

  it("keeps a complete authenticated user on the homepage and sends deliberate entry to the dashboard", async () => {
    mocks.auth.user = { id: "complete-user" };
    mocks.maybeSingle.mockResolvedValue({ data: { profile_completed: true }, error: null });
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /Know.*Off rip/i })).toBeInTheDocument();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Get in the room" }));
    await waitFor(() => expect(screen.getByText("OFFRIP dashboard")).toBeInTheDocument());
  });
});
