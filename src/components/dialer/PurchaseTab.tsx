import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, 
  Coins, 
  Plus,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface AvailableNumber {
  id: string;
  number: string;
  country: string;
  monthly_cost: number;
  type: string;
}

interface PurchasedNumber {
  id: string;
  phone_number: string;
  country_code: string;
  monthly_cost: number;
  is_active: boolean;
  purchased_at: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
}

const creditPackages: CreditPackage[] = [
  { id: 'starter', name: 'Starter', credits: 100, price: 10 },
  { id: 'growth', name: 'Growth', credits: 500, price: 45, popular: true },
  { id: 'pro', name: 'Pro', credits: 1000, price: 80 },
  { id: 'enterprise', name: 'Enterprise', credits: 5000, price: 350 },
];

interface PurchaseTabProps {
  workspaceId: string;
  onCreditsUpdated: () => void;
}

export function PurchaseTab({ workspaceId, onCreditsUpdated }: PurchaseTabProps) {
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [purchasedNumbers, setPurchasedNumbers] = useState<PurchasedNumber[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetchAvailableNumbers();
    fetchPurchasedNumbers();
  }, [workspaceId]);

  const fetchAvailableNumbers = async () => {
    setIsLoadingNumbers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_available_numbers', countryCode: 'US' }),
        }
      );

      const data = await response.json();
      setApiConfigured(data.configured !== false);
      setAvailableNumbers(data.numbers || []);
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'purchase_number',
            numberId: number.id,
            workspaceId,
            phoneNumber: number.number,
            monthlyCost: number.monthly_cost,
            countryCode: number.country,
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

  const handlePurchaseCredits = async (pkg: CreditPackage) => {
    setIsPurchasing(pkg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to purchase");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/callhippo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'purchase_credits',
            workspaceId,
            creditsAmount: pkg.credits,
            pricePaid: pkg.price,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to purchase credits");
        return;
      }

      toast.success(`${pkg.credits} credits added to your account!`);
      onCreditsUpdated();
    } catch (error) {
      console.error('Error purchasing credits:', error);
      toast.error("Failed to purchase credits");
    } finally {
      setIsPurchasing(null);
    }
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
                CallHippo API key not configured. Showing demo data for testing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Call Credits
            </CardTitle>
            <CardDescription>
              Purchase credits to make outbound calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {creditPackages.map((pkg) => (
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
                    <p className="text-2xl font-bold text-primary">{pkg.credits}</p>
                    <p className="text-sm text-muted-foreground">credits</p>
                    <p className="text-lg font-medium">${pkg.price}</p>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handlePurchaseCredits(pkg)}
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
              Purchase dedicated phone numbers for outbound calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {purchasedNumbers.length > 0 && (
              <>
                <div>
                  <p className="text-sm font-medium mb-2">Your Numbers</p>
                  <div className="space-y-2">
                    {purchasedNumbers.map((num) => (
                      <div key={num.id} className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          <span className="font-mono">{num.phone_number}</span>
                        </div>
                        <Badge variant="outline">${num.monthly_cost}/mo</Badge>
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
                          <p className="text-xs text-muted-foreground capitalize">{num.type}</p>
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
    </div>
  );
}
