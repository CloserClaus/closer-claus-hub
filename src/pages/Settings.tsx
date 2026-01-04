import { useState, useRef } from 'react';
import { User, Bell, Shield, CreditCard, TrendingUp, Camera, Loader2 } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user, profile, userRole, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload avatar.',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (data: PasswordFormData) => {
    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      passwordForm.reset();

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to change password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

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
                
                {/* Avatar Upload Card */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                    <CardDescription>
                      Upload a profile picture to personalize your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Avatar'} />
                          <AvatarFallback className="text-2xl">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Upload a new photo</p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or GIF. Max size 5MB.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                        >
                          {isUploadingAvatar ? 'Uploading...' : 'Choose File'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
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
                        <div className="space-y-2">
                          <FormLabel>Email Address</FormLabel>
                          <Input 
                            value={profile?.email || user?.email || ''} 
                            disabled
                            className="bg-muted border-border max-w-md opacity-70"
                          />
                          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>
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
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password"
                                placeholder="Enter new password"
                                className="bg-muted border-border max-w-md"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password"
                                placeholder="Confirm new password"
                                className="bg-muted border-border max-w-md"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-4">
                        <Button type="submit" disabled={isChangingPassword}>
                          {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                        </Button>
                      </div>
                    </form>
                  </Form>
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
