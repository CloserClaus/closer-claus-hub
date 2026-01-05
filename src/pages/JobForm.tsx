import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SubscriptionGuard } from "@/components/layout/SubscriptionGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X, Plus, Building2, Target, DollarSign, Users } from "lucide-react";

const jobSchema = z.object({
  company_description: z.string().min(10, "Company description must be at least 10 characters").max(500, "Company description must be under 500 characters"),
  offer_description: z.string().min(10, "Offer description must be at least 10 characters").max(300, "Offer description must be under 300 characters"),
  dream_outcome: z.string().min(10, "Dream outcome must be at least 10 characters").max(200, "Dream outcome must be under 200 characters"),
  icp_industry: z.string().min(1, "Industry is required"),
  icp_company_type: z.string().min(1, "Company type is required"),
  icp_company_size_min: z.coerce.number().min(1).optional().nullable(),
  icp_company_size_max: z.coerce.number().optional().nullable(),
  icp_revenue_min: z.coerce.number().optional().nullable(),
  icp_revenue_max: z.coerce.number().optional().nullable(),
  icp_founding_year_min: z.coerce.number().optional().nullable(),
  icp_founding_year_max: z.coerce.number().optional().nullable(),
  icp_intent_signal: z.string().optional(),
  average_ticket_size: z.coerce.number().min(1, "Average ticket size is required"),
  payment_type: z.enum(["recurring", "one_time"]),
  employment_type: z.enum(["commission_only", "salary"]),
  commission_percentage: z.coerce.number().min(1, "Commission must be at least 1%").max(100, "Commission cannot exceed 100%"),
  salary_amount: z.coerce.number().optional().nullable(),
});

type JobFormData = z.infer<typeof jobSchema>;

const INDUSTRIES = [
  "Technology / SaaS",
  "Healthcare",
  "Financial Services",
  "Real Estate",
  "E-commerce / Retail",
  "Manufacturing",
  "Professional Services",
  "Education",
  "Marketing / Advertising",
  "Logistics / Supply Chain",
  "Construction",
  "Hospitality",
  "Insurance",
  "Telecommunications",
  "Energy / Utilities",
  "Other",
];

const COMPANY_TYPES = [
  "Startup (Seed/Series A)",
  "Scale-up (Series B+)",
  "SMB",
  "Mid-Market",
  "Enterprise",
  "Agency",
  "Non-Profit",
  "Government",
];

