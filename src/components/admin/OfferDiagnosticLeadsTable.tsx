import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Target, Search, Users, Gauge, RefreshCw, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DiagnosticLead {
  id: string;
  first_name: string | null;
  email: string;
  alignment_score: number | null;
  readiness_label: string | null;
  primary_bottleneck: string | null;
  form_data: Record<string, any> | null;
  latent_scores: Record<string, number> | null;
  source: string | null;
  recommendations_sent: boolean | null;
  created_at: string;
}

function getReadinessBadge(label: string | null) {
  switch (label) {
    case 'Strong':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Strong</Badge>;
    case 'Moderate':
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Moderate</Badge>;
    case 'Weak':
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Weak</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export function OfferDiagnosticLeadsTable() {
  const [leads, setLeads] = useState<DiagnosticLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<DiagnosticLead | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('offer_diagnostic_leads' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data || []) as unknown as DiagnosticLead[]);
    } catch (error) {
      console.error('Error fetching diagnostic leads:', error);
      toast.error('Failed to load diagnostic leads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = leads.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.email.toLowerCase().includes(q) ||
      l.first_name?.toLowerCase().includes(q) ||
      l.readiness_label?.toLowerCase().includes(q) ||
      l.primary_bottleneck?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: leads.length,
    strong: leads.filter(l => l.readiness_label === 'Strong').length,
    moderate: leads.filter(l => l.readiness_label === 'Moderate').length,
    weak: leads.filter(l => l.readiness_label === 'Weak').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.strong}</p>
                <p className="text-sm text-muted-foreground">Strong</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.moderate}</p>
                <p className="text-sm text-muted-foreground">Moderate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.weak}</p>
                <p className="text-sm text-muted-foreground">Weak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Offer Diagnostic Leads
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={fetchLeads}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading leads...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No diagnostic leads found</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Bottleneck</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.first_name || '—'}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>
                        <span className="font-bold">{lead.alignment_score ?? '—'}</span>
                        <span className="text-muted-foreground text-xs">/100</span>
                      </TableCell>
                      <TableCell>{getReadinessBadge(lead.readiness_label)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.primary_bottleneck || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLead(lead)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diagnostic Lead Details</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedLead.first_name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedLead.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Score</p>
                  <p className="font-bold text-lg">{selectedLead.alignment_score}/100</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Readiness</p>
                  {getReadinessBadge(selectedLead.readiness_label)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primary Bottleneck</p>
                  <p className="font-medium">{selectedLead.primary_bottleneck || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p>{format(new Date(selectedLead.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>

              {selectedLead.latent_scores && (
                <div>
                  <p className="text-sm font-medium mb-2">Latent Scores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedLead.latent_scores).map(([key, value]) => (
                      <div key={key} className="flex justify-between bg-muted rounded px-3 py-2">
                        <span className="text-sm">{key}</span>
                        <span className="font-medium text-sm">{value}/20</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLead.form_data && (
                <div>
                  <p className="text-sm font-medium mb-2">Form Inputs</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedLead.form_data)
                      .filter(([_, v]) => v !== null)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between bg-muted rounded px-3 py-2">
                          <span className="text-sm text-muted-foreground">{key}</span>
                          <span className="text-sm font-medium">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
