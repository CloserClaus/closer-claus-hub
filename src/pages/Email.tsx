import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { EmailAccountsTab } from '@/components/email/EmailAccountsTab';
import { EmailCampaignsTab } from '@/components/email/EmailCampaignsTab';
import { EmailConversationsTab } from '@/components/email/EmailConversationsTab';
import { EmailAnalyticsTab } from '@/components/email/EmailAnalyticsTab';
import { EmailSettingsTab } from '@/components/email/EmailSettingsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Megaphone, MessageSquare, BarChart3, Settings } from 'lucide-react';

export default function Email() {
  return (
    <DashboardLayout>
      <DashboardHeader title="Email" />
      <main className="flex-1 p-3 md:p-6">
        <div className="max-w-6xl">
          <Tabs defaultValue="accounts">
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="accounts" className="gap-2">
                <UserCircle className="h-4 w-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2">
                <Megaphone className="h-4 w-4" />
                Campaigns
              </TabsTrigger>
              <TabsTrigger value="conversations" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              <EmailAccountsTab />
            </TabsContent>
            <TabsContent value="campaigns">
              <EmailCampaignsTab />
            </TabsContent>
            <TabsContent value="conversations">
              <EmailConversationsTab />
            </TabsContent>
            <TabsContent value="analytics">
              <EmailAnalyticsTab />
            </TabsContent>
            <TabsContent value="settings">
              <EmailSettingsTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}
