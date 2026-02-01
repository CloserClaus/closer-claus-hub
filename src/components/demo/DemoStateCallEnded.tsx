import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Clock, 
  User, 
  Building2,
  PlayCircle,
  CheckCircle2,
  ThumbsUp,
  Calendar
} from 'lucide-react';

export const DemoStateCallEnded = () => {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dialer" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoHeader title="Dialer" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Power Dialer</h1>
                <p className="text-muted-foreground">Call completed and logged</p>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                134 minutes remaining
              </Badge>
            </div>
            
            <div className="max-w-3xl mx-auto">
              <Card className="border-2 border-green-500/30">
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
                  {/* Lead Info */}
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <User className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">Michael Torres</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        CloudScale Inc • VP of Sales
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-2xl font-bold text-green-500">4:12</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Recording */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Recording</h4>
                      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                        <Button variant="ghost" size="sm" className="rounded-full h-12 w-12">
                          <PlayCircle className="h-8 w-8 text-primary" />
                        </Button>
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-2 bg-primary rounded-full w-0" />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>0:00</span>
                            <span>4:12</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Disposition */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Disposition</h4>
                      <div className="flex gap-2 flex-wrap">
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 px-4 py-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Interested
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2 opacity-50">Not Interested</Badge>
                        <Badge variant="outline" className="px-4 py-2 opacity-50">Callback</Badge>
                        <Badge variant="outline" className="px-4 py-2 opacity-50">No Answer</Badge>
                        <Badge variant="outline" className="px-4 py-2 opacity-50">Wrong Number</Badge>
                      </div>
                    </div>
                    
                    {/* Call Notes */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Call Notes</h4>
                      <div className="p-4 bg-muted/50 rounded-lg text-sm border">
                        Prospect is interested in learning more about our SDR solution. Currently 
                        has 2 SDRs but struggling with lead quality. Agreed to a demo call this 
                        Thursday at 2pm EST. Decision maker confirmed.
                      </div>
                    </div>

                    {/* Next Action */}
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-purple-500">Meeting Scheduled</p>
                          <p className="text-sm text-muted-foreground">Thursday, Feb 6 at 2:00 PM EST - Demo Call</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6 pt-6 border-t">
                    <Button className="flex-1 gap-2">
                      <Phone className="h-4 w-4" />
                      Call Next Lead
                    </Button>
                    <Button variant="outline">End Session</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};