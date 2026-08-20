import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthV2() {
  const navigate = useNavigate();
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    searchParams.get("mode") === "signup"
      ? "signup"
      : searchParams.get("mode") === "forgot"
        ? "forgot"
        : "signin",
  );
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await requestPasswordReset(email);
        if (error) {
          toast.error("Unable to send a reset email. Please try again.");
          return;
        }
        setResetRequested(true);
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, fullName);
        if (error) return toast.error(error);
        // Email auto-confirm is on for the demo — sign straight in.
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          toast.success("Account created — you can now sign in.");
          setMode("signin");
          return;
        }
        toast.success("Welcome to OOO Intelligence v2");
        // New profiles are never complete yet — always start at setup.
        navigate("/v2/setup");
      } else {
        const { error } = await signIn(email, password);
        if (error) return toast.error(error);
        toast.success("Welcome back");
        const { data: { user: signedInUser } } = await supabase.auth.getUser();
        if (signedInUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("profile_completed")
            .eq("id", signedInUser.id)
            .maybeSingle();
          navigate(profile?.profile_completed ? "/v2" : "/v2/setup");
        } else {
          navigate("/v2");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "signin" ? "Welcome back." : mode === "signup" ? "Get in the room." : "Reset your password.";
  const description = mode === "signin"
    ? "Pick up where you left off."
    : mode === "signup"
      ? "Create your account, then tell us who is worth meeting."
      : "Enter your email and we'll send you a secure reset link.";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-black px-6 sm:px-8 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="font-display text-xl font-black tracking-tight normal-case">OFFRIP</button>
        <button onClick={() => navigate("/")} className="text-[10px] text-black/40 hover:text-black">Cancel</button>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-black p-7 sm:p-8 bg-white">
        <div className="mb-8">
          <div className="text-[10px] tracking-widest font-display text-black/30 mb-3">Welcome to OFFRIP</div>
          <h1 className="text-4xl leading-none">{heading}</h1>
          <p className="text-sm text-black/50 mt-3 normal-case font-offrip-body leading-relaxed">
            {description}
          </p>
        </div>

        {searchParams.get("reset") === "success" && mode === "signin" && (
          <div className="mb-5 border border-black bg-offrip-aqua px-4 py-3 text-sm normal-case font-offrip-body" role="status">
            Password updated. Sign in with your new password.
          </div>
        )}

        {resetRequested ? (
          <div className="space-y-5" role="status">
            <div className="border border-black bg-offrip-aqua px-4 py-4 text-sm normal-case font-offrip-body leading-relaxed">
              If an account exists for that email, you'll receive a password reset email shortly.
            </div>
            <button
              type="button"
              onClick={() => {
                setResetRequested(false);
                setMode("signin");
              }}
              className="w-full bg-black text-white py-3.5 hover:bg-offrip-aqua hover:text-black text-[11px] transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : <>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <input
              className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode !== "forgot" && (
            <input
              type="password"
              className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black text-white py-3.5 hover:bg-offrip-aqua hover:text-black disabled:opacity-50 text-[11px] transition-colors"
          >
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="w-full text-center text-xs mt-4 text-black/40 normal-case font-offrip-body hover:text-black"
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-xs mt-5 text-black/40 normal-case font-offrip-body hover:text-black"
        >
          {mode === "signin" ? "Need an account? Sign up" : mode === "signup" ? "Already have an account? Sign in" : "Back to sign in"}
        </button>
        </>}
      </div></div>
    </div>
  );
}
