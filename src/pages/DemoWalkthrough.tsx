import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Download, Play } from 'lucide-react';
import { DemoState1Dashboard } from '@/components/demo/DemoState1Dashboard';
import { DemoState2Jobs } from '@/components/demo/DemoState2Jobs';
import { DemoState3Team } from '@/components/demo/DemoState3Team';
import { DemoState4Leads } from '@/components/demo/DemoState4Leads';
import { DemoState5CRM } from '@/components/demo/DemoState5CRM';
import { DemoState6Dialer } from '@/components/demo/DemoState6Dialer';
import { DemoState7CallCompleted } from '@/components/demo/DemoState7CallCompleted';
import { DemoState8MeetingBooked } from '@/components/demo/DemoState8MeetingBooked';
import { DemoState9DealClosed } from '@/components/demo/DemoState9DealClosed';
import { DemoState10Contracts } from '@/components/demo/DemoState10Contracts';
import { DemoState11Payouts } from '@/components/demo/DemoState11Payouts';
import { DemoState12DashboardAfter } from '@/components/demo/DemoState12DashboardAfter';

const STATES = [
  { id: 1, title: 'Baseline Dashboard', component: DemoState1Dashboard },
  { id: 2, title: 'Jobs – Rep Hired', component: DemoState2Jobs },
  { id: 3, title: 'Team – Rep Active', component: DemoState3Team },
  { id: 4, title: 'Leads – Sourcing', component: DemoState4Leads },
  { id: 5, title: 'CRM Pipeline', component: DemoState5CRM },
  { id: 6, title: 'Dialer – Active Call', component: DemoState6Dialer },
  { id: 7, title: 'Call Completed', component: DemoState7CallCompleted },
  { id: 8, title: 'Meeting Booked', component: DemoState8MeetingBooked },
  { id: 9, title: 'Deal Closed', component: DemoState9DealClosed },
  { id: 10, title: 'Contracts', component: DemoState10Contracts },
  { id: 11, title: 'Payouts', component: DemoState11Payouts },
  { id: 12, title: 'Dashboard – After', component: DemoState12DashboardAfter },
];

const DemoWalkthrough = () => {
  const [currentState, setCurrentState] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleNext = () => {
    if (currentState < STATES.length - 1) {
      setCurrentState(currentState + 1);
    }
  };

  const handlePrev = () => {
    if (currentState > 0) {
      setCurrentState(currentState - 1);
    }
  };

  const handleDownload = async () => {
    if (!contentRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#09090b',
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `closer-claus-state-${STATES[currentState].id}-${STATES[currentState].title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const CurrentComponent = STATES[currentState].component;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Controls */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              State {STATES[currentState].id} of {STATES.length}
            </span>
            <span className="font-medium">{STATES[currentState].title}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentState === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1">
              {STATES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentState(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentState 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentState === STATES.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Saving...' : 'Download'}
            </Button>
          </div>
        </div>
      </div>

      {/* State Content */}
      <div className="flex-1 overflow-auto">
        <div ref={contentRef} className="min-h-[calc(100vh-60px)]">
          <CurrentComponent />
        </div>
      </div>
    </div>
  );
};

export default DemoWalkthrough;
