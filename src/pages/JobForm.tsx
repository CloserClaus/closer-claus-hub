import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const jobSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().trim().min(50, 'Description must be at least 50 characters').max(5000),
  employment_type: z.enum(['commission_only', 'salary']),
  commission_percentage: z.coerce.number().min(1).max(100).optional().nullable(),
  salary_amount: z.coerce.number().min(100).optional().nullable(),
}).refine((data) => {
  if (data.employment_type === 'commission_only' && !data.commission_percentage) {
    return false;
  }
  if (data.employment_type === 'salary' && !data.salary_amount) {
    return false;
  }
  return true;
}, {
  message: 'Please provide compensation details',
  path: ['commission_percentage'],
});

type JobFormData = z.infer<typeof jobSchema>;

export default function JobForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const isEditing = !!id;

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: '',
      description: '',
      employment_type: 'commission_only',
      commission_percentage: null,
      salary_amount: null,
    },
  });

  const employmentType = form.watch('employment_type');

  useEffect(() => {
    if (userRole !== 'agency_owner') {
      navigate('/jobs');
      return;
    }

    fetchWorkspace();
    if (isEditing) {
      fetchJob();
    }
  }, [user, userRole, id]);

  const fetchWorkspace = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    if (data) {
      setWorkspaceId(data.id);
    }
  };

  const fetchJob = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      form.reset({
        title: data.title,
        description: data.description,
        employment_type: data.employment_type,
        commission_percentage: data.commission_percentage,
        salary_amount: data.salary_amount,
      });
      setRequirements(data.requirements || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load job',
      });
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  const addRequirement = () => {
    if (newRequirement.trim() && requirements.length < 10) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: JobFormData) => {
    if (!workspaceId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No workspace found. Please complete onboarding first.',
      });
      return;
    }

    setSaving(true);

    try {
      const jobData = {
        workspace_id: workspaceId,
        title: data.title,
        description: data.description,
        employment_type: data.employment_type,
        commission_percentage: data.employment_type === 'commission_only' ? data.commission_percentage : null,
        salary_amount: data.employment_type === 'salary' ? data.salary_amount : null,
        requirements: requirements.length > 0 ? requirements : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Job updated',
          description: 'Your job posting has been updated.',
        });
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert(jobData);

        if (error) throw error;

        toast({
          title: 'Job posted',
          description: 'Your job posting is now live!',
        });
      }

      navigate('/jobs');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save job',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardHeader title={isEditing ? 'Edit Job' : 'Post New Job'} />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-4 max-w-2xl">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title={isEditing ? 'Edit Job' : 'Post New Job'} />
      <main className="flex-1 p-6">
        <div className="max-w-2xl space-y-6">
          <Button variant="ghost" onClick={() => navigate('/jobs')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>

          <Card className="glass">
            <CardHeader>
              <CardTitle>{isEditing ? 'Edit Job Posting' : 'Create New Job Posting'}</CardTitle>
              <CardDescription>
                Fill in the details below to {isEditing ? 'update your' : 'create a new'} job posting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Senior Sales Development Representative"
                            {...field}
                            className="bg-muted border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the role, responsibilities, and what you're looking for..."
                            rows={6}
                            {...field}
                            className="bg-muted border-border"
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum 50 characters. Be specific about expectations and benefits.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Select employment type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="commission_only">
                              Commission Only (SDR can work with up to 3 agencies)
                            </SelectItem>
                            <SelectItem value="salary">
                              Salary (Exclusive - SDR works only for you)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {employmentType === 'commission_only' ? (
                    <FormField
                      control={form.control}
                      name="commission_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Percentage</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                placeholder="e.g., 10"
                                {...field}
                                value={field.value ?? ''}
                                className="bg-muted border-border pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Percentage of deal value paid as commission
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="salary_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Salary</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                min="100"
                                placeholder="e.g., 5000"
                                {...field}
                                value={field.value ?? ''}
                                className="bg-muted border-border pl-8"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Monthly salary in USD
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Requirements */}
                  <div className="space-y-3">
                    <FormLabel>Requirements (Optional)</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        value={newRequirement}
                        onChange={(e) => setNewRequirement(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addRequirement();
                          }
                        }}
                        placeholder="Add a requirement..."
                        className="bg-muted border-border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addRequirement}
                        disabled={!newRequirement.trim() || requirements.length >= 10}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {requirements.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {requirements.map((req, index) => (
                          <Badge key={index} variant="secondary" className="gap-1 pr-1">
                            {req}
                            <button
                              type="button"
                              onClick={() => removeRequirement(index)}
                              className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : isEditing ? 'Update Job' : 'Post Job'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
}
