import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileSignature, Clock, CheckCircle, XCircle, Eye, User, DollarSign } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface ContractRequest {
  id: string;
  deal_id: string;
  requested_by: string;
  status: string;
  client_name: string;
  client_email: string;
  client_company: string | null;
  client_title: string | null;
  client_phone: string | null;
  client_address: string | null;
  deal_description: string;
  deal_value: number;
  payment_terms: string;
  contract_duration: string | null;
  start_date: string | null;
  special_conditions: string | null;
  deliverables: string | null;
  agency_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  deals?: {
    title: string;
    value: number;
  };
  requester_profile?: {
    full_name: string | null;
    email: string;
  };
}

interface PendingRequestsTabProps {
  onCreateContract: (dealId: string, requestData: ContractRequest) => void;
}

export function PendingRequestsTab({ onCreateContract }: PendingRequestsTabProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRequest, setViewRequest] = useState<ContractRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<ContractRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (currentWorkspace) {
      fetchRequests();
    }
  }, [currentWorkspace]);

  const fetchRequests = async () => {
    if (!currentWorkspace) return;
    
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
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch requester profiles
      const requesterIds = [...new Set(data?.map(r => r.requested_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', requesterIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setRequests((data || []).map(r => ({
        ...r,
        requester_profile: profileMap.get(r.requested_by) || null,
      })));
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: ContractRequest) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('contract_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', request.id);

      if (error) throw error;

      // Notify SDR
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'contract_request_approved',
            workspace_id: currentWorkspace?.id,
            target_user_id: request.requested_by,
            deal_id: request.deal_id,
          },
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      toast({ title: 'Request approved' });
      
      // Trigger contract creation with prefilled data
      onCreateContract(request.deal_id, request);
      setViewRequest(null);
      fetchRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to approve request',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectRequest) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('contract_requests')
        .update({
          status: 'rejected',
          agency_notes: rejectReason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', rejectRequest.id);

      if (error) throw error;

      // Notify SDR
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            action: 'contract_request_rejected',
            workspace_id: currentWorkspace?.id,
            target_user_id: rejectRequest.requested_by,
            deal_id: rejectRequest.deal_id,
            reason: rejectReason,
          },
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      toast({ title: 'Request rejected' });
      setRejectRequest(null);
      setRejectReason('');
      fetchRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reject request',
      });
    } finally {
      setProcessing(false);
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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const reviewedRequests = requests.filter(r => r.status !== 'pending');

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

  const renderRequestCard = (request: ContractRequest, showActions: boolean) => (
    <Card key={request.id} className="hover:border-primary/50 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSignature className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{request.deals?.title || 'Unknown Deal'}</h3>
              <p className="text-sm text-muted-foreground">
                {request.client_name}
                {request.client_company && ` • ${request.client_company}`}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {request.requester_profile?.full_name || request.requester_profile?.email || 'Unknown SDR'}
                </span>
                <span className="text-xs text-muted-foreground">
                  • {format(new Date(request.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium text-success flex items-center gap-1 justify-end">
                <DollarSign className="h-4 w-4" />
                {request.deal_value.toLocaleString()}
              </p>
              {!showActions && getStatusBadge(request.status)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewRequest(request)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {showActions && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectRequest(request)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(request)}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviewed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No pending requests</h3>
                <p className="text-muted-foreground">
                  Contract requests from your SDRs will appear here for review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(request => renderRequestCard(request, true))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed">
          {reviewedRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No reviewed requests</h3>
                <p className="text-muted-foreground">
                  Approved and rejected requests will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviewedRequests.map(request => renderRequestCard(request, false))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Request Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Contract Request Details</DialogTitle>
          </DialogHeader>
          {viewRequest && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-lg">{viewRequest.deals?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Requested by {viewRequest.requester_profile?.full_name || viewRequest.requester_profile?.email}
                      {' • '}
                      {format(new Date(viewRequest.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(viewRequest.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
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
                  {viewRequest.client_title && (
                    <div>
                      <label className="text-xs text-muted-foreground">Title</label>
                      <p className="font-medium">{viewRequest.client_title}</p>
                    </div>
                  )}
                  {viewRequest.client_phone && (
                    <div>
                      <label className="text-xs text-muted-foreground">Phone</label>
                      <p className="font-medium">{viewRequest.client_phone}</p>
                    </div>
                  )}
                  {viewRequest.client_address && (
                    <div>
                      <label className="text-xs text-muted-foreground">Address</label>
                      <p className="font-medium">{viewRequest.client_address}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <p className="text-sm mt-1">{viewRequest.deal_description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Contract Value</label>
                      <p className="font-medium text-success text-lg">${viewRequest.deal_value.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Payment Terms</label>
                      <p className="font-medium">{formatPaymentTerms(viewRequest.payment_terms)}</p>
                    </div>
                  </div>

                  {(viewRequest.start_date || viewRequest.contract_duration) && (
                    <div className="grid grid-cols-2 gap-4">
                      {viewRequest.start_date && (
                        <div>
                          <label className="text-xs text-muted-foreground">Start Date</label>
                          <p className="font-medium">{format(new Date(viewRequest.start_date), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      {viewRequest.contract_duration && (
                        <div>
                          <label className="text-xs text-muted-foreground">Duration</label>
                          <p className="font-medium">{viewRequest.contract_duration}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {viewRequest.deliverables && (
                    <div>
                      <label className="text-xs text-muted-foreground">Deliverables</label>
                      <p className="text-sm mt-1">{viewRequest.deliverables}</p>
                    </div>
                  )}

                  {viewRequest.special_conditions && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <label className="text-xs text-muted-foreground">Special Conditions</label>
                      <p className="text-sm mt-1">{viewRequest.special_conditions}</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          {viewRequest?.status === 'pending' && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectRequest(viewRequest);
                  setViewRequest(null);
                }}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => handleApprove(viewRequest)}
                disabled={processing}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Create Contract
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectRequest} onOpenChange={(open) => {
        if (!open) {
          setRejectRequest(null);
          setRejectReason('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Contract Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this contract request. The SDR will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
