import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import AdminDashboard from "./pages/AdminDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { TourTrigger } from "@/components/tour/TourTrigger";
import Auth from "./pages/Auth";
import RoleSelect from "./pages/RoleSelect";
import Onboarding from "./pages/Onboarding";
import Subscription from "./pages/Subscription";
import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import JobForm from "./pages/JobForm";
import CRM from "./pages/CRM";
import Conversations from "./pages/Conversations";
import Dialer from "./pages/Dialer";
import Training from "./pages/Training";
import Contracts from "./pages/Contracts";
import SignContract from "./pages/SignContract";
import Commissions from "./pages/Commissions";
import Payouts from "./pages/Payouts";
import Notifications from "./pages/Notifications";
import TeamManagement from "./pages/TeamManagement";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
        <TourProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/role-select" element={<RoleSelect />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/new" element={<JobForm />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/jobs/:id/edit" element={<JobForm />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/dialer" element={<Dialer />} />
                <Route path="/trainings" element={<Training />} />
                <Route path="/contracts" element={<Contracts />} />
                <Route path="/sign/:contractId" element={<SignContract />} />
                <Route path="/commissions" element={<Commissions />} />
                <Route path="/payouts" element={<Payouts />} />
                <Route path="/earnings" element={<Navigate to="/commissions" replace />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/team" element={<TeamManagement />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <TourOverlay />
              <TourTrigger />
            </BrowserRouter>
          </TooltipProvider>
        </TourProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
