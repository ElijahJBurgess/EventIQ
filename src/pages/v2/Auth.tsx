import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthV2() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
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
          <h1 className="text-4xl leading-none">{mode === "signin" ? "Welcome back." : "Get in the room."}</h1>
          <p className="text-sm text-black/50 mt-3 normal-case font-offrip-body leading-relaxed">
            {mode === "signin" ? "Pick up where you left off." : "Create your account, then tell us who is worth meeting."}
          </p>
        </div>

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
          <input
            type="password"
            className="w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black text-white py-3.5 hover:bg-offrip-aqua hover:text-black disabled:opacity-50 text-[11px] transition-colors"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-xs mt-5 text-black/40 normal-case font-offrip-body hover:text-black"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div></div>
    </div>
  );
}
