import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  Clock, 
  Plus,
  Check,
  AlertCircle,
  Loader2,
  MapPin,
  User,
  Voicemail,
  BarChart3,
  MessageSquare,
  Zap
} from "lucide-react";
import { toast } from "sonner";

interface AvailableNumber {
  id: string;
  number: string;
  country: string;
  city?: string;
  monthly_cost: number;
  type: string;
}

interface PurchasedNumber {
  id: string;
  phone_number: string;
  country_code: string;
  city?: string | null;
  monthly_cost: number;
  is_active: boolean;
  purchased_at: string;
  assigned_to?: string | null;
}

interface SDRMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface MinutePackage {
  id: string;
  name: string;
  minutes: number;
  price: number;
  popular?: boolean;
}

interface TwilioAddon {
  id: string;
  name: string;
  description: string;
  price: number;
  priceType: string;
  icon: React.ReactNode;
}

const minutePackages: MinutePackage[] = [
  { id: 'starter', name: 'Starter', minutes: 100, price: 10 },
  { id: 'growth', name: 'Growth', minutes: 500, price: 45, popular: true },
  { id: 'pro', name: 'Pro', minutes: 1000, price: 80 },
  { id: 'enterprise', name: 'Enterprise', minutes: 5000, price: 350 },
];

const twilioAddons: TwilioAddon[] = [
  {
    id: 'voicemail',
    name: 'Voicemail Drop',
    description: 'Pre-recorded voicemail messages for unanswered calls',
    price: 15,
    priceType: '/mo',
    icon: <Voicemail className="h-5 w-5" />,
  },
  {
    id: 'analytics',
    name: 'Advanced Analytics',
    description: 'Detailed call analytics, recordings, and reporting',
    price: 25,
    priceType: '/mo',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    id: 'sms',
    name: 'SMS Messaging',
    description: 'Send and receive text messages from your business numbers',
    price: 20,
    priceType: '/mo',
    icon: <MessageSquare className="h-5 w-5" />,
  },
];

interface PurchaseTabProps {
  workspaceId: string;
  onCreditsUpdated: () => void;
}

