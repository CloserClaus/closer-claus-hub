import { useAuth } from '@/hooks/useAuth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
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

const tabTitles: Record<string, string> = {
  overview: 'Platform Overview',
  agencies: 'Agencies',
  sdrs: 'SDRs',
  jobs: 'Job Posts',
  applications: 'Job Applications',
  leads: 'Leads',
  deals: 'Deals',
  contracts: 'Contracts',
  calls: 'Call Logs',
  trainings: 'Training Materials',
  disputes: 'Disputes',
  payouts: 'Payouts',
  coupons: 'Coupons',
};

export default function AdminDashboard() {
  const { userRole, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

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

  const renderContent = () => {
    switch (activeTab) {
      case 'agencies':
        return <AgenciesTable />;
      case 'sdrs':
        return <SDRsTable />;
      case 'jobs':
        return <JobsTable />;
      case 'applications':
        return <ApplicationsTable />;
      case 'leads':
        return <LeadsTable />;
      case 'deals':
        return <DealsTable />;
      case 'contracts':
        return <ContractsTable />;
      case 'calls':
        return <CallLogsTable />;
      case 'trainings':
        return <TrainingsTable />;
      case 'disputes':
        return <DisputesTable />;
      case 'payouts':
        return <PayoutsTable />;
      case 'coupons':
        return <CouponsTable />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Platform Admin" />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{tabTitles[activeTab] || 'Platform Admin'}</h1>
          <p className="text-muted-foreground">
            {activeTab === 'overview' 
              ? 'Complete visibility into all platform activity' 
              : `Manage all ${tabTitles[activeTab]?.toLowerCase() || 'data'}`}
          </p>
        </div>

        {renderContent()}
      </main>
    </DashboardLayout>
  );
}
