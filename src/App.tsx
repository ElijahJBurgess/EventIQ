import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import AuthV2 from "./pages/v2/Auth.tsx";
import Landing from "./pages/v2/Landing.tsx";
import { AuthProvider } from "./v2/AuthProvider.tsx";
import ProtectedRoute from "./v2/ProtectedRoute.tsx";

const DashboardV2 = lazy(() => import("./pages/v2/Dashboard.tsx"));
const ProfileSetupV2 = lazy(() => import("./pages/v2/ProfileSetup.tsx"));
const ResetPasswordV2 = lazy(() => import("./pages/v2/ResetPassword.tsx"));
const OrganizerAdmin = lazy(() => import("./pages/v2/OrganizerAdmin.tsx"));
const OffripPreview = lazy(() => import("./pages/OffripPreview.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function LoadingScreen() {
  return <div className="min-h-screen bg-background flex items-center justify-center font-label text-xl">Loading…</div>;
}

const App = () => (
  <>
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/v2/auth" element={<AuthV2 />} />
            <Route path="/v2/reset-password" element={<ResetPasswordV2 />} />
            <Route path="/v2/admin" element={<OrganizerAdmin />} />
            <Route path="/v2/setup" element={<ProtectedRoute><ProfileSetupV2 /></ProtectedRoute>} />
            <Route path="/v2" element={<ProtectedRoute><DashboardV2 /></ProtectedRoute>} />
            <Route
              path="/offrip-preview"
              element={import.meta.env.DEV ? <OffripPreview /> : <Navigate to="/" replace />}
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </>
);

export default App;
