import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthV2 from "./Auth";
import ResetPassword from "./ResetPassword";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  getUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  authState: {
    session: null as unknown,
    user: null as unknown,
    loading: false,
    isPasswordRecovery: false,
  },
}));

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => ({
    ...mocks.authState,
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    signOut: mocks.signOut,
    requestPasswordReset: mocks.requestPasswordReset,
    updatePassword: mocks.updatePassword,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

function renderReset() {
  return render(
    <MemoryRouter initialEntries={["/v2/reset-password"]}>
      <Routes>
        <Route path="/v2/reset-password" element={<ResetPassword />} />
        <Route path="/v2/auth" element={<div>Password updated. Sign in with your new password.</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authState.session = null;
  mocks.authState.user = null;
  mocks.authState.loading = false;
  mocks.authState.isPasswordRecovery = false;
  window.history.replaceState({}, "", "/");
});

afterEach(cleanup);

describe("forgot password", () => {
  it.each(["avery@example.com", "missing@example.com"])(
    "shows the same generic confirmation for %s",
    async (email) => {
      mocks.requestPasswordReset.mockResolvedValue({ error: null });
      render(<MemoryRouter><AuthV2 /></MemoryRouter>);

      fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
      fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: email } });
      fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "If an account exists for that email, you'll receive a password reset email shortly.",
      );
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith(email);
    },
  );
});

describe("reset password", () => {
  beforeEach(() => {
    mocks.authState.session = { access_token: "recovery-session" };
    mocks.authState.isPasswordRecovery = true;
  });

  it("shows the reset form for a valid recovery session", () => {
    renderReset();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("requires matching passwords", async () => {
    renderReset();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords must match.");
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it("shows a server password-policy error without signing out", async () => {
    mocks.updatePassword.mockResolvedValue({ error: "Password does not meet the configured policy." });
    renderReset();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "invalid-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "invalid-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Password does not meet the configured policy.");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("updates the password, signs out, and returns to sign in", async () => {
    mocks.updatePassword.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue(undefined);
    renderReset();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-secure-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith("new-secure-password"));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Password updated. Sign in with your new password.")).toBeInTheDocument();
  });

  it("shows the safe error state for an expired or reused link", () => {
    mocks.authState.session = null;
    mocks.authState.isPasswordRecovery = false;
    renderReset();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This password reset link is invalid, expired, or has already been used.",
    );
    expect(screen.getByRole("button", { name: "Request another reset email" })).toBeInTheDocument();
  });
});
