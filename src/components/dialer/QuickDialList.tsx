import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Search, Clock, Tag, MessageSquare, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  title: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  readiness_segment: string | null;
  latest_tags?: string[];
  latest_disposition?: string | null;
}

interface QuickDialListProps {
  leads: Lead[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedLead: Lead | null;
  isCallActive: boolean;
  onSelectLead: (lead: Lead) => void;
  onOpenCrmSidebar: (lead: any) => void;
}

export function QuickDialList({
  leads, searchQuery, setSearchQuery, selectedLead, isCallActive, onSelectLead, onOpenCrmSidebar,
}: QuickDialListProps) {
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return lead.first_name.toLowerCase().includes(query) || lead.last_name.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query) || lead.phone?.includes(query);
  });

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Quick Dial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No leads with phone numbers found</p>
            ) : (
              filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedLead?.id === lead.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button onClick={() => onSelectLead(lead)} disabled={isCallActive} className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                        {lead.readiness_segment && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                            <Tag className="h-2.5 w-2.5" />{lead.readiness_segment}
                          </Badge>
                        )}
                        {lead.latest_disposition && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {lead.latest_disposition.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      {lead.latest_tags && lead.latest_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lead.latest_tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/50">
                              <Tag className="h-2 w-2 mr-0.5" />{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {lead.company && <p className="text-sm text-muted-foreground">{lead.company}</p>}
                      {lead.notes && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 line-clamp-1">
                          <MessageSquare className="h-3 w-3 shrink-0" />{lead.notes.split('\n').pop()?.substring(0, 60)}
                        </p>
                      )}
                      {lead.last_contacted_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />Last called {format(new Date(lead.last_contacted_at), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </button>
                    <div className="flex flex-col items-end gap-1 ml-2">
                      <p className="text-sm font-mono text-muted-foreground">{lead.phone}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          (async () => {
                            const { data } = await supabase.from('leads').select('*').eq('id', lead.id).single();
                            if (data) onOpenCrmSidebar(data);
                          })();
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        title="View in CRM"
                      >
                        <ExternalLink className="h-3 w-3" />CRM
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