export function PurchaseTab({ workspaceId, onCreditsUpdated }: PurchaseTabProps) {
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [purchasedNumbers, setPurchasedNumbers] = useState<PurchasedNumber[]>([]);
  const [sdrMembers, setSDRMembers] = useState<SDRMember[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableNumbers();
    fetchPurchasedNumbers();
    fetchSDRMembers();
  }, [workspaceId]);

  const fetchSDRMembers = async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('workspace_id', workspaceId)
      .is('removed_at', null);

    if (error) {
      console.error('Error fetching SDR members:', error);
      return;
    }

    // Transform data to handle the nested profiles structure
    const transformedData = (data || []).map(member => ({
      ...member,
      profiles: Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
    }));

    setSDRMembers(transformedData as SDRMember[]);
  };

  const fetchAvailableNumbers = async () => {
    setIsLoadingNumbers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_available_numbers', country: 'US' }),
        }
      );

      const data = await response.json();
      setApiConfigured(data.error !== 'Twilio not configured');
      setAvailableNumbers((data.numbers || []).map((num: any) => ({
        id: num.phone_number,
        number: num.phone_number,
        country: num.country || 'US',
        city: num.locality || num.region,
        monthly_cost: num.monthly_cost || 1.15,
        type: 'local',
      })));
    } catch (error) {
      console.error('Error fetching numbers:', error);
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  const fetchPurchasedNumbers = async () => {
    const { data, error } = await supabase
      .from('workspace_phone_numbers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchased numbers:', error);
      return;
    }

    setPurchasedNumbers(data || []);
  };

  const handlePurchaseNumber = async (number: AvailableNumber) => {
    setIsPurchasing(number.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to purchase");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'purchase_number',
            phone_number: number.number,
            workspace_id: workspaceId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to purchase number");
        return;
      }

      toast.success("Phone number purchased successfully!");
      fetchPurchasedNumbers();
      fetchAvailableNumbers();
    } catch (error) {
      console.error('Error purchasing number:', error);
      toast.error("Failed to purchase number");
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleAssignNumber = async (numberId: string, userId: string | null) => {
    setIsAssigning(numberId);
    try {
      const { error } = await supabase
        .from('workspace_phone_numbers')
        .update({ assigned_to: userId })
        .eq('id', numberId);

      if (error) {
        console.error('Error assigning number:', error);
        toast.error("Failed to assign number");
        return;
      }

      toast.success(userId ? "Number assigned successfully!" : "Number unassigned");
      fetchPurchasedNumbers();
    } catch (error) {
      console.error('Error assigning number:', error);
      toast.error("Failed to assign number");
    } finally {
      setIsAssigning(null);
    }
  };

  const handlePurchaseMinutes = async (pkg: MinutePackage) => {
    setIsPurchasing(pkg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to purchase");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'purchase_credits',
            workspace_id: workspaceId,
            credits_amount: pkg.minutes,
            price_paid: pkg.price,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to purchase minutes");
        return;
      }

      toast.success(`${pkg.minutes} minutes added to your account!`);
      onCreditsUpdated();
    } catch (error) {
      console.error('Error purchasing minutes:', error);
      toast.error("Failed to purchase minutes");
    } finally {
      setIsPurchasing(null);
    }
  };

  const handlePurchaseAddon = async (addon: TwilioAddon) => {
    setIsPurchasing(addon.id);
    try {
      // For now, show a message that this would integrate with Twilio
      toast.success(`${addon.name} addon request submitted! We'll process this shortly.`);
    } catch (error) {
      console.error('Error purchasing addon:', error);
      toast.error("Failed to purchase addon");
    } finally {
      setIsPurchasing(null);
    }
  };

  const getAssignedSDRName = (userId: string | null | undefined) => {
    if (!userId) return null;
    const sdr = sdrMembers.find(m => m.user_id === userId);
    return sdr?.profiles?.full_name || sdr?.profiles?.email || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {apiConfigured === false && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-warning">Demo Mode</p>
              <p className="text-sm text-muted-foreground">
                Twilio is not configured. Showing demo data for testing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Minutes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Call Minutes
            </CardTitle>
            <CardDescription>
              Purchase minutes for outbound calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {minutePackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative p-4 rounded-lg border transition-all ${
                    pkg.popular 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                      Popular
                    </Badge>
                  )}
                  <div className="text-center space-y-2">
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-2xl font-bold text-primary">{pkg.minutes}</p>
                    <p className="text-sm text-muted-foreground">minutes</p>
                    <p className="text-lg font-medium">${pkg.price}</p>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handlePurchaseMinutes(pkg)}
                      disabled={isPurchasing === pkg.id}
                    >
                      {isPurchasing === pkg.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Buy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Phone Numbers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Numbers
            </CardTitle>
            <CardDescription>
              Purchase dedicated phone numbers and assign them to SDRs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {purchasedNumbers.length > 0 && (
              <>
                <div>
                  <p className="text-sm font-medium mb-2">Your Numbers</p>
                  <div className="space-y-2">
                    {purchasedNumbers.map((num) => (
                      <div key={num.id} className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-success" />
                            <span className="font-mono">{num.phone_number}</span>
                          </div>
                          <Badge variant="outline">${num.monthly_cost}/mo</Badge>
                        </div>
                        {num.city && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{num.city}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={num.assigned_to || "unassigned"}
                            onValueChange={(value) => 
                              handleAssignNumber(num.id, value === "unassigned" ? null : value)
                            }
                            disabled={isAssigning === num.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assign to SDR">
                                {isAssigning === num.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  num.assigned_to ? getAssignedSDRName(num.assigned_to) : "Unassigned"
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {sdrMembers.map((sdr) => (
                                <SelectItem key={sdr.user_id} value={sdr.user_id}>
                                  {sdr.profiles?.full_name || sdr.profiles?.email || sdr.user_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Available Numbers</p>
              {isLoadingNumbers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {availableNumbers.map((num) => (
                      <div key={num.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                        <div>
                          <p className="font-mono">{num.number}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {num.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {num.city}
                              </span>
                            )}
                            <span className="capitalize">{num.type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">${num.monthly_cost}/mo</span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePurchaseNumber(num)}
                            disabled={isPurchasing === num.id}
                          >
                            {isPurchasing === num.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Buy'
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Twilio Addons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Calling Addons
          </CardTitle>
          <CardDescription>
            Enhance your calling capabilities with these powerful addons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {twilioAddons.map((addon) => (
              <div
                key={addon.id}
                className="p-4 rounded-lg border border-border hover:border-primary/50 transition-all space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {addon.icon}
                  </div>
                  <div>
                    <p className="font-semibold">{addon.name}</p>
                    <p className="text-lg font-bold text-primary">
                      ${addon.price}<span className="text-sm text-muted-foreground">{addon.priceType}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{addon.description}</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full"
                  onClick={() => handlePurchaseAddon(addon)}
                  disabled={isPurchasing === addon.id}
                >
                  {isPurchasing === addon.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add to Plan
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
