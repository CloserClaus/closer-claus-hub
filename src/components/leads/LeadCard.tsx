import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type ApolloLead = Tables<'apollo_leads'>;

interface LeadCardProps {
  lead: ApolloLead;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function LeadCard({ lead, isSelected, onToggleSelect }: LeadCardProps) {
  return (
    <Card 
      className={`transition-all duration-200 cursor-pointer ${
        isSelected 
          ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
          : 'hover:bg-muted/50 hover:border-muted-foreground/20'
      }`}
      onClick={onToggleSelect}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm leading-tight">
                  {lead.first_name} {lead.last_name}
                </h4>
                {lead.title && (
                  <p className="text-xs text-muted-foreground line-clamp-1" title={lead.title}>
                    {lead.title}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                {lead.enrichment_status === 'enriched' ? (
                  <Badge className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <Sparkles className="h-2.5 w-2.5" />
                    Enriched
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Pending</Badge>
                )}
                {lead.seniority && (
                  <Badge variant="secondary" className="text-[10px] capitalize font-normal">
                    {lead.seniority.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-1.5">
              {lead.company_name && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{lead.company_name}</span>
                  {lead.employee_count && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      · {lead.employee_count}
                    </span>
                  )}
                </div>
              )}
              {(lead.city || lead.country) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {lead.industry && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {lead.industry}
                </Badge>
              )}
            </div>

            {/* Links - Always visible */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-border/50">
              {lead.linkedin_url ? (
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
                  <Linkedin className="h-3 w-3" />
                  —
                </span>
              )}
              {lead.company_domain ? (
                <a
                  href={`https://${lead.company_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Website
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
                  <ExternalLink className="h-3 w-3" />
                  —
                </span>
              )}
            </div>
            
            {/* Contact Info */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {lead.enrichment_status === 'enriched' ? (
                <>
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[150px]">{lead.email}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      Not available
                    </span>
                  )}
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      Not available
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Mail className="h-3 w-3" />
                    <span className="italic">Locked</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Phone className="h-3 w-3" />
                    <span className="italic">Locked</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
