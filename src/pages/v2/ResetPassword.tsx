import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { meetsPasswordMinimum, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT_MESSAGE } from "@/lib/authSecurity";

function hasRecoveryError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(query.get("error") || query.get("error_code") || hash.get("error") || hash.get("error_code"));
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading, isPasswordRecovery, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidRecovery = !loading && (hasRecoveryError() || !session || !isPasswordRecovery);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords must match.");
      return;
    }
    if (!meetsPasswordMinimum(password)) {
      setFormError(PASSWORD_REQUIREMENT_MESSAGE);
      return;
    }

    setBusy(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setFormError(error);
        return;
      }
      await signOut();
      navigate("/v2/auth?reset=success", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-black px-6 sm:px-8 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="font-display text-xl font-black tracking-tight normal-case">OFFRIP</button>
        <button onClick={() => navigate("/v2/auth")} className="text-[10px] text-black/40 hover:text-black">Cancel</button>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-black p-7 sm:p-8 bg-white">
          <div className="mb-8">
            <div className="text-[10px] tracking-widest font-display text-black/30 mb-3">Welcome to OFFRIP</div>
            <h1 className="text-4xl leading-none">Choose a new password.</h1>
            <p className="text-sm text-black/50 mt-3 normal-case font-offrip-body leading-relaxed">
              Use a secure password you haven't used for this account before.
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-black/50 normal-case font-offrip-body" role="status">Validating reset link…</div>
          ) : invalidRecovery ? (
            <div className="space-y-5">
              <div className="border border-black px-4 py-4 text-sm normal-case font-offrip-body leading-relaxed" role="alert">
                This password reset link is invalid, expired, or has already been used.
              </div>
              <button
                type="button"
                onClick={() => navigate("/v2/auth?mode=forgot", { replace: true })}
                className="w-full bg-black text-white py-3.5 hover:bg-offrip-aqua hover:text-black text-[11px] transition-colors"
              >
                Request another reset email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                autoComplete="new-password"
                className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
                placeholder="New password"
                aria-label="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <input
                type="password"
                autoComplete="new-password"
                className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
                placeholder="Confirm password"
                aria-label="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              {formError && (
                <div className="border border-black px-4 py-3 text-sm normal-case font-offrip-body" role="alert">{formError}</div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-black text-white py-3.5 hover:bg-offrip-aqua hover:text-black disabled:opacity-50 text-[11px] transition-colors"
              >
                {busy ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
