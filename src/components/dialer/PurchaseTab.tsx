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
import { Input } from "@/components/ui/input";
import { 
  Phone, 
  Clock, 
  Plus,
  Check,
  AlertCircle,
  Loader2,
  MapPin,
  User,
  BarChart3,
  MessageSquare,
  Zap,
  Search,
  X,
  Gift
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
  priceUnit: string;
  priceType: 'per_minute' | 'per_call';
  icon: React.ReactNode;
}

// Free phone number limits per subscription tier
const TIER_FREE_NUMBERS: Record<string, number> = {
  omega: 1,
  beta: 2,
  alpha: 5,
};

// Twilio pricing with 20% margin
// Twilio outbound: $0.014/min -> $0.017/min with margin
// Packages rounded for simplicity
const minutePackages: MinutePackage[] = [
  { id: 'starter', name: 'Starter', minutes: 100, price: 2 },
  { id: 'growth', name: 'Growth', minutes: 500, price: 10, popular: true },
  { id: 'pro', name: 'Pro', minutes: 1000, price: 20 },
  { id: 'enterprise', name: 'Enterprise', minutes: 5000, price: 100 },
];

// Real Twilio add-ons with 20% margin (Call Recording is included free for all accounts)
const twilioAddons: TwilioAddon[] = [
  {
    id: 'transcription',
    name: 'Call Transcription',
    description: 'AI-powered transcription of call recordings',
    price: 0.029, // $0.024/min + 20%
    priceUnit: '/min',
    priceType: 'per_minute',
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    id: 'amd',
    name: 'Answering Machine Detection',
    description: 'Detect voicemail and answering machines automatically',
    price: 0.009, // $0.0075/call + 20%
    priceUnit: '/call',
    priceType: 'per_call',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: 'voice_insights',
    name: 'Voice Insights',
    description: 'Advanced call quality metrics and analytics',
    price: 0.003, // $0.0024/min + 20%
    priceUnit: '/min',
    priceType: 'per_minute',
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

interface PurchaseTabProps {
  workspaceId: string;
  subscriptionTier?: string | null;
  onCreditsUpdated: () => void;
}

// US States for the dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington D.C.' },
];

export function PurchaseTab({ workspaceId, subscriptionTier, onCreditsUpdated }: PurchaseTabProps) {
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [purchasedNumbers, setPurchasedNumbers] = useState<PurchasedNumber[]>([]);
  const [sdrMembers, setSDRMembers] = useState<SDRMember[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  const fetchAvailableNumbers = async (city?: string, state?: string) => {
    setIsLoadingNumbers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const requestBody: any = { action: 'get_available_numbers', country: 'US' };
      if (city) requestBody.city = city;
      if (state) requestBody.state = state;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();
      setApiConfigured(data.error !== 'Twilio not configured');
      setAvailableNumbers((data.numbers || []).map((num: any) => ({
        id: num.phone_number,
        number: num.phone_number,
        country: num.country || 'US',
        city: num.locality ? `${num.locality}${num.region ? `, ${num.region}` : ''}` : num.region,
        monthly_cost: num.monthly_cost || 1.15,
        type: 'local',
      })));
    } catch (error) {
      console.error('Error fetching numbers:', error);
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  const searchNumbersByCity = async () => {
    if (!citySearch.trim() && !stateSearch) {
      toast.error("Please enter a city name or select a state");
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    await fetchAvailableNumbers(citySearch.trim() || undefined, stateSearch || undefined);
    setIsSearching(false);
  };

  const clearSearch = () => {
    setCitySearch('');
    setStateSearch('');
    setHasSearched(false);
    fetchAvailableNumbers();
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

  // Calculate free number allowance
  const tier = subscriptionTier || 'omega';
  const freeLimit = TIER_FREE_NUMBERS[tier] || 1;
  const currentCount = purchasedNumbers.filter(n => n.is_active).length;
  const freeNumbersRemaining = Math.max(0, freeLimit - currentCount);
  const isWithinFreeLimit = currentCount < freeLimit;

  const handlePurchaseNumber = async (number: AvailableNumber) => {
    setIsPurchasing(number.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to purchase");
        return;
      }

      // First, try to provision for free if within tier limit
      if (isWithinFreeLimit) {
        const freeResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-phone-number`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workspace_id: workspaceId,
              phone_number: number.number,
              country_code: number.country,
              city: number.city,
            }),
          }
        );

        const freeData = await freeResponse.json();

        if (freeResponse.ok && freeData.success) {
          toast.success(`Phone number ${number.number} added for free!`);
          fetchPurchasedNumbers();
          onCreditsUpdated();
          setIsPurchasing(null);
          return;
        }

        // If 402, it means we need to pay (limit exceeded)
        if (freeResponse.status !== 402) {
          toast.error(freeData.error || "Failed to provision phone number");
          setIsPurchasing(null);
          return;
        }
      }

      // If we're here, we need to use Stripe checkout for paid phone number
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-dialer-credits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            purchase_type: 'phone_number',
            workspace_id: workspaceId,
            phone_number: number.number,
            country_code: number.country,
            number_type: number.type,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'stripe_not_configured') {
          toast.error("Payment system is not configured. Please contact support.");
        } else {
          toast.error(data.error || "Failed to initiate purchase");
        }
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Failed to create checkout session");
      }
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

      // Use Stripe checkout for minutes purchase
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-dialer-credits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            purchase_type: 'call_minutes',
            workspace_id: workspaceId,
            minutes: pkg.minutes,
            price: pkg.price,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'stripe_not_configured') {
          toast.error("Payment system is not configured. Please contact support.");
        } else {
          toast.error(data.error || "Failed to initiate purchase");
        }
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Failed to create checkout session");
      }
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
        {/* Free Minutes Info */}
        <Card className="lg:col-span-2 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-primary/20">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-primary">1,000 Free Minutes Every Month</p>
              <p className="text-sm text-muted-foreground">
                Your Closer Claus subscription includes 1,000 free calling minutes per month. 
                Purchase additional minutes when you need more.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Call Minutes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Call Minutes
            </CardTitle>
            <CardDescription>
              Purchase additional minutes for outbound calls • $0.02/min
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
            {/* Free Number Allowance Banner */}
            <div className={`p-3 rounded-lg border ${freeNumbersRemaining > 0 ? 'border-success/30 bg-success/5' : 'border-muted'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${freeNumbersRemaining > 0 ? 'bg-success/20' : 'bg-muted'}`}>
                  <Gift className={`h-4 w-4 ${freeNumbersRemaining > 0 ? 'text-success' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${freeNumbersRemaining > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {freeNumbersRemaining > 0 
                      ? `${freeNumbersRemaining} Free Phone Number${freeNumbersRemaining > 1 ? 's' : ''} Remaining`
                      : 'Free Phone Numbers Used'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your {tier.charAt(0).toUpperCase() + tier.slice(1)} plan includes {freeLimit} free phone number{freeLimit > 1 ? 's' : ''}.
                    {freeNumbersRemaining === 0 && ' Additional numbers are $1.40/mo each.'}
                  </p>
                </div>
                <Badge variant={freeNumbersRemaining > 0 ? 'secondary' : 'outline'}>
                  {currentCount}/{freeLimit} used
                </Badge>
              </div>
            </div>

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

            {/* Search by Location */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Search by Location</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input 
                    placeholder="City name (e.g., Los Angeles)" 
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchNumbersByCity()}
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Select value={stateSearch || "any"} onValueChange={(val) => setStateSearch(val === "any" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="State (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any State</SelectItem>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={searchNumbersByCity}
                    disabled={isSearching || (!citySearch.trim() && !stateSearch)}
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Search
                      </>
                    )}
                  </Button>
                  {hasSearched && (
                    <Button variant="outline" onClick={clearSearch}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {hasSearched ? 'Search Results' : 'Available Numbers'}
                </p>
                {hasSearched && (
                  <Badge variant="secondary">
                    {availableNumbers.length} found
                  </Badge>
                )}
              </div>
              {isLoadingNumbers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableNumbers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {hasSearched 
                      ? 'No numbers found for this location. Try a different city or state.'
                      : 'No numbers available. Try searching for a specific location.'}
                  </p>
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
                          {isWithinFreeLimit ? (
                            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                              <Gift className="h-3 w-3 mr-1" />
                              Free
                            </Badge>
                          ) : (
                            <span className="text-sm">${num.monthly_cost}/mo</span>
                          )}
                          <Button 
                            size="sm" 
                            variant={isWithinFreeLimit ? "default" : "outline"}
                            onClick={() => handlePurchaseNumber(num)}
                            disabled={isPurchasing === num.id}
                          >
                            {isPurchasing === num.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isWithinFreeLimit ? (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Free
                              </>
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
            Calling Features
          </CardTitle>
          <CardDescription>
            Enable usage-based features for your calls • Only pay for what you use
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
                      ${addon.price.toFixed(3)}<span className="text-sm text-muted-foreground">{addon.priceUnit}</span>
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
                      Enable Feature
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
