import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Briefcase, 
  DollarSign, 
  Check, 
  Plus, 
  Search,
  Building2,
  Target,
  Users,
  TrendingUp
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DemoState2JobsProps {
  subState?: string;
}

export const DemoState2Jobs = ({ subState = 'before' }: DemoState2JobsProps) => {
  const isBeforePosting = subState === 'before';

  // Jobs list data - matching actual Jobs.tsx structure
  const jobs = isBeforePosting ? [] : [
    {
      id: '1',
      title: 'SDR at Wick Enterprises',
      company: 'Wick Enterprises',
      isActive: true,
      employmentType: 'Commission Only',
      industry: 'B2B SaaS',
      avgTicket: 15000,
      commission: 8,
      paymentType: 'One-Time',
      dreamOutcome: 'Close $50k+ deals within first 60 days',
      applicantCount: 4,
    },
  ];

  const applicants = [
    { name: 'Sarah Chen', status: 'interviewed', initials: 'SC', email: 'sarah.chen@email.com', applied: '2 days ago' },
    { name: 'Marcus Johnson', status: 'pending', initials: 'MJ', email: 'marcus.j@email.com', applied: '3 days ago' },
    { name: 'Emily Rodriguez', status: 'pending', initials: 'ER', email: 'emily.r@email.com', applied: '5 days ago' },
    { name: 'David Kim', status: 'rejected', initials: 'DK', email: 'david.k@email.com', applied: '1 week ago' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="jobs" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Jobs" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header - matches actual Jobs.tsx */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">My SDR Positions</h1>
                <p className="text-muted-foreground">
                  Create and manage SDR positions for your agency
                </p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Post Position
              </Button>
            </div>

            {/* Filters - matches actual Jobs.tsx */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company, industry, or description..."
                  className="pl-10 bg-muted border-border"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  <SelectItem value="saas">B2B SaaS</SelectItem>
                  <SelectItem value="fintech">FinTech</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="commission_only">Commission Only</SelectItem>
                  <SelectItem value="salary">Salary + Commission</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content based on subState */}
            {isBeforePosting ? (
              // Empty state - before posting a job
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No positions posted yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first SDR position to start hiring
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Post Your First Position
                  </Button>
                </CardContent>
              </Card>
            ) : (
              // Jobs list with applicants
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="glass hover:glow-sm transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Left: Company & Role Info */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{job.title}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge variant={job.isActive ? 'default' : 'secondary'}>
                                  {job.isActive ? 'Hiring' : 'Closed'}
                                </Badge>
                                <Badge variant="outline">{job.employmentType}</Badge>
                                <Badge variant="outline">{job.paymentType}</Badge>
                              </div>
                            </div>
                          </div>

                          <p className="text-muted-foreground text-sm italic">
                            "{job.dreamOutcome}"
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Target className="h-3.5 w-3.5" />
                              {job.industry}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              SMB / Mid-Market
                            </span>
                          </div>
                        </div>

                        {/* Right: Compensation & Stats */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                              <DollarSign className="h-4 w-4" />
                              ${((job.avgTicket * job.commission) / 100).toLocaleString()}
                              <span className="text-xs font-normal text-muted-foreground">/deal</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <TrendingUp className="h-3.5 w-3.5" />
                            ${job.avgTicket.toLocaleString()} avg ticket
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {job.applicantCount} applicants
                          </div>
                        </div>
                      </div>

                      {/* Applicants Section */}
                      <div className="border-t mt-4 pt-4">
                        <h4 className="font-medium mb-3">Applicants ({applicants.length})</h4>
                        <div className="space-y-2">
                          {applicants.map((applicant, index) => (
                            <div 
                              key={index}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                applicant.status === 'interviewed' 
                                  ? 'bg-blue-500/10 border-blue-500/30' 
                                  : applicant.status === 'rejected'
                                    ? 'bg-muted/50 border-border'
                                    : 'bg-card border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs">{applicant.initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{applicant.name}</p>
                                  <p className="text-xs text-muted-foreground">{applicant.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{applicant.applied}</span>
                                {applicant.status === 'interviewed' ? (
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                    Interviewed
                                  </Badge>
                                ) : applicant.status === 'rejected' ? (
                                  <Badge variant="secondary">Rejected</Badge>
                                ) : (
                                  <Badge variant="outline">Pending Review</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
