import { DemoSidebar } from './DemoSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Clock, User, Building2, Mail, Pause } from 'lucide-react';

export const DemoState6Dialer = () => {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <DemoSidebar activePage="dialer" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Power Dialer</h1>
              <p className="text-muted-foreground">Make calls efficiently</p>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1">
              <Clock className="h-4 w-4 mr-2" />
              142 minutes remaining
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Active Call Panel */}
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    Active Call
                  </CardTitle>
                  <Badge className="bg-green-500 text-white">
                    <Clock className="h-3 w-3 mr-1" />
                    02:34
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{"{{first_name}}"} Torres</h3>
                  <p className="text-muted-foreground flex items-center justify-center gap-2 mt-1">
                    <Building2 className="h-4 w-4" />
                    {"{{company_name}}"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">VP of Sales</p>
                  <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                </div>
                
                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" size="lg" className="rounded-full w-14 h-14">
                    <Mic className="h-6 w-6" />
                  </Button>
                  <Button variant="outline" size="lg" className="rounded-full w-14 h-14">
                    <Pause className="h-6 w-6" />
                  </Button>
                  <Button variant="destructive" size="lg" className="rounded-full w-14 h-14">
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Script Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call Script</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-primary mb-2">Opening</h4>
                  <p className="text-sm">
                    "Hi {"{{first_name}}"}, this is Sarah from Closer Claus. I noticed {"{{company_name}}"} has been 
                    scaling your sales team recently. Do you have a quick moment?"
                  </p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-primary mb-2">Value Prop</h4>
                  <p className="text-sm">
                    "We help companies like {"{{company_name}}"} build high-performing outbound sales 
                    systems. Our clients typically see a 40% increase in meetings booked within 
                    the first 60 days."
                  </p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-primary mb-2">Qualifying Questions</h4>
                  <ul className="text-sm space-y-2">
                    <li>• What's your current outbound strategy?</li>
                    <li>• How many SDRs do you have on the team?</li>
                    <li>• What's your target for meetings this quarter?</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm text-primary mb-2">Close</h4>
                  <p className="text-sm">
                    "Based on what you've shared, I think we could help. Would you be open to a 
                    15-minute call this week to explore this further?"
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
