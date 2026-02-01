import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Phone, Target, Calendar } from 'lucide-react';

interface DemoState3TeamProps {
  subState?: string;
}

export const DemoState3Team = ({ subState = 'accepted' }: DemoState3TeamProps) => {
    { 
      name: 'Sarah Mitchell', 
      role: 'SDR', 
      status: 'active', 
      initials: 'SM',
      leads: 0,
      calls: 0,
      meetings: 0,
      joinedAt: 'Just now'
    },
    { 
      name: 'Alex Johnson', 
      role: 'SDR', 
      status: 'active', 
      initials: 'AJ',
      leads: 24,
      calls: 156,
      meetings: 8,
      joinedAt: '3 months ago'
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="team" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Team Management</h1>
              <p className="text-muted-foreground">Manage your sales team</p>
            </div>
          </div>
          
          <div className="grid gap-4">
            {teamMembers.map((member, index) => (
              <Card key={index} className={index === 0 ? 'ring-2 ring-green-500/50' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="text-lg">{member.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{member.name}</h3>
                          <Badge 
                            variant={member.status === 'active' ? 'default' : 'secondary'}
                            className={member.status === 'active' ? 'bg-green-500/20 text-green-500' : ''}
                          >
                            {member.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="outline" className="text-primary border-primary">
                              New Hire
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{member.role} • Joined {member.joinedAt}</p>
                      </div>
                    </div>
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
      </div>
    </div>
  );
};
