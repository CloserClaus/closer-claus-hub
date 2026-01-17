import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";

export interface LeadCredits {
  credits_balance: number;
  last_purchased_at: string | null;
}

export function useLeadCredits() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: credits,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['lead-credits', currentWorkspace?.id],
    queryFn: async (): Promise<LeadCredits> => {
      if (!currentWorkspace?.id) {
        return { credits_balance: 0, last_purchased_at: null };
      }

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

  const purchaseCreditsMutation = useMutation({
    mutationFn: async (creditsAmount: number) => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      const { data, error } = await supabase.functions.invoke('purchase-lead-credits', {
        body: {
          workspace_id: currentWorkspace.id,
          credits_amount: creditsAmount,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to initiate purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate available leads (5 credits = 1 lead)
  const creditsBalance = credits?.credits_balance || 0;
  const availableLeads = Math.floor(creditsBalance / 5);

  // Check if user has enough credits for a given number of leads
  const hasEnoughCredits = (leadsCount: number) => {
    return creditsBalance >= leadsCount * 5;
  };

  // Calculate credits needed for a given number of leads
  const creditsNeeded = (leadsCount: number) => {
    return leadsCount * 5;
  };

  // Calculate deficit if not enough credits
  const creditDeficit = (leadsCount: number) => {
    const needed = creditsNeeded(leadsCount);
    return Math.max(0, needed - creditsBalance);
  };

  return {
    credits: creditsBalance,
    availableLeads,
    lastPurchasedAt: credits?.last_purchased_at,
    isLoading,
    error,
    refetch,
    purchaseCredits: purchaseCreditsMutation.mutate,
    isPurchasing: purchaseCreditsMutation.isPending,
    hasEnoughCredits,
    creditsNeeded,
    creditDeficit,
  };
}
