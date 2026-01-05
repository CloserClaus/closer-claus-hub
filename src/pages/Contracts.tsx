import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  Plus,
  Send,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  FileText,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ContractRequestForm } from "@/components/contracts/ContractRequestForm";
import { ContractRequestsList } from "@/components/contracts/ContractRequestsList";
import { PendingRequestsTab } from "@/components/contracts/PendingRequestsTab";

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  leads?: {
    first_name: string;
    last_name: string;
    email: string | null;
    company: string | null;
  } | null;
}

interface Contract {
  id: string;
  title: string;
  content: string;
  status: string;
  deal_id: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  deals?: Deal;
  contract_signatures?: Array<{
    signer_name: string;
    signer_email: string;
    signed_at: string;
  }>;
}

interface ContractRequestData {
  client_name: string;
  client_email: string;
  client_company: string | null;
  client_title: string | null;
  deal_description: string;
  deal_value: number;
  payment_terms: string;
  special_conditions: string | null;
  deliverables: string | null;
}

const DEFAULT_CONTRACT_TEMPLATE = `SALES AGREEMENT

This Sales Agreement ("Agreement") is entered into as of the date of signature below.

PARTIES:
- Seller: [COMPANY_NAME]
- Buyer: [CLIENT_NAME] ([CLIENT_COMPANY])

SERVICES/PRODUCTS:
[DEAL_TITLE]

TOTAL VALUE: $[DEAL_VALUE]

TERMS AND CONDITIONS:
1. The Buyer agrees to purchase the services/products described above.
2. Payment terms are Net 30 from the date of this agreement.
3. This agreement shall be binding upon signature by the Buyer.

ACCEPTANCE:
By signing below, the Buyer acknowledges that they have read, understood, and agree to be bound by the terms of this Agreement.`;

