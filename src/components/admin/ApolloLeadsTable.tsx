import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, Mail, Phone, Sparkles, Clock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

export function ApolloLeadsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['admin-apollo-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apollo_leads')
        .select(`
          *,
          workspaces(name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-apollo-stats'],
    queryFn: async () => {
      const [
        { count: totalCount },
        { count: enrichedCount },
        { count: pendingCount },
        { data: creditData },
      ] = await Promise.all([
        supabase.from('apollo_leads').select('*', { count: 'exact', head: true }),
        supabase.from('apollo_leads').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'enriched'),
        supabase.from('apollo_leads').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'pending'),
        supabase.from('apollo_leads').select('credits_used').eq('enrichment_status', 'enriched'),
      ]);

      const totalCreditsUsed = creditData?.reduce((sum, lead) => sum + (lead.credits_used || 0), 0) || 0;

      return {
        total: totalCount || 0,
        enriched: enrichedCount || 0,
        pending: pendingCount || 0,
        creditsUsed: totalCreditsUsed,
      };
    },
  });

  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = searchQuery === '' || 
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.enrichment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enriched':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Enriched
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading Apollo leads...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Searches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.enriched || 0}</p>
                <p className="text-xs text-muted-foreground">Enriched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.creditsUsed || 0}</p>
                <p className="text-xs text-muted-foreground">Credits Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Apollo Leads ({filteredLeads?.length || 0})
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="enriched">Enriched</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLeads && filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                          {lead.title && (
                            <p className="text-xs text-muted-foreground">{lead.title}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{lead.company_name || '-'}</p>
                          {lead.industry && (
                            <p className="text-xs text-muted-foreground">{lead.industry}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {(lead.workspaces as any)?.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.enrichment_status === 'enriched' ? (
                          <div className="space-y-1">
                            {lead.email && (
                              <div className="flex items-center gap-1 text-xs">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {lead.email}
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {lead.phone}
                              </div>
                            )}
                            {lead.linkedin_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs"
                                asChild
                              >
                                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  LinkedIn
                                </a>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not enriched</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.enrichment_status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{lead.credits_used || 0}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(lead.created_at!), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No Apollo leads found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
