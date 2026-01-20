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
      className={`transition-colors cursor-pointer ${
        isSelected ? 'bg-accent/50 border-primary/30' : 'hover:bg-accent/30'
      }`}
      onClick={onToggleSelect}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium">
                  {lead.first_name} {lead.last_name}
                </h4>
                {lead.title && (
                  <p className="text-sm text-muted-foreground truncate" title={lead.title}>
                    {lead.title}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                {lead.enrichment_status === 'enriched' ? (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Enriched
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Pending</Badge>
                )}
                {lead.seniority && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {lead.seniority.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-1">
              {lead.company_name && (
                <div className="flex items-center gap-1 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{lead.company_name}</span>
                  {lead.employee_count && (
                    <span className="text-xs text-muted-foreground">
                      ({lead.employee_count})
                    </span>
                  )}
                </div>
              )}
              {(lead.city || lead.country) && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                </div>
              )}
              {lead.industry && (
                <Badge variant="outline" className="text-xs mt-1">
                  {lead.industry}
                </Badge>
              )}
            </div>

            {/* LinkedIn and Website are always visible */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {lead.linkedin_url && (
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {lead.company_domain && (
                <a
                  href={`https://${lead.company_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {lead.company_domain}
                </a>
              )}
            </div>
            
            {/* Email and Phone - only visible after enrichment */}
            {lead.enrichment_status === 'enriched' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => e.stopPropagation()}
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
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
