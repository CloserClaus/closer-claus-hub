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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedLeads.length === leads.length && leads.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 flex items-center gap-1"
                onClick={() => handleSort('name')}
              >
                Name
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 flex items-center gap-1"
                onClick={() => handleSort('title')}
              >
                Title
                <SortIcon field="title" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 flex items-center gap-1"
                onClick={() => handleSort('company')}
              >
                Company
                <SortIcon field="company" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 flex items-center gap-1"
                onClick={() => handleSort('location')}
              >
                Location
                <SortIcon field="location" />
              </Button>
            </TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="-mr-3 h-8 flex items-center gap-1"
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
              className={selectedLeads.includes(lead.id) ? 'bg-accent/50' : ''}
            >
              <TableCell>
                <Checkbox
                  checked={selectedLeads.includes(lead.id)}
                  onCheckedChange={() => toggleSelect(lead.id)}
                />
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {lead.first_name} {lead.last_name}
                </div>
                {lead.seniority && (
                  <Badge variant="outline" className="mt-1 text-xs capitalize">
                    {lead.seniority.replace('_', ' ')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <span className="text-sm truncate block" title={lead.title || ''}>
                  {lead.title || '-'}
                </span>
                {lead.department && (
                  <span className="text-xs text-muted-foreground">{lead.department}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{lead.company_name || '-'}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {lead.employee_count && (
                    <span className="text-xs text-muted-foreground">
                      {lead.employee_count} employees
                    </span>
                  )}
                  {lead.industry && (
                    <Badge variant="secondary" className="text-xs">
                      {lead.industry}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {(lead.city || lead.country) ? (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {/* LinkedIn and Website are always visible */}
                  {lead.linkedin_url && (
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Linkedin className="h-3 w-3" />
                      Profile
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {lead.company_domain && (
                    <a
                      href={`https://${lead.company_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {lead.company_domain}
                    </a>
                  )}
                  {/* Email and Phone only visible after enrichment */}
                  {lead.enrichment_status === 'enriched' ? (
                    <>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          No email found
                        </span>
                      )}
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          No phone found
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Enrich to reveal email & phone
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {lead.enrichment_status === 'enriched' ? (
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Enriched
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
