import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "./pages/NotFound.tsx";
import OffripPreview from "./pages/OffripPreview.tsx";
import AuthV2 from "./pages/v2/Auth.tsx";
import DashboardV2 from "./pages/v2/Dashboard.tsx";
import Landing from "./pages/v2/Landing.tsx";
import OrganizerAdmin from "./pages/v2/OrganizerAdmin.tsx";
import ProfileSetupV2 from "./pages/v2/ProfileSetup.tsx";
import { AuthProvider } from "./v2/AuthProvider.tsx";
import ProtectedRoute from "./v2/ProtectedRoute.tsx";
import { useAuth } from "./v2/AuthProvider.tsx";

function LoadingScreen() {
  return <div className="min-h-screen bg-background flex items-center justify-center font-label text-xl">Loading…</div>;
}

function Root() {
  const { user, loading } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileComplete(Boolean(data?.profile_completed));
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Landing />;
  if (profileComplete === null) return <LoadingScreen />;
  return <Navigate to={profileComplete ? "/v2" : "/v2/setup"} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/v2/auth" element={<AuthV2 />} />
            <Route path="/v2/admin" element={<OrganizerAdmin />} />
            <Route path="/v2/setup" element={<ProtectedRoute><ProfileSetupV2 /></ProtectedRoute>} />
            <Route path="/v2" element={<ProtectedRoute><DashboardV2 /></ProtectedRoute>} />
            <Route path="/offrip-preview" element={<OffripPreview />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
