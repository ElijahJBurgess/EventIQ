import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/v2/AuthProvider";

export default function ProtectedRoute({
  children,
  requireCompletedProfile = false,
}: {
  children: ReactNode;
  requireCompletedProfile?: boolean;
}) {
  const { user, loading } = useAuth();
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(
    requireCompletedProfile ? null : true,
  );

  useEffect(() => {
    if (!requireCompletedProfile) {
      setProfileCompleted(true);
      return;
    }
    if (!user) {
      setProfileCompleted(null);
      return;
    }

    let active = true;
    setProfileCompleted(null);
    void supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfileCompleted(data?.profile_completed === true);
      });

    return () => {
      active = false;
    };
  }, [requireCompletedProfile, user]);

  if (loading || (user && requireCompletedProfile && profileCompleted === null)) {
    return <div className="min-h-screen bg-aqua flex items-center justify-center font-label text-xl">Loading…</div>;
  }
  if (!user) return <Navigate to="/v2/auth" replace />;
  if (requireCompletedProfile && !profileCompleted) return <Navigate to="/v2/setup" replace />;
  return <>{children}</>;
}
