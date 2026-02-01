import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, User, Building2, PlayCircle, CheckCircle2, ThumbsUp } from 'lucide-react';

export const DemoState7CallCompleted = () => {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dialer" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Power Dialer</h1>
              <p className="text-muted-foreground">Call completed</p>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1">
              <Clock className="h-4 w-4 mr-2" />
              138 minutes remaining
            </Badge>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <Card className="border-green-500/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Call Completed
                  </CardTitle>
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Interested
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">Michael Torres</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      CloudScale Inc • VP of Sales
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-lg font-bold">4:12</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recording</h4>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Button variant="ghost" size="sm" className="rounded-full">
                        <PlayCircle className="h-8 w-8 text-primary" />
                      </Button>
                      <div className="flex-1">
                        <div className="h-1 bg-muted rounded-full">
                          <div className="h-1 bg-primary rounded-full w-0" />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">4:12</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Disposition</h4>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 px-4 py-2">
                        Interested
                      </Badge>
                      <Badge variant="outline" className="px-4 py-2">Not Interested</Badge>
                      <Badge variant="outline" className="px-4 py-2">Callback</Badge>
                      <Badge variant="outline" className="px-4 py-2">No Answer</Badge>
                      <Badge variant="outline" className="px-4 py-2">Wrong Number</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Call Notes</h4>
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      Prospect is interested in learning more about our SDR solution. Currently 
                      has 2 SDRs but struggling with lead quality. Agreed to a demo call this 
                      Thursday at 2pm EST. Decision maker confirmed.
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button className="flex-1">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Next Lead
                  </Button>
                  <Button variant="outline">End Session</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
