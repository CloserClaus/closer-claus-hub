import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, FileSignature } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const contractRequestSchema = z.object({
  deal_id: z.string().min(1, 'Please select a deal'),
  client_name: z.string().min(1, 'Client name is required').max(100),
  client_email: z.string().email('Valid email is required'),
  client_company: z.string().optional(),
  client_title: z.string().optional(),
  client_phone: z.string().optional(),
  client_address: z.string().optional(),
  deal_description: z.string().min(10, 'Please provide a description of the deal'),
  deal_value: z.coerce.number().min(0, 'Value must be positive'),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  contract_duration: z.string().optional(),
  start_date: z.string().optional(),
  special_conditions: z.string().optional(),
  deliverables: z.string().optional(),
});

type ContractRequestFormData = z.infer<typeof contractRequestSchema>;

interface Deal {
  id: string;
  title: string;
  value: number;
  leads?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    title: string | null;
  } | null;
}

interface ContractRequestFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContractRequestForm({ onSuccess, onCancel }: ContractRequestFormProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<ContractRequestFormData>({
    resolver: zodResolver(contractRequestSchema),
    defaultValues: {
      deal_id: '',
      client_name: '',
      client_email: '',
      client_company: '',
      client_title: '',
      client_phone: '',
      client_address: '',
      deal_description: '',
      deal_value: 0,
      payment_terms: 'net_30',
      contract_duration: '',
      start_date: '',
      special_conditions: '',
      deliverables: '',
    },
  });

  useEffect(() => {
    if (currentWorkspace && user) {
      fetchDeals();
    }
  }, [currentWorkspace, user]);

  const fetchDeals = async () => {
    if (!currentWorkspace || !user) return;
    
    setLoading(true);
    try {
      // SDRs can only see deals assigned to them that are in the proposal stage
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          title,
          value,
          leads (
            first_name,
            last_name,
            email,
            phone,
            company,
            title
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('assigned_to', user.id)
        .eq('stage', 'proposal')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDealSelect = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      form.setValue('deal_id', dealId);
      form.setValue('deal_value', deal.value);
      form.setValue('deal_description', `Contract for ${deal.title}`);
      
      if (deal.leads) {
        form.setValue('client_name', `${deal.leads.first_name} ${deal.leads.last_name}`);
        form.setValue('client_email', deal.leads.email || '');
        form.setValue('client_company', deal.leads.company || '');
        form.setValue('client_title', deal.leads.title || '');
        form.setValue('client_phone', deal.leads.phone || '');
      }
    }
  };

  const onSubmit = async (data: ContractRequestFormData) => {
    if (!currentWorkspace || !user) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from('contract_requests').insert({
        workspace_id: currentWorkspace.id,
        deal_id: data.deal_id,
        requested_by: user.id,
        client_name: data.client_name,
        client_email: data.client_email,
        client_company: data.client_company || null,
        client_title: data.client_title || null,
        client_phone: data.client_phone || null,
        client_address: data.client_address || null,
        deal_description: data.deal_description,
        deal_value: data.deal_value,
        payment_terms: data.payment_terms,
        contract_duration: data.contract_duration || null,
        start_date: data.start_date || null,
        special_conditions: data.special_conditions || null,
        deliverables: data.deliverables || null,
      });

      if (error) throw error;

      // Send notification and email to agency owner
      try {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', currentWorkspace.id)
          .single();

        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', workspace?.owner_id)
          .single();

        const { data: sdrProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (workspace) {
          // In-app notification
          await supabase.functions.invoke('create-notification', {
            body: {
              action: 'contract_request',
              workspace_id: currentWorkspace.id,
              target_user_id: workspace.owner_id,
              deal_id: data.deal_id,
            },
          });

          // Email notification
          if (ownerProfile?.email) {
            await supabase.functions.invoke('send-contract-request-email', {
              body: {
                type: 'submitted',
                recipientEmail: ownerProfile.email,
                recipientName: ownerProfile.full_name || 'Agency Owner',
                dealTitle: selectedDeal?.title || 'Unknown Deal',
                dealValue: data.deal_value,
                agencyName: workspace.name,
                sdrName: sdrProfile?.full_name || 'An SDR',
              },
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      toast({ title: 'Contract request submitted' });
      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to submit request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.leads?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.leads?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.leads?.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDeal = deals.find(d => d.id === form.watch('deal_id'));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Deal Selection */}
        <div className="space-y-3">
          <FormLabel>Select Deal *</FormLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border"
            />
          </div>
          
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading deals...</div>
          ) : filteredDeals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {deals.length === 0 
                  ? 'No deals in the Proposal stage. Move a deal to the Proposal stage in the CRM to request a contract.'
                  : 'No deals match your search.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {filteredDeals.map((deal) => (
                <Card
                  key={deal.id}
                  className={`cursor-pointer transition-colors hover:border-primary/50 ${
                    form.watch('deal_id') === deal.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleDealSelect(deal.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{deal.title}</p>
                        {deal.leads && (
                          <p className="text-xs text-muted-foreground">
                            {deal.leads.first_name} {deal.leads.last_name}
                            {deal.leads.company && ` • ${deal.leads.company}`}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-success">
                        ${deal.value.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {selectedDeal && (
          <>
            {/* Client Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Client Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Email *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} className="bg-muted border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contract Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Contract Details</h3>
              <FormField
                control={form.control}
                name="deal_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={3} 
                        className="bg-muted border-border" 
                        placeholder="Describe what services/products are being sold..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deal_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value ($) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          className="bg-muted border-border" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upfront">Upfront (100%)</SelectItem>
                          <SelectItem value="net_15">Net 15</SelectItem>
                          <SelectItem value="net_30">Net 30</SelectItem>
                          <SelectItem value="net_60">Net 60</SelectItem>
                          <SelectItem value="50_50">50% Upfront / 50% on Completion</SelectItem>
                          <SelectItem value="monthly">Monthly Installments</SelectItem>
                          <SelectItem value="custom">Custom (specify below)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-muted border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contract_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Duration</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., 12 months, 1 year" 
                          className="bg-muted border-border" 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="deliverables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deliverables</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={2} 
                        className="bg-muted border-border" 
                        placeholder="List the specific deliverables for this contract..."
                      />
                    </FormControl>
                    <FormDescription>What will be delivered to the client?</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="special_conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Conditions</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={2} 
                        className="bg-muted border-border" 
                        placeholder="Any special terms, conditions, or notes for the agency..."
                      />
                    </FormControl>
                    <FormDescription>Any custom terms or conditions the agency should know about</FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Form>
  );
}
