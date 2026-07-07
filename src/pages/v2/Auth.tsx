import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthV2() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
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

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-aqua flex items-center justify-center p-4">
      <div className="ooo-card w-full max-w-md p-8 bg-card">
        <div className="mb-6">
          <span className="font-label text-xs bg-vermillion text-vermillion-foreground px-2 py-1 ooo-border inline-block">
            OOO Intelligence · v2
          </span>
          <h1 className="text-3xl mt-4">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="text-sm text-muted-foreground mt-2 normal-case">
            The new relational platform — profiles, matches, meetings & ROI.
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full ooo-border bg-card py-3 mb-4 shadow-card hover-lift disabled:opacity-50 font-label"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground font-label">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              className="w-full ooo-border bg-card px-4 py-3 normal-case font-sans"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className="w-full ooo-border bg-card px-4 py-3 normal-case font-sans"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full ooo-border bg-card px-4 py-3 normal-case font-sans"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary text-primary-foreground py-3 shadow-card hover-lift disabled:opacity-50 font-label"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-sm mt-4 text-muted-foreground normal-case font-sans hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        <button
          onClick={() => navigate("/v1")}
          className="w-full text-center text-xs mt-4 text-muted-foreground normal-case font-sans hover:text-foreground"
        >
          ← Back to v1
        </button>
      </div>
    </div>
  );
}