export default function JobForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [icpJobTitles, setIcpJobTitles] = useState<string[]>([]);
  const [newJobTitle, setNewJobTitle] = useState("");

  const isEditing = !!id;

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      company_description: "",
      offer_description: "",
      dream_outcome: "",
      icp_industry: "",
      icp_company_type: "",
      icp_company_size_min: null,
      icp_company_size_max: null,
      icp_revenue_min: null,
      icp_revenue_max: null,
      icp_founding_year_min: null,
      icp_founding_year_max: null,
      icp_intent_signal: "",
      average_ticket_size: 0,
      payment_type: "one_time",
      employment_type: "commission_only",
      commission_percentage: 10,
      salary_amount: null,
    },
  });

  const employmentType = form.watch("employment_type");
  const companyDescription = form.watch("company_description") || "";
  const offerDescription = form.watch("offer_description") || "";
  const dreamOutcome = form.watch("dream_outcome") || "";

  useEffect(() => {
    if (userRole !== "agency_owner") {
      navigate("/jobs");
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
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (data) {
      setWorkspaceId(data.id);
    }
  };

  const fetchJob = async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      const { data: job, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      form.reset({
        company_description: job.company_description || "",
        offer_description: job.offer_description || "",
        dream_outcome: job.dream_outcome || "",
        icp_industry: job.icp_industry || "",
        icp_company_type: job.icp_company_type || "",
        icp_company_size_min: job.icp_company_size_min,
        icp_company_size_max: job.icp_company_size_max,
        icp_revenue_min: job.icp_revenue_min,
        icp_revenue_max: job.icp_revenue_max,
        icp_founding_year_min: job.icp_founding_year_min,
        icp_founding_year_max: job.icp_founding_year_max,
        icp_intent_signal: job.icp_intent_signal || "",
        average_ticket_size: job.average_ticket_size ? Number(job.average_ticket_size) : 0,
        payment_type: (job.payment_type as "recurring" | "one_time") || "one_time",
        employment_type: job.employment_type,
        commission_percentage: job.commission_percentage ? Number(job.commission_percentage) : 10,
        salary_amount: job.salary_amount ? Number(job.salary_amount) : null,
      });
      setIcpJobTitles(job.icp_job_titles || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load job",
      });
      navigate("/jobs");
    } finally {
      setIsLoading(false);
    }
  };

  const addJobTitle = () => {
    if (newJobTitle.trim() && !icpJobTitles.includes(newJobTitle.trim())) {
      setIcpJobTitles([...icpJobTitles, newJobTitle.trim()]);
      setNewJobTitle("");
    }
  };

  const removeJobTitle = (title: string) => {
    setIcpJobTitles(icpJobTitles.filter((t) => t !== title));
  };

  const onSubmit = async (data: JobFormData) => {
    if (!workspaceId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No workspace found. Please complete onboarding first.",
      });
      return;
    }

    if (icpJobTitles.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one target job title",
      });
      return;
    }

    setSaving(true);

    try {
      const jobData = {
        workspace_id: workspaceId,
        title: "SDR Position",
        description: data.company_description,
        company_description: data.company_description,
        offer_description: data.offer_description,
        dream_outcome: data.dream_outcome,
        icp_job_titles: icpJobTitles,
        icp_industry: data.icp_industry,
        icp_company_type: data.icp_company_type,
        icp_company_size_min: data.icp_company_size_min || null,
        icp_company_size_max: data.icp_company_size_max || null,
        icp_revenue_min: data.icp_revenue_min || null,
        icp_revenue_max: data.icp_revenue_max || null,
        icp_founding_year_min: data.icp_founding_year_min || null,
        icp_founding_year_max: data.icp_founding_year_max || null,
        icp_intent_signal: data.icp_intent_signal || null,
        average_ticket_size: data.average_ticket_size,
        payment_type: data.payment_type,
        employment_type: data.employment_type,
        commission_percentage: data.commission_percentage,
        salary_amount: data.employment_type === "salary" ? data.salary_amount : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("jobs")
          .update(jobData)
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Job updated",
          description: "Your job posting has been updated.",
        });
      } else {
        const { error } = await supabase.from("jobs").insert(jobData);

        if (error) throw error;

        toast({
          title: "Job posted",
          description: "Your job posting is now live!",
        });
      }

      navigate("/jobs");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save job",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title={isEditing ? "Edit SDR Position" : "Post SDR Position"} />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title={isEditing ? "Edit SDR Position" : "Post SDR Position"} />

      <SubscriptionGuard feature="jobs">
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Button variant="ghost" onClick={() => navigate("/jobs")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Button>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Company Information */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                    <CardDescription>
                      Tell SDRs about your company and what you offer
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="company_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your company, what you do, and your mission..."
                              className="min-h-[100px] bg-muted border-border"
                              {...field}
                            />
                          </FormControl>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <FormMessage />
                            <span className={companyDescription.length > 500 ? "text-destructive" : ""}>
                              {companyDescription.length}/500
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offer_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>What You Offer</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What product or service are SDRs selling? What's the value proposition?"
                              className="min-h-[80px] bg-muted border-border"
                              {...field}
                            />
                          </FormControl>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <FormMessage />
                            <span className={offerDescription.length > 300 ? "text-destructive" : ""}>
                              {offerDescription.length}/300
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dream_outcome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dream Outcome</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="We help [X] achieve [Y] without [Z]"
                              className="bg-muted border-border"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Example: "We help SaaS founders achieve 2x ARR growth without hiring a sales team"
                          </FormDescription>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <FormMessage />
                            <span className={dreamOutcome.length > 200 ? "text-destructive" : ""}>
                              {dreamOutcome.length}/200
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Ideal Customer Profile */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Ideal Customer Profile (ICP)
                    </CardTitle>
                    <CardDescription>
                      Define who SDRs will be prospecting and selling to
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Target Job Titles */}
                    <div className="space-y-2">
                      <Label>Target Job Titles *</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., CTO, VP of Engineering, Head of IT"
                          value={newJobTitle}
                          onChange={(e) => setNewJobTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addJobTitle();
                            }
                          }}
                          className="bg-muted border-border"
                        />
                        <Button type="button" onClick={addJobTitle} variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {icpJobTitles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {icpJobTitles.map((title) => (
                            <Badge key={title} variant="secondary" className="gap-1">
                              {title}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeJobTitle(title)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="icp_industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-muted border-border">
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {INDUSTRIES.map((industry) => (
                                  <SelectItem key={industry} value={industry}>
                                    {industry}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="icp_company_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-muted border-border">
                                  <SelectValue placeholder="Select company type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COMPANY_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Company Size */}
                    <div className="space-y-2">
                      <Label>Company Size (Employees)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="icp_company_size_min"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Min employees"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="icp_company_size_max"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Max employees"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Revenue Range */}
                    <div className="space-y-2">
                      <Label>Annual Revenue (in thousands $)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="icp_revenue_min"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Min revenue (e.g., 1000 = $1M)"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="icp_revenue_max"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Max revenue"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Founding Year Range */}
                    <div className="space-y-2">
                      <Label>Founding Year (Optional)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="icp_founding_year_min"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="From year"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="icp_founding_year_max"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="To year"
                                  className="bg-muted border-border"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="icp_intent_signal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intent Signals (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Recently raised funding, hiring engineers, using competitor tools"
                              className="bg-muted border-border"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            What signals indicate a prospect might be ready to buy?
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Deal Structure */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Deal Structure
                    </CardTitle>
                    <CardDescription>
                      Define the typical deal size and payment terms
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="average_ticket_size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Average Ticket Size ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="5000"
                                className="bg-muted border-border"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Typical deal value in USD
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="payment_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-muted border-border">
                                  <SelectValue placeholder="Select payment type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="recurring">Recurring (Subscription)</SelectItem>
                                <SelectItem value="one_time">One-Time</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Compensation */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      SDR Compensation
                    </CardTitle>
                    <CardDescription>
                      {employmentType === "salary"
                        ? "Salaried SDRs receive a monthly salary plus commission on every closed deal"
                        : "Commission-only SDRs earn a percentage of every deal they close"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="employment_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employment Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                                Salary + Commission (Exclusive - SDR works only for you)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                                placeholder="10"
                                className="bg-muted border-border pr-8"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Percentage of deal value paid to SDR on close
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {employmentType === "salary" && (
                      <FormField
                        control={form.control}
                        name="salary_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Salary ($)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  min="100"
                                  placeholder="3000"
                                  className="bg-muted border-border pl-8"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>
                              Base monthly salary in addition to commission
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : isEditing ? "Update Position" : "Post Position"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/jobs")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </main>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
