import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { EmailConnectionsTab } from '@/components/settings/EmailConnectionsTab';

export default function Email() {
  return (
    <DashboardLayout>
      <DashboardHeader title="Email" />
      <main className="flex-1 p-3 md:p-6">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">Email</h1>
          <EmailConnectionsTab />
        </div>
      </main>
    </DashboardLayout>
  );
}