export default function Contracts() {
  const { currentWorkspace, isOwner, loading: workspaceLoading } = useWorkspace();
  const { user, userRole } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isOwner ? "contracts" : "my-requests");

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractContent, setContractContent] = useState(DEFAULT_CONTRACT_TEMPLATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestRefreshTrigger, setRequestRefreshTrigger] = useState(0);

  // View state
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  const isSDR = userRole === 'sdr';

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchContracts();
      if (isOwner) {
        fetchDeals();
      }
    }
  }, [currentWorkspace?.id, isOwner]);

  // Set default tab based on role
  useEffect(() => {
    if (isSDR) {
      setActiveTab("my-requests");
    }
  }, [isSDR]);

  const fetchContracts = async () => {
    if (!currentWorkspace?.id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        deals (
          id,
          title,
          value,
          stage,
          leads (
            first_name,
            last_name,
            email,
            company
          )
        ),
        contract_signatures (
          signer_name,
          signer_email,
          signed_at
        )
      `)
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contracts:', error);
    } else {
      setContracts(data || []);
    }
    setIsLoading(false);
  };

  const fetchDeals = async () => {
    if (!currentWorkspace?.id) return;

    const { data, error } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        value,
        stage,
        leads (
          first_name,
          last_name,
          email,
          company
        )
      `)
      .eq('workspace_id', currentWorkspace.id)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deals:', error);
    } else {
      setDeals(data || []);
    }
  };

  const generateContent = (deal: Deal) => {
    let content = DEFAULT_CONTRACT_TEMPLATE;
    content = content.replace('[COMPANY_NAME]', currentWorkspace?.name || 'Company');
    content = content.replace('[CLIENT_NAME]', 
      deal.leads ? `${deal.leads.first_name} ${deal.leads.last_name}` : 'Client');
    content = content.replace('[CLIENT_COMPANY]', deal.leads?.company || 'N/A');
    content = content.replace('[DEAL_TITLE]', deal.title);
    content = content.replace('[DEAL_VALUE]', deal.value.toLocaleString());
    return content;
  };

  const generateContentFromRequest = (requestData: ContractRequestData) => {
    let content = DEFAULT_CONTRACT_TEMPLATE;
    content = content.replace('[COMPANY_NAME]', currentWorkspace?.name || 'Company');
    content = content.replace('[CLIENT_NAME]', requestData.client_name);
    content = content.replace('[CLIENT_COMPANY]', requestData.client_company || 'N/A');
    content = content.replace('[DEAL_TITLE]', requestData.deal_description);
    content = content.replace('[DEAL_VALUE]', requestData.deal_value.toLocaleString());
    
    // Add additional info from request
    if (requestData.payment_terms) {
      content += `\n\nPAYMENT TERMS: ${requestData.payment_terms}`;
    }
    if (requestData.deliverables) {
      content += `\n\nDELIVERABLES:\n${requestData.deliverables}`;
    }
    if (requestData.special_conditions) {
      content += `\n\nSPECIAL CONDITIONS:\n${requestData.special_conditions}`;
    }
    return content;
  };

  const handleDealSelect = (dealId: string) => {
    setSelectedDealId(dealId);
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      setContractTitle(`Contract for ${deal.title}`);
      setContractContent(generateContent(deal));
    }
  };

  const handleCreateContractFromRequest = (dealId: string, requestData: ContractRequestData) => {
    const deal = deals.find(d => d.id === dealId);
    setSelectedDealId(dealId);
    setContractTitle(`Contract for ${requestData.deal_description}`);
    setContractContent(generateContentFromRequest(requestData));
    setIsDialogOpen(true);
  };

  const handleCreateContract = async () => {
    if (!selectedDealId || !contractTitle.trim() || !contractContent.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!currentWorkspace?.id || !user?.id) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contracts')
        .insert({
          workspace_id: currentWorkspace.id,
          deal_id: selectedDealId,
          title: contractTitle.trim(),
          content: contractContent.trim(),
          template_type: 'auto_generated',
          status: 'draft',
          created_by: user.id,
        });

      if (error) {
        console.error('Error creating contract:', error);
        toast.error("Failed to create contract");
        return;
      }

      toast.success("Contract created successfully");
      setIsDialogOpen(false);
      resetForm();
      fetchContracts();
    } catch (error) {
      console.error('Error:', error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendContract = async (contract: Contract) => {
    const leadEmail = contract.deals?.leads?.email;
    const leadName = contract.deals?.leads 
      ? `${contract.deals.leads.first_name} ${contract.deals.leads.last_name}` 
      : 'Client';
    
    if (!leadEmail) {
      toast.error("Cannot send contract: no email address associated with this deal's lead");
      return;
    }

    try {
      // Update contract status
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', contract.id);

      if (error) {
        toast.error("Failed to send contract");
        return;
      }

      // Send email notification to lead
      const signingUrl = `${window.location.origin}/sign/${contract.id}`;
      
      const emailResponse = await supabase.functions.invoke('send-contract-email', {
        body: {
          contractId: contract.id,
          leadEmail,
          leadName,
          contractTitle: contract.title,
          dealTitle: contract.deals?.title || 'Deal',
          dealValue: contract.deals?.value || 0,
          agencyName: currentWorkspace?.name || 'Agency',
          signingUrl,
        }
      });

      if (emailResponse.error) {
        console.error('Email error:', emailResponse.error);
        toast.success("Contract sent! Note: Email delivery failed, please share the link manually.");
      } else {
        toast.success("Contract sent! Email with signing link has been sent to the client.");
      }
      
      fetchContracts();
    } catch (error) {
      console.error('Error:', error);
      toast.error("An error occurred");
    }
  };

  const copySigningLink = (contractId: string) => {
    const link = `${window.location.origin}/sign/${contractId}`;
    navigator.clipboard.writeText(link);
    toast.success("Signing link copied to clipboard!");
  };

  const resetForm = () => {
    setSelectedDealId("");
    setContractTitle("");
    setContractContent(DEFAULT_CONTRACT_TEMPLATE);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="bg-success/10 text-success border-success/20">Signed</Badge>;
      case 'sent':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Awaiting Signature</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (workspaceLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Contracts" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Contracts" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Please select a workspace to manage contracts.</p>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Contracts" />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FileSignature className="h-8 w-8" />
                Contracts
              </h1>
              <p className="text-muted-foreground">
                {isOwner 
                  ? 'Create and manage e-signature contracts' 
                  : 'Request contracts for your deals'}
              </p>
            </div>

            {isOwner && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Contract
              </Button>
            )}
            {isSDR && (
              <Button onClick={() => setShowRequestForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Contract
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {isOwner && (
                <>
                  <TabsTrigger value="contracts" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Contracts
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="gap-2">
                    <Inbox className="h-4 w-4" />
                    Contract Requests
                  </TabsTrigger>
                </>
              )}
              {isSDR && (
                <TabsTrigger value="my-requests" className="gap-2">
                  <FileSignature className="h-4 w-4" />
                  My Requests
                </TabsTrigger>
              )}
            </TabsList>

            {/* Contracts Tab (Agency Only) */}
            {isOwner && (
              <TabsContent value="contracts" className="mt-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="py-6">
                          <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : contracts.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="text-center">
                      <FileSignature className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">No contracts yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Create contracts from your deals and send them for e-signature.
                      </p>
                      {deals.length > 0 && (
                        <Button onClick={() => setIsDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Contract
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {contracts.map((contract) => (
                      <Card key={contract.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">{contract.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {contract.deals?.title} • ${contract.deals?.value?.toLocaleString()}
                                </p>
                                {contract.deals?.leads && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {contract.deals.leads.first_name} {contract.deals.leads.last_name}
                                    {contract.deals.leads.company && ` • ${contract.deals.leads.company}`}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {getStatusBadge(contract.status)}

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewContract(contract)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                {contract.status === 'draft' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSendContract(contract)}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send
                                  </Button>
                                )}

                                {contract.status === 'sent' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copySigningLink(contract.id)}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Link
                                  </Button>
                                )}

                                {contract.status === 'signed' && contract.contract_signatures?.[0] && (
                                  <div className="text-xs text-muted-foreground text-right">
                                    <p className="flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3 text-success" />
                                      Signed by {contract.contract_signatures[0].signer_name}
                                    </p>
                                    <p>{format(new Date(contract.contract_signatures[0].signed_at), 'MMM d, yyyy h:mm a')}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* Contract Requests Tab (Agency Only) */}
            {isOwner && (
              <TabsContent value="requests" className="mt-6">
                <PendingRequestsTab 
                  onCreateContract={(dealId, requestData) => handleCreateContractFromRequest(dealId, requestData as unknown as ContractRequestData)} 
                />
              </TabsContent>
            )}

            {/* My Requests Tab (SDR Only) */}
            {isSDR && (
              <TabsContent value="my-requests" className="mt-6">
                <ContractRequestsList refreshTrigger={requestRefreshTrigger} />
              </TabsContent>
            )}
          </Tabs>

          {/* Create Contract Dialog (Agency Only) */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Deal</label>
                    <Select value={selectedDealId} onValueChange={handleDealSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a deal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title} - ${deal.value.toLocaleString()}
                            {deal.leads && ` (${deal.leads.first_name} ${deal.leads.last_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contract Title</label>
                    <Input
                      placeholder="e.g., Sales Agreement for Enterprise Package"
                      value={contractTitle}
                      onChange={(e) => setContractTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contract Content</label>
                    <Textarea
                      placeholder="Enter contract terms..."
                      value={contractContent}
                      onChange={(e) => setContractContent(e.target.value)}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateContract} disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create Contract"}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Contract Request Form Dialog (SDR Only) */}
          <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Request Contract</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <ContractRequestForm
                  onSuccess={() => {
                    setShowRequestForm(false);
                    setRequestRefreshTrigger(prev => prev + 1);
                  }}
                  onCancel={() => setShowRequestForm(false)}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* View Contract Dialog */}
          <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{viewContract?.title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {getStatusBadge(viewContract?.status || 'draft')}
                    <span>Created {viewContract && format(new Date(viewContract.created_at), 'MMM d, yyyy')}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap font-mono text-sm">
                    {viewContract?.content}
                  </div>

                  {viewContract?.status === 'signed' && viewContract.contract_signatures?.[0] && (
                    <Card className="bg-success/5 border-success/20">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-success" />
                          <div>
                            <p className="font-medium">Signed by {viewContract.contract_signatures[0].signer_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {viewContract.contract_signatures[0].signer_email} • {format(new Date(viewContract.contract_signatures[0].signed_at), 'MMMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {viewContract?.status === 'sent' && (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Awaiting signature</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copySigningLink(viewContract.id)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Signing Link
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </DashboardLayout>
  );
}
