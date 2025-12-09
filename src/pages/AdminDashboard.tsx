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
import { LayoutDashboard, Building2, Users, AlertTriangle, DollarSign } from 'lucide-react';

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
            Manage agencies, SDRs, disputes, and payouts
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass">
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
            <TabsTrigger value="disputes" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Disputes
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>

          <TabsContent value="agencies">
            <AgenciesTable />
          </TabsContent>

          <TabsContent value="sdrs">
            <SDRsTable />
          </TabsContent>

          <TabsContent value="disputes">
            <DisputesTable />
          </TabsContent>

          <TabsContent value="payouts">
            <PayoutsTable />
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  );
}
