import { useState, useEffect } from 'react';
import { CreditCard, Phone, Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Purchase {
  id: string;
  credits_amount: number;
  price_paid: number;
  created_at: string;
  workspace_id: string;
  purchased_by: string;
  workspace_name?: string;
  profile_name?: string;
  profile_email?: string;
}

interface Subscription {
  id: string;
  name: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export function PurchasesSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leadPurchases, setLeadPurchases] = useState<Purchase[]>([]);
  const [dialerPurchases, setDialerPurchases] = useState<Purchase[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  const [openSections, setOpenSections] = useState({
    leadCredits: true,
    dialerCredits: true,
    subscriptions: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all purchases in parallel
      const [leadResult, dialerResult, subsResult] = await Promise.all([
        supabase
          .from('lead_credit_purchases')
          .select('id, credits_amount, price_paid, created_at, workspace_id, purchased_by')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('credit_purchases')
          .select('id, credits_amount, price_paid, created_at, workspace_id, purchased_by')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('workspaces')
          .select('id, name, subscription_tier, subscription_status, stripe_subscription_id, created_at')
          .not('subscription_tier', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (leadResult.error) throw leadResult.error;
      if (dialerResult.error) throw dialerResult.error;
      if (subsResult.error) throw subsResult.error;

      // Get unique workspace and user IDs
      const allPurchases = [...(leadResult.data || []), ...(dialerResult.data || [])];
      const workspaceIds = [...new Set(allPurchases.map(p => p.workspace_id))];
      const userIds = [...new Set(allPurchases.map(p => p.purchased_by))];

      // Fetch related data
      const [workspacesResult, profilesResult] = await Promise.all([
        workspaceIds.length > 0 
          ? supabase.from('workspaces').select('id, name').in('id', workspaceIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : { data: [] },
      ]);

      const workspaceMap = new Map<string, string>();
      workspacesResult.data?.forEach(w => workspaceMap.set(w.id, w.name));

      const profileMap = new Map<string, { full_name: string | null; email: string }>();
      profilesResult.data?.forEach(p => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));

      // Enrich purchases with workspace and profile data
      const enrichLeadPurchases: Purchase[] = (leadResult.data || []).map(p => {
        const profile = profileMap.get(p.purchased_by);
        return {
          ...p,
          workspace_name: workspaceMap.get(p.workspace_id),
          profile_name: profile?.full_name || undefined,
          profile_email: profile?.email,
        };
      });

      const enrichDialerPurchases: Purchase[] = (dialerResult.data || []).map(p => {
        const profile = profileMap.get(p.purchased_by);
        return {
          ...p,
          workspace_name: workspaceMap.get(p.workspace_id),
          profile_name: profile?.full_name || undefined,
          profile_email: profile?.email,
        };
      });

      setLeadPurchases(enrichLeadPurchases);
      setDialerPurchases(enrichDialerPurchases);
      setSubscriptions(subsResult.data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load purchases',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate totals
  const totalLeadRevenue = leadPurchases.reduce((sum, p) => sum + p.price_paid, 0);
  const totalDialerRevenue = dialerPurchases.reduce((sum, p) => sum + p.price_paid, 0);
  const activeSubscriptions = subscriptions.filter(s => s.subscription_status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Lead Credit Revenue</CardDescription>
            <CardTitle className="text-2xl text-success">${totalLeadRevenue.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Dialer Revenue</CardDescription>
            <CardTitle className="text-2xl text-success">${totalDialerRevenue.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Active Subscriptions</CardDescription>
            <CardTitle className="text-2xl text-primary">{activeSubscriptions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl text-success">
              ${(totalLeadRevenue + totalDialerRevenue).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Lead Credit Purchases */}
      <Collapsible open={openSections.leadCredits} onOpenChange={() => toggleSection('leadCredits')}>
        <Card className="glass">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Lead Credit Purchases
                  </CardTitle>
                  <CardDescription>{leadPurchases.length} purchases</CardDescription>
                </div>
                {openSections.leadCredits ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {leadPurchases.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No lead credit purchases yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Purchased By</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{format(new Date(purchase.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{purchase.workspace_name || 'Unknown'}</TableCell>
                        <TableCell>
                          {purchase.profile_name || purchase.profile_email || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {purchase.credits_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          ${purchase.price_paid.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dialer Purchases */}
      <Collapsible open={openSections.dialerCredits} onOpenChange={() => toggleSection('dialerCredits')}>
        <Card className="glass">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Dialer Minute Purchases
                  </CardTitle>
                  <CardDescription>{dialerPurchases.length} purchases</CardDescription>
                </div>
                {openSections.dialerCredits ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {dialerPurchases.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No dialer purchases yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Purchased By</TableHead>
                      <TableHead className="text-right">Minutes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dialerPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{format(new Date(purchase.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{purchase.workspace_name || 'Unknown'}</TableCell>
                        <TableCell>
                          {purchase.profile_name || purchase.profile_email || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {purchase.credits_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          ${purchase.price_paid.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Subscriptions */}
      <Collapsible open={openSections.subscriptions} onOpenChange={() => toggleSection('subscriptions')}>
        <Card className="glass">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscriptions
                  </CardTitle>
                  <CardDescription>{subscriptions.length} workspaces with subscriptions</CardDescription>
                </div>
                {openSections.subscriptions ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No subscriptions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sub.subscription_tier || 'None'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={sub.subscription_status === 'active' ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {sub.subscription_status || 'None'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(sub.created_at), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
