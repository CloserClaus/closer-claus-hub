import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Plus, 
  Users,
  Phone,
  Target,
  Calendar,
  CheckCircle2,
  Star
} from 'lucide-react';

export const DemoStateRepAccepted = () => {
  const teamMembers = [
    { 
      name: 'Sarah Mitchell', 
      initials: 'SM',
      role: 'SDR',
      status: 'active',
      leads: 0,
      calls: 0,
      meetings: 0,
      joinedAt: 'Just now',
      isNew: true
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="team" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Team Management" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Team Management</h1>
                <p className="text-muted-foreground">
                  Manage your sales team and SDRs
                </p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Invite Team Member
              </Button>
            </div>

            {/* Success Banner */}
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-green-500">New team member added!</p>
                <p className="text-sm text-muted-foreground">Sarah Mitchell has been accepted and added to your team.</p>
              </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Team Size</p>
                      <p className="text-2xl font-bold">1</p>
                    </div>
                    <Users className="h-8 w-8 text-primary/50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Leads</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <Target className="h-8 w-8 text-blue-500/50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Calls Made</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <Phone className="h-8 w-8 text-green-500/50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Meetings</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-500/50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Member Card */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Active Team Members</h2>
              
              {teamMembers.map((member, index) => (
                <Card 
                  key={index} 
                  className="glass ring-2 ring-green-500/50 bg-green-500/5"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="text-xl bg-primary/20 text-primary">{member.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{member.name}</h3>
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                              Active
                            </Badge>
                            <Badge variant="outline" className="text-primary border-primary flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              New Hire
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{member.role} • Joined {member.joinedAt}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Target className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{member.leads}</p>
                          <p className="text-sm text-muted-foreground">Assigned Leads</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{member.calls}</p>
                          <p className="text-sm text-muted-foreground">Total Calls</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{member.meetings}</p>
                          <p className="text-sm text-muted-foreground">Meetings Booked</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};