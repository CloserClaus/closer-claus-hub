import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Briefcase, MapPin, DollarSign, Check } from 'lucide-react';

export const DemoState2Jobs = () => {
  const applicants = [
    { name: 'Sarah Mitchell', status: 'hired', initials: 'SM', email: 'sarah.m@email.com' },
    { name: 'Marcus Chen', status: 'interviewed', initials: 'MC', email: 'marcus.c@email.com' },
    { name: 'Emily Rodriguez', status: 'pending', initials: 'ER', email: 'emily.r@email.com' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="jobs" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Jobs</h1>
              <p className="text-muted-foreground">Manage your job postings and applicants</p>
            </div>
            <Button>Post New Job</Button>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Senior SDR - B2B SaaS</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Remote
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> 8% Commission
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Applicants ({applicants.length})</h4>
                <div className="space-y-3">
                  {applicants.map((applicant, index) => (
                    <div 
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        applicant.status === 'hired' ? 'bg-green-500/10 border-green-500/30' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{applicant.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{applicant.name}</p>
                          <p className="text-sm text-muted-foreground">{applicant.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {applicant.status === 'hired' ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                            <Check className="h-3 w-3 mr-1" />
                            Hired
                          </Badge>
                        ) : applicant.status === 'interviewed' ? (
                          <Badge variant="secondary">Interviewed</Badge>
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
        </div>
      </div>
    </div>
  );
};
