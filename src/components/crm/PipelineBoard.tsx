import { DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type PipelineStage = 'new' | 'contacted' | 'discovery' | 'meeting' | 'proposal' | 'closed_won' | 'closed_lost';

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-muted' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500/20' },
  { value: 'discovery', label: 'Discovery', color: 'bg-purple-500/20' },
  { value: 'meeting', label: 'Meeting', color: 'bg-yellow-500/20' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500/20' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-success/20' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-destructive/20' },
];

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
  onDealClick: (deal: Deal) => void;
  onStageChange: () => void;
}

export function PipelineBoard({ deals, onDealClick, onStageChange }: PipelineBoardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: PipelineStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);

    if (!deal || deal.stage === newStage || !user) return;

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
    }
  };

  const getStageDeals = (stage: string) => deals.filter(d => d.stage === stage);
  const getStageValue = (stage: string) =>
    getStageDeals(stage).reduce((sum, d) => sum + Number(d.value), 0);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
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
                  <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {getStageDeals(stage.value).length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${getStageValue(stage.value).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[200px]">
                {getStageDeals(stage.value).map(deal => (
                  <Card
                    key={deal.id}
                    className="cursor-grab active:cursor-grabbing bg-card hover:bg-card/80 transition-colors"
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    onClick={() => onDealClick(deal)}
                  >
                    <CardContent className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{deal.title}</p>
                      <div className="flex items-center gap-1 mt-2 text-success text-sm">
                        <DollarSign className="h-3 w-3" />
                        {Number(deal.value).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {getStageDeals(stage.value).length === 0 && (
                  <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                    Drop deals here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
