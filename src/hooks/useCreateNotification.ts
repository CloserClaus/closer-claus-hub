import { supabase } from '@/integrations/supabase/client';

type NotificationAction = 
  | 'dispute_created'
  | 'dispute_resolved'
  | 'sdr_joined'
  | 'sdr_removed'
  | 'commission_paid';

interface DisputeCreatedParams {
  action: 'dispute_created';
  dispute_id: string;
  workspace_id: string;
  deal_id: string;
  raised_by: string;
  reason: string;
}

interface DisputeResolvedParams {
  action: 'dispute_resolved';
  dispute_id: string;
  workspace_id: string;
  deal_id: string;
  raised_by: string;
  resolution: string;
  admin_notes?: string;
}

interface SdrJoinedParams {
  action: 'sdr_joined';
  workspace_id: string;
  sdr_user_id: string;
}

interface SdrRemovedParams {
  action: 'sdr_removed';
  workspace_id: string;
  sdr_user_id: string;
  reason?: string;
}

interface CommissionPaidParams {
  action: 'commission_paid';
  commission_id: string;
  sdr_user_id: string;
  workspace_id: string;
  amount: number;
}

type NotificationParams = 
  | DisputeCreatedParams 
  | DisputeResolvedParams 
  | SdrJoinedParams 
  | SdrRemovedParams 
  | CommissionPaidParams;

export async function createNotification(params: NotificationParams): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('create-notification', {
      body: params,
    });
    
    if (error) {
      console.error('Failed to create notification:', error);
    }
  } catch (error) {
    console.error('Error calling create-notification:', error);
  }
}

export function useCreateNotification() {
  return { createNotification };
}
