import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { EmailConnectionsTab } from '@/components/settings/EmailConnectionsTab';
import { EmailSequencesTab } from '@/components/email/EmailSequencesTab';
import { EmailActivityTab } from '@/components/email/EmailActivityTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Calendar, Activity } from 'lucide-react';

export default function Email() {
  return (
    <DashboardLayout>
      <DashboardHeader title="Email" />
      <main className="flex-1 p-3 md:p-6">
        <div className="max-w-5xl">
          <Tabs defaultValue="connections">
            <TabsList className="mb-6">
              <TabsTrigger value="connections" className="gap-2">
                <Link2 className="h-4 w-4" />
                Connections
              </TabsTrigger>
              <TabsTrigger value="sequences" className="gap-2">
                <Calendar className="h-4 w-4" />
                Sequences
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connections">
              <EmailConnectionsTab />
            </TabsContent>

            <TabsContent value="sequences">
              <EmailSequencesTab />
            </TabsContent>

            <TabsContent value="activity">
              <EmailActivityTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}
