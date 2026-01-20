import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

type SortField = 'name' | 'company' | 'title' | 'location' | 'status';
type SortDirection = 'asc' | 'desc';

interface ResultsTableProps {
  leads: ApolloLead[];
  selectedLeads: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ResultsTable({
  leads,
  selectedLeads,
  onSelectionChange,
}: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(leads.map((lead) => lead.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedLeads.includes(id)) {
      onSelectionChange(selectedLeads.filter((leadId) => leadId !== id));
    } else {
      onSelectionChange([...selectedLeads, id]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const sortedLeads = [...leads].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'name':
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB) * direction;
      case 'company':
        return (a.company_name || '').localeCompare(b.company_name || '') * direction;
      case 'title':
        return (a.title || '').localeCompare(b.title || '') * direction;
      case 'location':
        const locA = [a.city, a.country].filter(Boolean).join(', ');
        const locB = [b.city, b.country].filter(Boolean).join(', ');
        return locA.localeCompare(locB) * direction;
      case 'status':
        return a.enrichment_status.localeCompare(b.enrichment_status) * direction;
      default:
        return 0;
    }
  });

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-12 sticky left-0 bg-muted/30 z-10">
              <Checkbox
                checked={selectedLeads.length === leads.length && leads.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="min-w-[150px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-7 text-xs font-semibold flex items-center gap-1"
                onClick={() => handleSort('name')}
              >
                Name
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[160px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-7 text-xs font-semibold flex items-center gap-1"
                onClick={() => handleSort('title')}
              >
                Title
                <SortIcon field="title" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[180px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-7 text-xs font-semibold flex items-center gap-1"
                onClick={() => handleSort('company')}
              >
                Company
                <SortIcon field="company" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[140px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-7 text-xs font-semibold flex items-center gap-1"
                onClick={() => handleSort('location')}
              >
                Location
                <SortIcon field="location" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[110px] text-xs font-semibold">Links</TableHead>
            <TableHead className="min-w-[200px] text-xs font-semibold">Contact Info</TableHead>
            <TableHead className="text-right min-w-[100px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-semibold flex items-center gap-1 ml-auto"
                onClick={() => handleSort('status')}
              >
                Status
                <SortIcon field="status" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLeads.map((lead) => (
            <TableRow 
              key={lead.id}
              className={`transition-colors ${selectedLeads.includes(lead.id) ? 'bg-primary/5' : ''}`}
            >
              <TableCell className="sticky left-0 bg-background z-10">
                <Checkbox
                  checked={selectedLeads.includes(lead.id)}
                  onCheckedChange={() => toggleSelect(lead.id)}
                />
              </TableCell>
              {/* Name */}
              <TableCell className="py-3">
                <div className="space-y-1">
                  <div className="font-medium text-sm leading-tight">
                    {lead.first_name} {lead.last_name}
                  </div>
                  {lead.seniority && (
                    <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0 font-normal">
                      {lead.seniority.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              {/* Title */}
              <TableCell className="py-3">
                <div className="space-y-0.5">
                  <span className="text-sm line-clamp-2 leading-tight" title={lead.title || ''}>
                    {lead.title || <span className="text-muted-foreground">—</span>}
                  </span>
                  {lead.department && (
                    <span className="text-[11px] text-muted-foreground block">{lead.department}</span>
                  )}
                </div>
              </TableCell>
              {/* Company */}
              <TableCell className="py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[150px]" title={lead.company_name || ''}>
                      {lead.company_name || <span className="text-muted-foreground font-normal">—</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.employee_count && (
                      <span className="text-[11px] text-muted-foreground">
                        {lead.employee_count} emp
                      </span>
                    )}
                    {lead.industry && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {lead.industry}
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>
              {/* Location */}
              <TableCell className="py-3">
                {(lead.city || lead.country) ? (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm line-clamp-2 leading-tight">
                      {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              {/* Links */}
              <TableCell className="py-3">
                <div className="flex flex-col gap-1.5">
                  {lead.linkedin_url ? (
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                    >
                      <Linkedin className="h-3.5 w-3.5 flex-shrink-0" />
                      LinkedIn
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
                      <Linkedin className="h-3.5 w-3.5 flex-shrink-0" />
                      —
                    </span>
                  )}
                  {lead.company_domain ? (
                    <a
                      href={`https://${lead.company_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                    >
                      <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{lead.company_domain}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
                      <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                      —
                    </span>
                  )}
                </div>
              </TableCell>
              {/* Contact Info */}
              <TableCell className="py-3">
                {lead.enrichment_status === 'enriched' ? (
                  <div className="flex flex-col gap-1.5">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                      >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        Not available
                      </span>
                    )}
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                      >
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        Not available
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="italic">Locked</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="italic">Locked</span>
                    </span>
                  </div>
                )}
              </TableCell>
              {/* Status */}
              <TableCell className="text-right py-3">
                {lead.enrichment_status === 'enriched' ? (
                  <Badge className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
                    <Sparkles className="h-2.5 w-2.5" />
                    Enriched
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Pending
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
