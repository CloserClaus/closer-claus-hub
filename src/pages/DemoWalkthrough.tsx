import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Download } from 'lucide-react';

// Import all demo states - 19 distinct screenshots
import { DemoStateJobPosted } from '@/components/demo/DemoStateJobPosted';
import { DemoStateRepApplied } from '@/components/demo/DemoStateRepApplied';
import { DemoStateRepAccepted } from '@/components/demo/DemoStateRepAccepted';
import { DemoStateLeadFilters } from '@/components/demo/DemoStateLeadFilters';
import { DemoStateLeadPreview } from '@/components/demo/DemoStateLeadPreview';
import { DemoStateLeadImported } from '@/components/demo/DemoStateLeadImported';
import { DemoStatePipelineEmpty } from '@/components/demo/DemoStatePipelineEmpty';
import { DemoStatePipelinePopulated } from '@/components/demo/DemoStatePipelinePopulated';
import { DemoStateDialerIdle } from '@/components/demo/DemoStateDialerIdle';
import { DemoStateDialerActive } from '@/components/demo/DemoStateDialerActive';
import { DemoStateCallEnded } from '@/components/demo/DemoStateCallEnded';
import { DemoStateMeetingBooked } from '@/components/demo/DemoStateMeetingBooked';
import { DemoStateDealClosed } from '@/components/demo/DemoStateDealClosed';
import { DemoStateContractSent } from '@/components/demo/DemoStateContractSent';
import { DemoStateContractSigned } from '@/components/demo/DemoStateContractSigned';
import { DemoStateCommissionCalculated } from '@/components/demo/DemoStateCommissionCalculated';
import { DemoStateCommissionPaid } from '@/components/demo/DemoStateCommissionPaid';
import { DemoStateDashboardEarly } from '@/components/demo/DemoStateDashboardEarly';
import { DemoStateDashboardScaled } from '@/components/demo/DemoStateDashboardScaled';

// All 19 states as specified - each visually distinct
const STATES = [
  { id: '1', title: 'Job Posted (Live, 0 Applicants)', component: DemoStateJobPosted },
  { id: '2', title: 'Sales Rep Applied', component: DemoStateRepApplied },
  { id: '3', title: 'Sales Rep Accepted', component: DemoStateRepAccepted },
  { id: '4', title: 'Lead Sourcing Filters Configured', component: DemoStateLeadFilters },
  { id: '5', title: 'Leads Previewed (Pre-Import)', component: DemoStateLeadPreview },
  { id: '6', title: 'Leads Imported to CRM', component: DemoStateLeadImported },
  { id: '7', title: 'CRM Pipeline Empty', component: DemoStatePipelineEmpty },
  { id: '8', title: 'Pipeline Populated with Deals', component: DemoStatePipelinePopulated },
  { id: '9', title: 'Dialer Idle (Queue Loaded)', component: DemoStateDialerIdle },
  { id: '10', title: 'Active Call in Progress', component: DemoStateDialerActive },
  { id: '11', title: 'Call Ended + Logged', component: DemoStateCallEnded },
  { id: '12', title: 'Meeting Booked', component: DemoStateMeetingBooked },
  { id: '13', title: 'Deal Closed Won', component: DemoStateDealClosed },
  { id: '14', title: 'Contract Sent', component: DemoStateContractSent },
  { id: '15', title: 'Contract Signed', component: DemoStateContractSigned },
  { id: '16', title: 'Commission Calculated', component: DemoStateCommissionCalculated },
  { id: '17', title: 'Commission Paid', component: DemoStateCommissionPaid },
  { id: '18', title: 'Performance Dashboard (Early)', component: DemoStateDashboardEarly },
  { id: '19', title: 'Performance Dashboard (Scaled)', component: DemoStateDashboardScaled },
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
      link.download = `closer-claus-${String(currentState + 1).padStart(2, '0')}-${STATES[currentState].title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
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
            <span className="text-sm text-muted-foreground font-mono">
              {String(currentState + 1).padStart(2, '0')}/{STATES.length}
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
            
            <div className="flex gap-1 max-w-[500px] overflow-x-auto py-1">
              {STATES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentState(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors shrink-0 ${
                    index === currentState 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  title={STATES[index].title}
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
          <CurrentComponent />
        </div>
      </div>
    </div>
  );
};

export default DemoWalkthrough;