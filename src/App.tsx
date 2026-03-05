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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmailVerificationGuard } from "@/components/layout/EmailVerificationGuard";
import { SubscriptionGuard } from "@/components/layout/SubscriptionGuard";
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
import Email from "./pages/Email";
import Training from "./pages/Training";
import Contracts from "./pages/Contracts";
import SignContract from "./pages/SignContract";
import Commissions from "./pages/Commissions";
import Notifications from "./pages/Notifications";
import TeamManagement from "./pages/TeamManagement";
import VerifyEmail from "./pages/VerifyEmail";
import FeatureRequests from "./pages/FeatureRequests";
import Changelog from "./pages/Changelog";
import Roadmap from "./pages/Roadmap";
import NotFound from "./pages/NotFound";
import HomePage from "./pages/HomePage";
import Leads from "./pages/Leads";
import OfferDiagnostic from "./pages/OfferDiagnostic";
import ScriptBuilder from "./pages/ScriptBuilder";
import PublicOfferDiagnostic from "./pages/PublicOfferDiagnostic";
import PublicOfferDiagnosticResults from "./pages/PublicOfferDiagnosticResults";
import ReferAndEarn from "./pages/ReferAndEarn";
import DemoWalkthrough from "./pages/DemoWalkthrough";
import DemoVideo from "./pages/DemoVideo";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import GmailOAuthCallback from "./pages/GmailOAuthCallback";
import { HelpWidget } from "@/components/help/HelpWidget";
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
                <Route path="/" element={<HomePage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/role-select" element={<RoleSelect />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/dashboard" element={<ErrorBoundary fallbackTitle="Dashboard error"><Dashboard /></ErrorBoundary>} />
                <Route path="/settings" element={<Settings />} />
                {/* Email verification required */}
                <Route path="/crm" element={<ErrorBoundary fallbackTitle="CRM error"><EmailVerificationGuard feature="the CRM"><CRM /></EmailVerificationGuard></ErrorBoundary>} />
                <Route path="/app/offer-diagnostic" element={<EmailVerificationGuard feature="the Offer Diagnostic"><OfferDiagnostic /></EmailVerificationGuard>} />
                <Route path="/app/script-builder" element={<EmailVerificationGuard feature="the Script Builder"><ScriptBuilder /></EmailVerificationGuard>} />
                {/* Subscription required */}
                <Route path="/jobs" element={<EmailVerificationGuard feature="Jobs"><SubscriptionGuard feature="Jobs"><Jobs /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/jobs/new" element={<EmailVerificationGuard feature="Jobs"><SubscriptionGuard feature="Jobs"><JobForm /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/jobs/:id" element={<EmailVerificationGuard feature="Jobs"><SubscriptionGuard feature="Jobs"><JobDetail /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/jobs/:id/edit" element={<EmailVerificationGuard feature="Jobs"><SubscriptionGuard feature="Jobs"><JobForm /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/leads" element={<EmailVerificationGuard feature="Leads"><SubscriptionGuard feature="the Leads Marketplace"><Leads /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/dialer" element={<ErrorBoundary fallbackTitle="Dialer error"><EmailVerificationGuard feature="the Dialer"><SubscriptionGuard feature="the Dialer"><Dialer /></SubscriptionGuard></EmailVerificationGuard></ErrorBoundary>} />
                <Route path="/email" element={<EmailVerificationGuard feature="Email"><SubscriptionGuard feature="Email Campaigns"><Email /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/trainings" element={<EmailVerificationGuard feature="Training"><SubscriptionGuard feature="Training"><Training /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/contracts" element={<EmailVerificationGuard feature="Contracts"><SubscriptionGuard feature="Contracts"><Contracts /></SubscriptionGuard></EmailVerificationGuard>} />
                <Route path="/team" element={<EmailVerificationGuard feature="Team Management"><SubscriptionGuard feature="Team Management"><TeamManagement /></SubscriptionGuard></EmailVerificationGuard>} />
                {/* No guards needed */}
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/sign/:contractId" element={<SignContract />} />
                <Route path="/commissions" element={<Commissions />} />
                <Route path="/payouts" element={<Navigate to="/commissions" replace />} />
                <Route path="/earnings" element={<Navigate to="/commissions" replace />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/feature-requests" element={<FeatureRequests />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/offer-diagnostic" element={<PublicOfferDiagnostic />} />
                <Route path="/offer-diagnostic/results" element={<PublicOfferDiagnosticResults />} />
                <Route path="/refer" element={<ReferAndEarn />} />
                <Route path="/example" element={<DemoWalkthrough />} />
                <Route path="/demo" element={<DemoVideo />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/auth/google/callback" element={<GmailOAuthCallback />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <TourOverlay />
              <TourTrigger />
              <HelpWidget />
            </BrowserRouter>
          </TooltipProvider>
        </TourProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
