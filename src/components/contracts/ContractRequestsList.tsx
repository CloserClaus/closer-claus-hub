import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileSignature, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContractRequest {
  id: string;
  deal_id: string;
  status: string;
  client_name: string;
  client_email: string;
  client_company: string | null;
  deal_description: string;
  deal_value: number;
  payment_terms: string;
  special_conditions: string | null;
  agency_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  deals?: {
    title: string;
    value: number;
  };
}

interface ContractRequestsListProps {
  refreshTrigger?: number;
}

export function ContractRequestsList({ refreshTrigger }: ContractRequestsListProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRequest, setViewRequest] = useState<ContractRequest | null>(null);

  useEffect(() => {
    if (currentWorkspace && user) {
      fetchRequests();
    }
  }, [currentWorkspace, user, refreshTrigger]);

  const fetchRequests = async () => {
    if (!currentWorkspace || !user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_requests')
        .select(`
          *,
          deals (
            title,
            value
          )
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const formatPaymentTerms = (terms: string) => {
    const termsMap: Record<string, string> = {
      upfront: 'Upfront (100%)',
      net_15: 'Net 15',
      net_30: 'Net 30',
      net_60: 'Net 60',
      '50_50': '50% Upfront / 50% on Completion',
      monthly: 'Monthly Installments',
      custom: 'Custom',
    };
    return termsMap[terms] || terms;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="py-4">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileSignature className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No contract requests</h3>
          <p className="text-muted-foreground">
            Your submitted contract requests will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusIcon(request.status)}
                  <div>
                    <h3 className="font-medium">{request.deals?.title || 'Unknown Deal'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {request.client_name}
                      {request.client_company && ` • ${request.client_company}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium text-success">${request.deal_value.toLocaleString()}</p>
                    {getStatusBadge(request.status)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewRequest(request)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {request.status === 'rejected' && request.agency_notes && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    <strong>Rejection reason:</strong> {request.agency_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Request Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Contract Request Details</DialogTitle>
          </DialogHeader>
          {viewRequest && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{viewRequest.deals?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Submitted {format(new Date(viewRequest.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(viewRequest.status)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Client Name</label>
                    <p className="font-medium">{viewRequest.client_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Client Email</label>
                    <p className="font-medium">{viewRequest.client_email}</p>
                  </div>
                  {viewRequest.client_company && (
                    <div>
                      <label className="text-xs text-muted-foreground">Company</label>
                      <p className="font-medium">{viewRequest.client_company}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">Contract Value</label>
                    <p className="font-medium text-success">${viewRequest.deal_value.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{viewRequest.deal_description}</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Payment Terms</label>
                  <p className="font-medium">{formatPaymentTerms(viewRequest.payment_terms)}</p>
                </div>

                {viewRequest.special_conditions && (
                  <div>
                    <label className="text-xs text-muted-foreground">Special Conditions</label>
                    <p className="text-sm mt-1">{viewRequest.special_conditions}</p>
                  </div>
                )}

                {viewRequest.agency_notes && (
                  <div className={`p-3 rounded-lg ${
                    viewRequest.status === 'rejected' 
                      ? 'bg-destructive/10 border border-destructive/20' 
                      : 'bg-muted'
                  }`}>
                    <label className="text-xs text-muted-foreground">Agency Notes</label>
                    <p className="text-sm mt-1">{viewRequest.agency_notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
