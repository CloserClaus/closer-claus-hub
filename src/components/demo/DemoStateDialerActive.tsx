import { DemoSidebar } from './DemoSidebar';
import { DemoHeader } from './DemoHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  Clock, 
  User, 
  Building2,
  Pause,
  Volume2
} from 'lucide-react';

export const DemoStateDialerActive = () => {
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
                <p className="text-muted-foreground">Active call in progress</p>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                138 minutes remaining
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Active Call Panel */}
              <Card className="border-2 border-green-500/50 bg-green-500/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      Active Call
                    </CardTitle>
                    <Badge className="bg-green-500 text-white text-base px-3 py-1">
                      <Clock className="h-4 w-4 mr-1" />
                      02:34
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 ring-4 ring-green-500/30">
                      <User className="h-12 w-12 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold">Michael Torres</h3>
                    <p className="text-muted-foreground flex items-center justify-center gap-2 mt-1">
                      <Building2 className="h-4 w-4" />
                      CloudScale Inc
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">VP of Sales</p>
                    <p className="font-mono text-sm text-muted-foreground mt-2">+1 (555) 123-4567</p>
                  </div>
                  
                  <div className="flex justify-center gap-4 mt-6">
                    <Button variant="outline" size="lg" className="rounded-full w-16 h-16">
                      <Mic className="h-6 w-6" />
                    </Button>
                    <Button variant="outline" size="lg" className="rounded-full w-16 h-16">
                      <Volume2 className="h-6 w-6" />
                    </Button>
                    <Button variant="outline" size="lg" className="rounded-full w-16 h-16">
                      <Pause className="h-6 w-6" />
                    </Button>
                    <Button variant="destructive" size="lg" className="rounded-full w-16 h-16">
                      <PhoneOff className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="mt-6 p-3 bg-green-500/10 rounded-lg border border-green-500/20 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-green-500 rounded-full animate-pulse"
                          style={{ 
                            height: `${12 + Math.random() * 16}px`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-green-500 font-medium">Recording...</span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Script Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Call Script</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <h4 className="font-medium text-sm text-primary mb-2">Opening</h4>
                    <p className="text-sm">
                      "Hi <span className="bg-primary/20 px-1 rounded font-medium">Michael</span>, this is Sarah from Closer Claus. I noticed <span className="bg-primary/20 px-1 rounded font-medium">CloudScale Inc</span> has been 
                      scaling your sales team recently. Do you have a quick moment?"
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium text-sm text-primary mb-2">Value Prop</h4>
                    <p className="text-sm">
                      "We help companies like <span className="bg-muted px-1 rounded">CloudScale Inc</span> build high-performing outbound sales 
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
        </main>
      </div>
    </div>
  );
};