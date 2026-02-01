import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Plus, 
  Search,
  Building2,
  Target,
  DollarSign,
  TrendingUp,
  Users,
  MessageSquare,
  Check,
  X
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const DemoStateRepApplied = () => {
  const applicants = [
    { name: 'Sarah Mitchell', initials: 'SM', email: 'sarah.m@email.com', applied: '2 hours ago', status: 'pending' },
    { name: 'Marcus Johnson', initials: 'MJ', email: 'marcus.j@email.com', applied: '5 hours ago', status: 'pending' },
    { name: 'Emily Rodriguez', initials: 'ER', email: 'emily.r@email.com', applied: '1 day ago', status: 'pending' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="jobs" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Jobs" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
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

            {/* Filters */}
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
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-full sm:w-48 bg-muted border-border">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Card - With applicants */}
            <Card className="glass hover:glow-sm transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">SDR at Wick Enterprises</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                            Live
                          </Badge>
                          <Badge variant="outline">Commission Only</Badge>
                          <Badge variant="outline">One-Time</Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm italic">
                      "Close $50k+ deals within first 60 days"
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        B2B SaaS
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        SMB / Mid-Market
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                        <DollarSign className="h-4 w-4" />
                        $1,200
                        <span className="text-xs font-normal text-muted-foreground">/deal</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      $15,000 avg ticket
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      3 applicants
                    </Badge>
                  </div>
                </div>

                {/* Applicants List */}
                <div className="border-t mt-4 pt-4">
                  <h4 className="font-medium mb-3">Applicants (3)</h4>
                  <div className="space-y-2">
                    {applicants.map((applicant, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm">{applicant.initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{applicant.name}</p>
                            <p className="text-xs text-muted-foreground">{applicant.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{applicant.applied}</span>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                            Pending Review
                          </Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};