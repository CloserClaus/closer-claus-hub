import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Gift, 
  Copy, 
  Check, 
  Users, 
  CreditCard, 
  Clock, 
  CheckCircle,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Referral {
  id: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  credits_awarded: number;
  created_at: string;
  completed_at: string | null;
  referred_user?: {
    email: string;
    full_name: string | null;
  } | null;
}

interface ReferralStats {
  total: number;
  pending: number;
  completed: number;
  totalCredits: number;
}

export default function ReferAndEarn() {
  const { profile, user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ total: 0, pending: 0, completed: 0, totalCredits: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code || '';
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  useEffect(() => {
    fetchReferrals();
  }, [user?.id]);

  const fetchReferrals = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type assertion since Supabase types might not be updated yet
      const typedData = (data || []) as unknown as Referral[];
      setReferrals(typedData);

      // Calculate stats
      const total = typedData.length;
      const pending = typedData.filter(r => r.status === 'pending').length;
      const completed = typedData.filter(r => r.status === 'completed').length;
      const totalCredits = typedData.reduce((sum, r) => sum + (r.credits_awarded || 0), 0);
      
      setStats({ total, pending, completed, totalCredits });
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      default:
        return <Badge variant="outline">Expired</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader title="Refer & Earn" />
      <main className="flex-1 p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Hero Section */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Refer an Agency, Earn 500 Lead Credits</CardTitle>
              <CardDescription className="text-base mt-2">
                Share your referral link with agencies. When they sign up and complete onboarding, 
                you'll receive 500 free lead credits!
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
                <Input
                  readOnly
                  value={referralLink}
                  className="bg-background text-sm font-mono"
                />
                <Button onClick={copyToClipboard} className="gap-2 shrink-0">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Your referral code: <span className="font-mono font-medium text-foreground">{referralCode}</span>
              </p>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Referrals</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalCredits.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Credits Earned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referrals List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Your Referrals
              </CardTitle>
              <CardDescription>
                Track the status of your referrals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading referrals...
                </div>
              ) : referrals.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-2">No referrals yet</p>
                  <p className="text-sm text-muted-foreground">
                    Share your referral link to start earning credits!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {referral.referred_user?.full_name || referral.referred_user?.email || 'Pending signup'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(referral.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {referral.credits_awarded > 0 && (
                          <span className="text-sm font-medium text-success">
                            +{referral.credits_awarded} credits
                          </span>
                        )}
                        {getStatusBadge(referral.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How it Works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    1
                  </div>
                  <h4 className="font-medium mb-1">Share Your Link</h4>
                  <p className="text-sm text-muted-foreground">
                    Send your unique referral link to agencies you know
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    2
                  </div>
                  <h4 className="font-medium mb-1">They Sign Up</h4>
                  <p className="text-sm text-muted-foreground">
                    When they create an agency account using your link
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    3
                  </div>
                  <h4 className="font-medium mb-1">Earn Credits</h4>
                  <p className="text-sm text-muted-foreground">
                    You receive 500 lead credits when they complete setup
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
}
