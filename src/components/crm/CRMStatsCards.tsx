import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';
import { Lead } from '@/hooks/useCRMData';
import { Deal } from '@/hooks/useCRMData';
import { FilterState } from '@/components/crm/CRMFilters';

interface CRMStatsCardsProps {
  leads: Lead[];
  deals: Deal[];
  pipelineValue: number;
  wonValue: number;
  isAgencyOwner: boolean;
  leadFilters: FilterState;
  setLeadFilters: (filters: FilterState) => void;
}

export function CRMStatsCards({
  leads,
  deals,
  pipelineValue,
  wonValue,
  isAgencyOwner,
  leadFilters,
  setLeadFilters,
}: CRMStatsCardsProps) {
  return (
    <div className={`grid gap-4 ${isAgencyOwner ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardDescription>Total Leads</CardDescription>
          <CardTitle className="text-2xl">{leads.length}</CardTitle>
        </CardHeader>
      </Card>
      {isAgencyOwner && (
        <Card
          className={`glass cursor-pointer hover:border-primary/50 transition-colors ${leadFilters.assignedTo === 'unassigned' ? 'border-primary' : ''}`}
          onClick={() => {
            if (leadFilters.assignedTo === 'unassigned') {
              setLeadFilters({ ...leadFilters, assignedTo: '' });
            } else {
              setLeadFilters({ ...leadFilters, assignedTo: 'unassigned' });
            }
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <UserPlus className="h-3 w-3" />
              Unassigned
            </CardDescription>
            <CardTitle className={`text-2xl ${leads.filter(l => !l.assigned_to).length > 0 ? 'text-warning' : ''}`}>
              {leads.filter(l => !l.assigned_to).length}
            </CardTitle>
          </CardHeader>
        </Card>
      )}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardDescription>Active Deals</CardDescription>
          <CardTitle className="text-2xl">
            {deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardDescription>Pipeline Value</CardDescription>
          <CardTitle className="text-2xl text-primary">
            ${pipelineValue.toLocaleString()}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardDescription>Closed Won</CardDescription>
          <CardTitle className="text-2xl text-success">
            ${wonValue.toLocaleString()}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
