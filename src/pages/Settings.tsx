import { useState } from 'react';
import { User, Bell, Shield, CreditCard, TrendingUp } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SDRLevelBadge, getSDRLevelInfo, getNextLevelThreshold } from '@/components/ui/sdr-level-badge';
import { useSDRLevel } from '@/components/SDRLevelProgress';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Settings() {
  const { user, profile, userRole, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  });

  const handleUpdateProfile = async (data: ProfileFormData) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          phone: data.phone || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update profile.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Settings" />
      <main className="flex-1 p-6">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-muted">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              {userRole === 'agency_owner' && (
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="space-y-6">
                {/* SDR Level Card */}
                {userRole === 'sdr' && <SDRLevelCard />}
                
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-muted border-border max-w-md"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="+1 (555) 000-0000"
                                  className="bg-muted border-border max-w-md"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="pt-4">
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Manage how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Notification settings coming soon.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {userRole === 'agency_owner' && (
              <TabsContent value="billing">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Billing & Subscription</CardTitle>
                    <CardDescription>
                      Manage your subscription and payment methods
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Stripe integration coming soon. You'll be able to manage your subscription here.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="security">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your password and security preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Password change and 2FA settings coming soon.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}

// SDR Level Card Component
function SDRLevelCard() {
  const { data: levelData, isLoading } = useSDRLevel();

  if (isLoading || !levelData) return null;

  const levelInfo = getSDRLevelInfo(levelData.level);
  const Icon = levelInfo.icon;

  return (
    <Card className="glass overflow-hidden">
      <div className={`h-1 ${levelData.level === 3 ? 'bg-yellow-500' : levelData.level === 2 ? 'bg-slate-400' : 'bg-amber-600'}`} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              SDR Level & Progress
            </CardTitle>
            <CardDescription>
              Your performance level and platform fee rate
            </CardDescription>
          </div>
          <SDRLevelBadge level={levelData.level} size="lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Total Deals Closed</p>
            <p className="text-2xl font-bold">${levelData.totalDeals.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Platform Fee Rate</p>
            <p className="text-2xl font-bold text-success">{levelInfo.platformCut}%</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {levelData.level < 3 ? 'To Next Level' : 'Status'}
            </p>
            <p className="text-2xl font-bold">
              {levelData.level < 3 ? `$${levelData.remaining?.toLocaleString() || 0}` : 'Max Level'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress to Level {Math.min(levelData.level + 1, 3)}</span>
            <span>{Math.round(levelData.progressPercent)}%</span>
          </div>
          <Progress value={levelData.progressPercent} className="h-3" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className={`p-2 rounded ${levelData.level >= 1 ? 'bg-amber-600/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 1</p>
            <p className="text-xs">15% fee</p>
          </div>
          <div className={`p-2 rounded ${levelData.level >= 2 ? 'bg-slate-400/20 text-slate-300' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 2</p>
            <p className="text-xs">10% fee • $30K+</p>
          </div>
          <div className={`p-2 rounded ${levelData.level >= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
            <p className="font-medium">Level 3</p>
            <p className="text-xs">5% fee • $100K+</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
