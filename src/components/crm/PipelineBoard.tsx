import { useState, useMemo } from 'react';
import { DollarSign, User, Building2, ArrowRight, Search, FileSignature, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type PipelineStage = 'new' | 'contacted' | 'discovery' | 'meeting' | 'proposal' | 'closed_won' | 'closed_lost';

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string; hint?: string }[] = [
  { value: 'new', label: 'New', color: 'bg-muted' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500/20' },
  { value: 'discovery', label: 'Discovery', color: 'bg-purple-500/20' },
  { value: 'meeting', label: 'Meeting', color: 'bg-yellow-500/20' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500/20', hint: 'Ready for contracts' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-success/20' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-destructive/20' },
];

interface Lead {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  assigned_to?: string | null;
}

interface Deal {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  assigned_to: string;
  title: string;
  value: number;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
}

interface PipelineBoardProps {
  deals: Deal[];
  leads: Lead[];
  onDealClick: (deal: Deal) => void;
  onLeadClick: (lead: Lead) => void;
  onConvertLead: (lead: Lead) => void;
  onStageChange: () => void;
}

export function PipelineBoard({ deals, leads, onDealClick, onLeadClick, onConvertLead, onStageChange }: PipelineBoardProps) {
  const { user } = useAuth();
  const { currentWorkspace, isOwner } = useWorkspace();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [processingDealIds, setProcessingDealIds] = useState<Set<string>>(new Set());

  // Get leads that haven't been converted to deals yet
  const unconvertedLeads = leads.filter(lead => 
    !deals.some(deal => deal.lead_id === lead.id)
  );

  // Filter leads and deals based on search query
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return unconvertedLeads;
    const query = searchQuery.toLowerCase();
    return unconvertedLeads.filter(lead => 
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query)
    );
  }, [unconvertedLeads, searchQuery]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const query = searchQuery.toLowerCase();
    return deals.filter(deal => 
      deal.title.toLowerCase().includes(query)
    );
  }, [deals, searchQuery]);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
    e.dataTransfer.setData('type', 'deal');
  };

  const handleLeadDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.setData('type', 'lead');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: PipelineStage) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    
    if (type === 'lead') {
      // Converting a lead to a deal
      const leadId = e.dataTransfer.getData('leadId');
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        await convertLeadToDeal(lead, newStage);
      }
      return;
    }

    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);

    if (!deal || deal.stage === newStage || !user) return;
    
    // Prevent duplicate processing
    if (processingDealIds.has(dealId)) return;
    setProcessingDealIds(prev => new Set(prev).add(dealId));

    // Agencies can only move deals assigned to themselves, not SDR-assigned deals
    if (isOwner && deal.assigned_to !== user.id) {
      toast({
        variant: 'destructive',
        title: 'Cannot move deal',
        description: 'You can only move deals assigned to you. This deal is assigned to an SDR.',
      });
      setProcessingDealIds(prev => { const n = new Set(prev); n.delete(dealId); return n; });
      return;
    }

    try {
      const { error } = await supabase
        .from('deals')
        .update({
          stage: newStage,
          closed_at: ['closed_won', 'closed_lost'].includes(newStage) ? new Date().toISOString() : null,
        })
        .eq('id', dealId);

      if (error) throw error;

      // Log activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        user_id: user.id,
        activity_type: 'stage_change',
        description: `Moved from ${deal.stage.replace('_', ' ')} to ${newStage.replace('_', ' ')}`,
      });

      // Create commission if moved to closed_won
      if (newStage === 'closed_won') {
        try {
          const response = await supabase.functions.invoke('create-commission', {
            body: { dealId, workspaceId: deal.workspace_id },
          });
          if (response.error) {
            console.error('Error creating commission:', response.error);
          } else {
            console.log('Commission created:', response.data);
          }
        } catch (commErr) {
          console.error('Failed to create commission:', commErr);
        }
      }

      toast({
        title: 'Deal moved',
        description: `Moved to ${newStage.replace('_', ' ')}`,
      });

      onStageChange();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update deal',
      });
    } finally {
      setProcessingDealIds(prev => { const n = new Set(prev); n.delete(dealId); return n; });
    }
  };

  const convertLeadToDeal = async (lead: Lead, stage: PipelineStage = 'new') => {
    if (!user) return;

    try {
      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert({
          workspace_id: lead.workspace_id,
          lead_id: lead.id,
          assigned_to: user.id,
          title: `${lead.first_name} ${lead.last_name}${lead.company ? ` - ${lead.company}` : ''}`,
          value: 0,
          stage,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('deal_activities').insert({
        deal_id: newDeal.id,
        user_id: user.id,
        activity_type: 'create',
        description: `Deal created from lead "${lead.first_name} ${lead.last_name}"`,
      });

      toast({
        title: 'Lead converted',
        description: `Created deal in ${stage.replace('_', ' ')} stage`,
      });

      onStageChange();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to convert lead',
      });
    }
  };

  const getStageDeals = (stage: string) => filteredDeals.filter(d => d.stage === stage);
  const getStageValue = (stage: string) =>
    getStageDeals(stage).reduce((sum, d) => sum + Number(d.value), 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pipeline by name, company, or deal title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-muted border-border"
        />
        {searchQuery && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {filteredLeads.length + filteredDeals.length} results
          </span>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {/* Leads Column */}
          <div className="w-72 shrink-0">
            <Card className="bg-primary/10 border-border/50">
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Leads
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {filteredLeads.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Drag to pipeline to convert
                </p>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[200px]">
                {filteredLeads.map(lead => (
                  <Card
                    key={lead.id}
                    className="cursor-grab active:cursor-grabbing bg-card hover:bg-card/80 transition-colors"
                    draggable
                    onDragStart={(e) => handleLeadDragStart(e, lead.id)}
                    onClick={() => onLeadClick(lead)}
                  >
                    <CardContent className="p-3">
                      <p className="font-medium text-sm line-clamp-1">
                        {lead.first_name} {lead.last_name}
                      </p>
                      {lead.company && (
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
                          <Building2 className="h-3 w-3" />
                          {lead.company}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConvertLead(lead);
                        }}
                      >
                        Convert to Deal
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {filteredLeads.length === 0 && (
                  <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                    {searchQuery ? 'No matching leads' : 'All leads converted'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        {/* Deal Stages */}
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage.value}
            className="w-72 shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.value)}
          >
            <Card className={`${stage.color} border-border/50`}>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                    {stage.label}
                    {stage.hint && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FileSignature className="h-3.5 w-3.5 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{stage.hint}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Move deals here to create contracts
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {getStageDeals(stage.value).length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${getStageValue(stage.value).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[200px]">
                {getStageDeals(stage.value).map(deal => {
                  const isSDRDeal = isOwner && deal.assigned_to !== user?.id;
                  return (
                    <Card
                      key={deal.id}
                      className={`bg-card hover:bg-card/80 transition-colors ${
                        isSDRDeal ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'
                      }`}
                      draggable={!isSDRDeal}
                      onDragStart={(e) => !isSDRDeal && handleDragStart(e, deal.id)}
                      onClick={() => onDealClick(deal)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm line-clamp-1">{deal.title}</p>
                          {isSDRDeal && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Assigned to SDR</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-success text-sm">
                          <DollarSign className="h-3 w-3" />
                          {Number(deal.value).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {getStageDeals(stage.value).length === 0 && (
                  <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                    {searchQuery ? 'No matching deals' : `Drop ${stage.value === 'new' ? 'leads or deals' : 'deals'} here`}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
