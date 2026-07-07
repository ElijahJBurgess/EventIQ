import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthV2 from "./pages/v2/Auth.tsx";
import DashboardV2 from "./pages/v2/Dashboard.tsx";
import ProfileSetupV2 from "./pages/v2/ProfileSetup.tsx";
import { AuthProvider } from "./v2/AuthProvider.tsx";
import ProtectedRoute from "./v2/ProtectedRoute.tsx";
import { useRememberVersion } from "./v2/useVersionMemory.ts";

function RootRedirect() {
  // Default to the original V1 MVP on the bare "/" route.
  return <IndexV1 />;
}

function IndexV1() {
  useRememberVersion("v1");
  return <Index />;
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
            <Route path="/" element={<RootRedirect />} />
            <Route path="/v1" element={<IndexV1 />} />
            <Route path="/v2/auth" element={<AuthV2 />} />
            <Route path="/v2/setup" element={<ProtectedRoute><ProfileSetupV2 /></ProtectedRoute>} />
            <Route path="/v2" element={<ProtectedRoute><DashboardV2 /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <a
            href="/v2"
            className="fixed bottom-4 right-4 z-50 font-label text-xs bg-vermillion text-vermillion-foreground px-4 py-3 border-2 border-primary shadow-card uppercase tracking-wide"
          >
            Try v2 →
          </a>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
