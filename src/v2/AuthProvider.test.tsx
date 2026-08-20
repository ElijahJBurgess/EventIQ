import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

const mocks = vi.hoisted(() => ({
  authCallback: null as null | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(),
  getSession: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      getSession: mocks.getSession,
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  },
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.loading ? "loading" : "ready"}</span>
      <span>{auth.isPasswordRecovery ? "recovering" : "standard"}</span>
      <button onClick={() => auth.requestPasswordReset("avery@example.com")}>Request reset</button>
      <button onClick={() => auth.updatePassword("new-secure-password")}>Update password</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authCallback = null;
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  sessionStorage.clear();
});

describe("AuthProvider password recovery", () => {
  it("requests the exact reset route and records PASSWORD_RECOVERY", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("ready");

    screen.getByRole("button", { name: "Request reset" }).click();
    await waitFor(() => {
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("avery@example.com", {
        redirectTo: `${window.location.origin}/v2/reset-password`,
      });
    });

    act(() => {
      mocks.authCallback?.("PASSWORD_RECOVERY", {
        access_token: "recovery-session",
        user: { id: "user-id" },
      });
    });

    expect(screen.getByText("recovering")).toBeInTheDocument();
    expect(sessionStorage.getItem("offrip-password-recovery")).toBe("true");
  });

  it("uses Supabase updateUser for the new password", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("ready");
    screen.getByRole("button", { name: "Update password" }).click();

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-secure-password" });
    });
  });
});
