import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Download } from 'lucide-react';

// Import all demo states
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

// All 19 states as specified
const STATES = [
  // STATE 1: Baseline Dashboard (2 screenshots)
  { id: '1a', title: 'Dashboard - Full Metrics', component: DemoState1Dashboard, subState: 'full' },
  { id: '1b', title: 'Dashboard - After Minimal Activity', component: DemoState1Dashboard, subState: 'activity' },
  
  // STATE 2: Job Creation Flow (2 screenshots)
  { id: '2a', title: 'Jobs - Before Posting', component: DemoState2Jobs, subState: 'before' },
  { id: '2b', title: 'Jobs - With Applicants', component: DemoState2Jobs, subState: 'applicants' },
  
  // STATE 3: Rep Onboarding (2 screenshots)
  { id: '3a', title: 'Team - Applicant Accepted', component: DemoState3Team, subState: 'accepted' },
  { id: '3b', title: 'Team - Rep Active', component: DemoState3Team, subState: 'active' },
  
  // STATE 4: Lead Sourcing (2 screenshots)
  { id: '4a', title: 'Leads - Filters Applied', component: DemoState4Leads, subState: 'filters' },
  { id: '4b', title: 'Leads - Ready for Import', component: DemoState4Leads, subState: 'ready' },
  
  // STATE 5: CRM Ingestion (2 screenshots)
  { id: '5a', title: 'CRM - Leads Imported', component: DemoState5CRM, subState: 'imported' },
  { id: '5b', title: 'CRM - Pipeline Populated', component: DemoState5CRM, subState: 'populated' },
  
  // STATE 6: Dialer Execution (3 screenshots)
  { id: '6a', title: 'Dialer - Queue Loaded', component: DemoState6Dialer, subState: 'idle' },
  { id: '6b', title: 'Dialer - Active Call', component: DemoState6Dialer, subState: 'calling' },
  { id: '6c', title: 'Dialer - Call Completed', component: DemoState7CallCompleted, subState: 'completed' },
  
  // STATE 7: Meeting Booked (1 screenshot)
  { id: '7', title: 'CRM - Meeting Booked', component: DemoState8MeetingBooked, subState: 'booked' },
  
  // STATE 8: Deal Closed (1 screenshot)
  { id: '8', title: 'CRM - Deal Closed Won', component: DemoState9DealClosed, subState: 'closed' },
  
  // STATE 9: Contract Sent (1 screenshot)
  { id: '9', title: 'Contracts - Sent & Signed', component: DemoState10Contracts, subState: 'sent' },
  
  // STATE 10: Payouts (1 screenshot)
  { id: '10', title: 'Commissions - Payout Visible', component: DemoState11Payouts, subState: 'payout' },
  
  // STATE 11: Performance Dashboard (2 screenshots)
  { id: '11a', title: 'Dashboard - After Execution', component: DemoState12DashboardAfter, subState: 'after' },
  { id: '11b', title: 'Dashboard - Revenue & Metrics', component: DemoState12DashboardAfter, subState: 'revenue' },
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
        useCORS: true,
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

  const state = STATES[currentState];
  const CurrentComponent = state.component;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Controls */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Screenshot {currentState + 1} of {STATES.length}
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
            
            <div className="flex gap-1 max-w-[400px] overflow-x-auto py-1">
              {STATES.map((state, index) => (
                <button
                  key={state.id}
                  onClick={() => setCurrentState(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors shrink-0 ${
                    index === currentState 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  title={state.title}
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
              {isDownloading ? 'Saving...' : 'Download PNG'}
            </Button>
          </div>
        </div>
      </div>

      {/* State Content */}
      <div className="flex-1 overflow-auto">
        <div ref={contentRef} className="min-h-[calc(100vh-60px)]">
          <CurrentComponent subState={state.subState} />
        </div>
      </div>
    </div>
  );
};

export default DemoWalkthrough;
