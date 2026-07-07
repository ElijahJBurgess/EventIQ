import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen bg-aqua flex items-center justify-center font-label text-xl">Loading…</div>;
  }
  if (!user) return <Navigate to="/v2/auth" replace />;
  return <>{children}</>;
}
