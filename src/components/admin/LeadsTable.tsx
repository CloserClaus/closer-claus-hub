import { useQuery } from '@tanstack/react-query';
import { UserCircle, Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export function LeadsTable() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ['admin-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          workspaces(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading leads...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          All Leads ({leads?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads && leads.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                      {lead.title && (
                        <p className="text-xs text-muted-foreground">{lead.title}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {(lead.workspaces as any)?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
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
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No leads yet</p>
        )}
      </CardContent>
    </Card>
  );
}