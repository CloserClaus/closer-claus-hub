import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, Database, TrendingUp, Users, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { format, subMonths, isAfter } from 'date-fns';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 25;
const STALE_THRESHOLD_MONTHS = 12;

interface MasterLead {
  id: string;
  linkedin_url: string;
  apollo_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  industry: string | null;
  enrichment_count: number;
  first_enriched_at: string;
  last_updated_at: string;
  created_at: string;
}

function isLeadStale(lastUpdatedAt: string): boolean {
  const lastUpdated = new Date(lastUpdatedAt);
  const staleDate = subMonths(new Date(), STALE_THRESHOLD_MONTHS);
  return !isAfter(lastUpdated, staleDate);
}

export function MasterLeadsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshingLeadId, setRefreshingLeadId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch master leads with pagination
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['master-leads', currentPage, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('master_leads')
        .select('*', { count: 'exact' })
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (searchQuery) {
        query = query.or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,linkedin_url.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { leads: data as MasterLead[], totalCount: count || 0 };
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['master-leads-stats'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('master_leads')
        .select('enrichment_count, last_updated_at', { count: 'exact' });

      if (error) throw error;

      const totalLeads = count || 0;
      const totalEnrichments = data?.reduce((sum, lead) => sum + (lead.enrichment_count || 1), 0) || 0;
      const creditsSaved = (totalEnrichments - totalLeads) * 5;
      const staleLeads = data?.filter(lead => isLeadStale(lead.last_updated_at)).length || 0;

      return {
        totalLeads,
        totalEnrichments,
        creditsSaved: Math.max(0, creditsSaved),
        staleLeads,
      };
    },
  });

  const totalPages = Math.ceil((leadsData?.totalCount || 0) / ITEMS_PER_PAGE);

  const handleRefreshLead = async (leadId: string) => {
    setRefreshingLeadId(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to refresh leads');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-master-lead`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ master_lead_id: leadId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh lead');
      }

      toast.success('Lead data refreshed successfully');
      queryClient.invalidateQueries({ queryKey: ['master-leads'] });
      queryClient.invalidateQueries({ queryKey: ['master-leads-stats'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh lead');
    } finally {
      setRefreshingLeadId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Master Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalLeads?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Unique enriched leads in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Enrichments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalEnrichments?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Times leads have been used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Saved</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats?.creditsSaved?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">From cache hits (5 credits each)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stale Leads</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats?.staleLeads?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Not updated in 12+ months</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Master Leads Database</CardTitle>
          <CardDescription>
            Centralized enriched lead data used for caching across all workspaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, company, or LinkedIn URL..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : leadsData?.leads?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {searchQuery ? 'No leads match your search' : 'No master leads yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  leadsData?.leads?.map((lead) => {
                    const stale = isLeadStale(lead.last_updated_at);
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {lead.email || '-'}
                          </span>
                        </TableCell>
                        <TableCell>{lead.company_name || '-'}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {lead.title || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={lead.enrichment_count > 1 ? 'default' : 'secondary'}>
                            {lead.enrichment_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {stale ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Stale
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-700">
                              Fresh
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(lead.last_updated_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {stale && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRefreshLead(lead.id)}
                                disabled={refreshingLeadId === lead.id}
                                title="Refresh stale data"
                              >
                                <RefreshCw className={`h-4 w-4 ${refreshingLeadId === lead.id ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {lead.linkedin_url && (
                              <a
                                href={lead.linkedin_url.startsWith('http') ? lead.linkedin_url : `https://${lead.linkedin_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 p-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, leadsData?.totalCount || 0)} of{' '}
                {leadsData?.totalCount || 0} leads
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
