import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AgenciesTable } from '@/components/admin/AgenciesTable';
import { SDRsTable } from '@/components/admin/SDRsTable';
import { DisputesTable } from '@/components/admin/DisputesTable';
import { PayoutsTable } from '@/components/admin/PayoutsTable';
import { CouponsTable } from '@/components/admin/CouponsTable';
import { JobsTable } from '@/components/admin/JobsTable';
import { ApplicationsTable } from '@/components/admin/ApplicationsTable';
import { TrainingsTable } from '@/components/admin/TrainingsTable';
import { ContractsTable } from '@/components/admin/ContractsTable';
import { LeadsTable } from '@/components/admin/LeadsTable';
import { DealsTable } from '@/components/admin/DealsTable';
import { CallLogsTable } from '@/components/admin/CallLogsTable';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  AlertTriangle, 
  DollarSign, 
  Tag,
  Briefcase,
  FileCheck,
  GraduationCap,
  FileSignature,
  UserCircle,
  Handshake,
  Phone
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function AdminDashboard() {
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole !== 'platform_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Platform Admin" />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Platform Overview</h1>
          <p className="text-muted-foreground">
            Complete visibility into all platform activity
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <ScrollArea className="w-full">
            <TabsList className="glass inline-flex w-max">
              <TabsTrigger value="overview" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="agencies" className="gap-2">
                <Building2 className="h-4 w-4" />
                Agencies
              </TabsTrigger>
              <TabsTrigger value="sdrs" className="gap-2">
                <Users className="h-4 w-4" />
                SDRs
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Jobs
              </TabsTrigger>
              <TabsTrigger value="applications" className="gap-2">
                <FileCheck className="h-4 w-4" />
                Applications
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-2">
                <UserCircle className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <Handshake className="h-4 w-4" />
                Deals
              </TabsTrigger>
              <TabsTrigger value="contracts" className="gap-2">
                <FileSignature className="h-4 w-4" />
                Contracts
              </TabsTrigger>
              <TabsTrigger value="calls" className="gap-2">
                <Phone className="h-4 w-4" />
                Calls
              </TabsTrigger>
              <TabsTrigger value="trainings" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Trainings
              </TabsTrigger>
              <TabsTrigger value="disputes" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Disputes
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Payouts
              </TabsTrigger>
              <TabsTrigger value="coupons" className="gap-2">
                <Tag className="h-4 w-4" />
                Coupons
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>

          <TabsContent value="agencies">
            <AgenciesTable />
          </TabsContent>

          <TabsContent value="sdrs">
            <SDRsTable />
          </TabsContent>

          <TabsContent value="jobs">
            <JobsTable />
          </TabsContent>

          <TabsContent value="applications">
            <ApplicationsTable />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsTable />
          </TabsContent>

          <TabsContent value="deals">
            <DealsTable />
          </TabsContent>

          <TabsContent value="contracts">
            <ContractsTable />
          </TabsContent>

          <TabsContent value="calls">
            <CallLogsTable />
          </TabsContent>

          <TabsContent value="trainings">
            <TrainingsTable />
          </TabsContent>

          <TabsContent value="disputes">
            <DisputesTable />
          </TabsContent>

          <TabsContent value="payouts">
            <PayoutsTable />
          </TabsContent>

          <TabsContent value="coupons">
            <CouponsTable />
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  );
}
