import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FileSignature, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send, 
  PenTool,
  ChevronRight,
  FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ContractRequest {
  id: string;
  deal_id: string;
  status: string;
  client_name: string;
  deal_value: number;
  created_at: string;
  deals?: {
    title: string;
  };
  contract?: {
    status: string;
    sent_at: string | null;
    signed_at: string | null;
  } | null;
}

export function SDRContractStatus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRecentRequests();
    }
  }, [user]);

  const fetchRecentRequests = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_requests')
        .select(`
          id,
          deal_id,
          status,
          client_name,
          deal_value,
          created_at,
          deals (
            title
          )
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Fetch associated contracts for approved requests
      const dealIds = data?.filter(r => r.status === 'approved').map(r => r.deal_id) || [];
      const contractMap = new Map();

      if (dealIds.length > 0) {
        const { data: contracts } = await supabase
          .from('contracts')
          .select('deal_id, status, sent_at, signed_at')
          .in('deal_id', dealIds);

        contracts?.forEach(c => {
          contractMap.set(c.deal_id, c);
        });
      }

      setRequests((data || []).map(r => ({
        ...r,
        contract: contractMap.get(r.deal_id) || null,
      })));
    } catch (error) {
      console.error('Error fetching contract requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRequestStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getContractProgress = (request: ContractRequest): { label: string; className: string } => {
    if (request.status === 'pending') {
      return { label: 'Awaiting Approval', className: 'bg-warning/10 text-warning border-warning/20' };
    }
    if (request.status === 'rejected') {
      return { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    }
    if (!request.contract) {
      return { label: 'Approved - Drafting', className: 'bg-muted text-muted-foreground border-border' };
    }
    if (request.contract.signed_at) {
      return { label: 'Signed ✓', className: 'bg-success/10 text-success border-success/20' };
    }
    if (request.contract.sent_at) {
      return { label: 'Sent to Client', className: 'bg-primary/10 text-primary border-primary/20' };
    }
    return { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show if no requests
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Contract Status
            </CardTitle>
            <CardDescription className="text-xs">
              Track your contract requests
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/contracts')}>
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {requests.map((request) => {
            const progress = getContractProgress(request);
            return (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => navigate('/contracts')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getRequestStatusIcon(request.status)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {request.deals?.title || request.client_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${request.deal_value.toLocaleString()} • {format(new Date(request.created_at), 'MMM d')}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`shrink-0 ${progress.className}`}
                >
                  {progress.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}