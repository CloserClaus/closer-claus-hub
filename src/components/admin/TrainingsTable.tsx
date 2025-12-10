import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Building2, FileText, Video, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export function TrainingsTable() {
  const { data: trainings, isLoading } = useQuery({
    queryKey: ['admin-trainings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_materials')
        .select(`
          *,
          workspaces(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'document': return FileText;
      default: return File;
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading training materials...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          All Training Materials ({trainings?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trainings && trainings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainings.map((training) => {
                const Icon = getContentIcon(training.content_type);
                return (
                  <TableRow key={training.id}>
                    <TableCell className="font-medium">{training.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {(training.workspaces as any)?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary">{training.content_type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {training.description || 'No description'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(training.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No training materials yet</p>
        )}
      </CardContent>
    </Card>
  );
}