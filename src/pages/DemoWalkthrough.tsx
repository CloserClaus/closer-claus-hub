import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Download, Play, Pause, RotateCcw, Rocket } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

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

const STATES = [
  { 
    id: '1', title: 'Job Posted', component: DemoStateJobPosted,
    phase: 'Hiring',
    narration: 'Post a job listing to attract commission-based SDRs. Define the role, compensation structure, and ICP — all from one screen.'
  },
  { 
    id: '2', title: 'Rep Applied', component: DemoStateRepApplied,
    phase: 'Hiring',
    narration: 'Qualified reps apply directly through the marketplace. Review cover letters, experience, and fit before accepting.'
  },
  { 
    id: '3', title: 'Rep Accepted', component: DemoStateRepAccepted,
    phase: 'Hiring',
    narration: 'Accept top candidates and they\'re instantly onboarded into your workspace with the right permissions.'
  },
  { 
    id: '4', title: 'Lead Filters', component: DemoStateLeadFilters,
    phase: 'Sourcing',
    narration: 'Configure precision filters — industry, seniority, company size, geography — to source your ideal prospects from 275M+ contacts.'
  },
  { 
    id: '5', title: 'Lead Preview', component: DemoStateLeadPreview,
    phase: 'Sourcing',
    narration: 'Preview leads before importing. See verified emails, phone numbers, and company data to ensure quality before spending credits.'
  },
  { 
    id: '6', title: 'Leads Imported', component: DemoStateLeadImported,
    phase: 'Sourcing',
    narration: 'Import leads directly into your CRM with one click. All data is enriched and ready for outreach.'
  },
  { 
    id: '7', title: 'Empty Pipeline', component: DemoStatePipelineEmpty,
    phase: 'CRM',
    narration: 'Your CRM pipeline starts clean. Stages are pre-configured for outbound sales: Prospecting → Qualified → Proposal → Closed.'
  },
  { 
    id: '8', title: 'Active Pipeline', component: DemoStatePipelinePopulated,
    phase: 'CRM',
    narration: 'As your SDRs work, deals flow through the pipeline. Drag-and-drop cards between stages, track values, and monitor velocity.'
  },
  { 
    id: '9', title: 'Dialer Ready', component: DemoStateDialerIdle,
    phase: 'Calling',
    narration: 'The browser-based dialer loads your lead queue. Select a caller ID, review the call script, and start dialing — no external tools needed.'
  },
  { 
    id: '10', title: 'Active Call', component: DemoStateDialerActive,
    phase: 'Calling',
    narration: 'During live calls, SDRs see the script, lead details, and can take notes in real-time. All calls are recorded for coaching.'
  },
  { 
    id: '11', title: 'Call Logged', component: DemoStateCallEnded,
    phase: 'Calling',
    narration: 'After each call, log the disposition, add tags, and schedule follow-ups. Everything syncs to the CRM automatically.'
  },
  { 
    id: '12', title: 'Meeting Booked', component: DemoStateMeetingBooked,
    phase: 'Closing',
    narration: 'When a prospect is interested, the meeting is booked and the deal moves forward. Calendar integration keeps everyone aligned.'
  },
  { 
    id: '13', title: 'Deal Closed', component: DemoStateDealClosed,
    phase: 'Closing',
    narration: 'Deal closed! The system automatically calculates commissions based on the deal value and your compensation structure.'
  },
  { 
    id: '14', title: 'Contract Sent', component: DemoStateContractSent,
    phase: 'Contracts',
    narration: 'Generate and send professional contracts directly from the platform. Clients receive a secure signing link via email.'
  },
  { 
    id: '15', title: 'Contract Signed', component: DemoStateContractSigned,
    phase: 'Contracts',
    narration: 'E-signatures are captured with OTP verification, IP logging, and timestamp audit trails for legal compliance.'
  },
  { 
    id: '16', title: 'Commission Calculated', component: DemoStateCommissionCalculated,
    phase: 'Payouts',
    narration: 'Commissions are auto-calculated with transparent breakdowns: deal value, commission rate, platform fee, and net payout.'
  },
  { 
    id: '17', title: 'Commission Paid', component: DemoStateCommissionPaid,
    phase: 'Payouts',
    narration: 'One-click payouts via Stripe Connect. SDRs receive funds directly to their bank account with full audit trails.'
  },
  { 
    id: '18', title: 'Early Dashboard', component: DemoStateDashboardEarly,
    phase: 'Analytics',
    narration: 'Track performance from day one. See calls made, meetings booked, deals in pipeline, and revenue generated.'
  },
  { 
    id: '19', title: 'Scaled Dashboard', component: DemoStateDashboardScaled,
    phase: 'Analytics',
    narration: 'As your team scales, the dashboard shows team-wide metrics, leaderboards, and trend analysis across all SDRs.'
  },
];

