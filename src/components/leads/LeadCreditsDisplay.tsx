import { useState } from "react";
import { Coins, Plus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";

// Lead packages: 5 credits = 1 lead, priced at $1 per lead
const CREDIT_PACKAGES = [
  { credits: 500, price: 100, leads: 100, popular: false },
  { credits: 1250, price: 250, leads: 250, popular: false },
  { credits: 2500, price: 500, leads: 500, popular: true },
  { credits: 5000, price: 1000, leads: 1000, popular: false },
];

interface LeadCreditsDisplayProps {
  compact?: boolean;
}

export function LeadCreditsDisplay({ compact = false }: LeadCreditsDisplayProps) {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [purchasingPackage, setPurchasingPackage] = useState<number | null>(null);

  // Fetch lead credits balance
  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['lead-credits', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;
      
      const { data, error } = await supabase
        .from('lead_credits')
        .select('credits_balance, last_purchased_at')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching lead credits:', error);
        throw error;
      }
      
      return data || { credits_balance: 0, last_purchased_at: null };
    },
    enabled: !!currentWorkspace?.id,
  });

  const handlePurchase = async (creditsAmount: number) => {
    if (!currentWorkspace?.id) {
      toast({
        title: "Error",
        description: "No workspace selected",
        variant: "destructive",
      });
      return;
    }

    setPurchasingPackage(creditsAmount);

    try {
      const { data, error } = await supabase.functions.invoke('purchase-lead-credits', {
        body: {
          workspace_id: currentWorkspace.id,
          credits_amount: creditsAmount,
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error purchasing lead credits:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to initiate purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingPackage(null);
    }
  };

  const creditsBalance = credits?.credits_balance || 0;
  const leadsAvailable = Math.floor(creditsBalance / 5);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <Coins className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Lead Credits:</span>
        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (compact) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Coins className="h-4 w-4" />
            <span>{creditsBalance} credits</span>
            <Plus className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <PurchaseDialogContent 
          onPurchase={handlePurchase} 
          purchasingPackage={purchasingPackage}
          creditsBalance={creditsBalance}
        />
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-semibold">Lead Credits</span>
        </div>
        <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
          {creditsBalance}
        </Badge>
      </div>
      
      <div className="text-sm text-muted-foreground">
        You can enrich <span className="font-medium text-foreground">{leadsAvailable}</span> leads with your current balance
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Buy Leads
          </Button>
        </DialogTrigger>
        <PurchaseDialogContent 
          onPurchase={handlePurchase} 
          purchasingPackage={purchasingPackage}
          creditsBalance={creditsBalance}
        />
      </Dialog>
    </div>
  );
}

interface PurchaseDialogContentProps {
  onPurchase: (credits: number) => void;
  purchasingPackage: number | null;
  creditsBalance: number;
}

function PurchaseDialogContent({ onPurchase, purchasingPackage, creditsBalance }: PurchaseDialogContentProps) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Buy Leads
        </DialogTitle>
        <DialogDescription>
          Purchase leads to get full contact data including email and phone number.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="text-sm text-muted-foreground mb-4">
          Current balance: <span className="font-medium text-foreground">{creditsBalance} credits</span>
        </div>

        <div className="grid gap-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <Button
              key={pkg.credits}
              variant={pkg.popular ? "default" : "outline"}
              className={`relative w-full justify-between h-auto py-4 ${pkg.popular ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              onClick={() => onPurchase(pkg.credits)}
              disabled={purchasingPackage !== null}
            >
              {pkg.popular && (
                <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
              <div className="flex flex-col items-start">
                <span className="font-semibold">{pkg.leads} Leads</span>
                <span className="text-xs text-muted-foreground">
                  Enrich {pkg.leads} leads
                </span>
              </div>
              <div className="flex items-center gap-2">
                {purchasingPackage === pkg.credits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-bold">${pkg.price}</span>
                )}
              </div>
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Only fully enriched leads (with both email and phone) count toward your purchase.
        </p>
      </div>
    </DialogContent>
  );
}
