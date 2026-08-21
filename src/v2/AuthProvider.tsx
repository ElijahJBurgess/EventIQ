import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safePasswordUpdateError, safeSignInError, safeSignUpError } from "@/lib/authSecurity";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; requiresEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const RECOVERY_STORAGE_KEY = "offrip-password-recovery";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "true",
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_STORAGE_KEY, "true");
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
        setIsPasswordRecovery(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (!existing) {
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
        setIsPasswordRecovery(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/v2`,
        data: { full_name: fullName },
      },
    });
    return {
      error: error ? safeSignUpError(error.message) : null,
      requiresEmailConfirmation: !data.session,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? safeSignInError(error.message) : null };
  };

  const requestPasswordReset = async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/v2/reset-password`,
    });
    return { error: null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? safePasswordUpdateError(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isPasswordRecovery,
        signUp,
        signIn,
        requestPasswordReset,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
