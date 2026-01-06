import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Phone, 
  FileSignature, 
  GraduationCap, 
  DollarSign,
  X,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface SDROnboardingTipsProps {
  stats: {
    workspaces: number;
    totalEarnings: number;
    closedDealsLast30Days: number;
    callsToday: number;
  };
  onDismiss?: () => void;
}

interface TipItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  route: string;
  isComplete: boolean;
}

export function SDROnboardingTips({ stats, onDismiss }: SDROnboardingTipsProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('sdr_onboarding_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const tips: TipItem[] = [
    {
      id: 'join-company',
      title: 'Join a Company',
      description: 'Browse available jobs and apply to start earning commissions',
      icon: Briefcase,
      action: 'Browse Jobs',
      route: '/jobs',
      isComplete: stats.workspaces > 0,
    },
    {
      id: 'training',
      title: 'Complete Training',
      description: 'Review training materials provided by your agency',
      icon: GraduationCap,
      action: 'View Training',
      route: '/training',
      isComplete: stats.workspaces > 0, // Can only access if in a workspace
    },
    {
      id: 'first-call',
      title: 'Make Your First Call',
      description: 'Use the dialer to reach out to leads and start conversations',
      icon: Phone,
      action: 'Open Dialer',
      route: '/dialer',
      isComplete: stats.callsToday > 0,
    },
    {
      id: 'close-deal',
      title: 'Close Your First Deal',
      description: 'Move a lead through the pipeline and request a contract',
      icon: FileSignature,
      action: 'View CRM',
      route: '/crm',
      isComplete: stats.closedDealsLast30Days > 0,
    },
    {
      id: 'earn-commission',
      title: 'Earn Commissions',
      description: 'Get paid when your deals close successfully',
      icon: DollarSign,
      action: 'View Earnings',
      route: '/commissions',
      isComplete: stats.totalEarnings > 0,
    },
  ];

  const completedCount = tips.filter(t => t.isComplete).length;
  const progressPercentage = (completedCount / tips.length) * 100;

  // Don't show if all complete or dismissed
  if (isDismissed || completedCount === tips.length) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem('sdr_onboarding_dismissed', 'true');
    setIsDismissed(true);
    onDismiss?.();
  };

  const incompleteTips = tips.filter(t => !t.isComplete).slice(0, 3);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Getting Started</CardTitle>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {tips.length} steps completed
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progressPercentage} className="h-2 mt-3" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {incompleteTips.map((tip) => (
            <div
              key={tip.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors cursor-pointer group"
              onClick={() => navigate(tip.route)}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <tip.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tip.title}</p>
                  <p className="text-xs text-muted-foreground">{tip.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}