const PHASE_COLORS: Record<string, string> = {
  'Hiring': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Sourcing': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'CRM': 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  'Calling': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Closing': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'Contracts': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  'Payouts': 'bg-green-500/10 text-green-500 border-green-500/20',
  'Analytics': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const AUTO_PLAY_INTERVAL = 6000;

const DemoWalkthrough = () => {
  usePageTracking();
  const [currentState, setCurrentState] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = null;
    setIsAutoPlaying(false);
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    setIsAutoPlaying(true);
    autoPlayRef.current = setInterval(() => {
      setCurrentState(prev => {
        if (prev >= STATES.length - 1) {
          stopAutoPlay();
          return prev;
        }
        return prev + 1;
      });
    }, AUTO_PLAY_INTERVAL);
  }, [stopAutoPlay]);

  useEffect(() => () => stopAutoPlay(), [stopAutoPlay]);

  const handleNext = () => { stopAutoPlay(); if (currentState < STATES.length - 1) setCurrentState(currentState + 1); };
  const handlePrev = () => { stopAutoPlay(); if (currentState > 0) setCurrentState(currentState - 1); };

  const handleDownload = async () => {
    if (!contentRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2, backgroundColor: '#09090b', logging: false, useCORS: true });
      const link = document.createElement('a');
      link.download = `closer-claus-${String(currentState + 1).padStart(2, '0')}-${STATES[currentState].title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) { console.error('Failed to download image:', error); }
    finally { setIsDownloading(false); }
  };

  const handleStartTour = () => { setShowIntro(false); setCurrentState(0); startAutoPlay(); };
  const handleStartManual = () => { setShowIntro(false); setCurrentState(0); };

  const state = STATES[currentState];
  const CurrentComponent = state.component;
  const isLastStep = currentState === STATES.length - 1;

  // Intro overlay
  if (showIntro) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <Badge variant="outline" className="text-sm px-4 py-1">Interactive Product Tour</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              See the full sales cycle<br />
              <span className="text-primary">in action</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Walk through 19 real screenshots showing how Closer Claus handles everything from hiring SDRs to paying commissions — end to end.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={handleStartTour} className="gap-2 text-base">
              <Play className="h-5 w-5" /> Auto-Play Tour
            </Button>
            <Button size="lg" variant="outline" onClick={handleStartManual} className="gap-2 text-base">
              <ChevronRight className="h-5 w-5" /> Browse Manually
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {['Hiring', 'Sourcing', 'CRM', 'Calling', 'Closing', 'Contracts', 'Payouts', 'Analytics'].map(phase => (
              <Badge key={phase} variant="outline" className={PHASE_COLORS[phase]}>
                {phase}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Controls */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-mono">
              {String(currentState + 1).padStart(2, '0')}/{STATES.length}
            </span>
            <Badge variant="outline" className={PHASE_COLORS[state.phase]}>
              {state.phase}
            </Badge>
            <span className="font-medium hidden sm:inline">{state.title}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowIntro(true); stopAutoPlay(); setCurrentState(0); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={isAutoPlaying ? stopAutoPlay : startAutoPlay}>
              {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentState === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1 max-w-[400px] overflow-x-auto py-1">
              {STATES.map((s, index) => (
                <button
                  key={index}
                  onClick={() => { stopAutoPlay(); setCurrentState(index); }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors shrink-0 ${
                    index === currentState ? 'bg-primary' : index < currentState ? 'bg-primary/40' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  title={STATES[index].title}
                />
              ))}
            </div>
            
            <Button variant="outline" size="sm" onClick={handleNext} disabled={isLastStep}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
            
            <Button variant="default" size="sm" onClick={handleDownload} disabled={isDownloading} className="hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Saving...' : 'PNG'}
            </Button>
          </div>
        </div>
      </div>

      {/* Narration Bar */}
      <div className="bg-muted/50 border-b border-border px-4 py-3">
        <div className="max-w-[1800px] mx-auto">
          <p className="text-sm text-muted-foreground leading-relaxed">{state.narration}</p>
        </div>
      </div>

      {/* State Content */}
      <div className="flex-1 overflow-auto">
        <div ref={contentRef} className="min-h-[calc(100vh-120px)]">
          <CurrentComponent />
        </div>
      </div>

      {/* Final CTA */}
      {isLastStep && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-4">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              That's the complete sales cycle. Ready to install it in your business?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild className="gap-2">
                <a href="/offer-diagnostic">
                  <Rocket className="h-5 w-5" /> Get Your Free Offer Diagnostic
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/auth">Start Free Trial</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoWalkthrough;
