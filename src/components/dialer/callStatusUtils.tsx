import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  PhoneCall, PhoneOutgoing, PhoneOff, PhoneMissed, PhoneIncoming, AlertCircle,
} from 'lucide-react';

export const getCallStatusBadge = (status: string, durationSeconds?: number | null, disposition?: string | null): ReactNode => {
  const humanDispositions = ['interested', 'not_interested', 'meeting_booked', 'callback'];
  const wasPickedUp = disposition
    ? humanDispositions.includes(disposition)
    : (status === 'completed' || status === 'in-progress' || status === 'in_progress') && (durationSeconds ?? 0) > 120;

  if (wasPickedUp) {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
        <PhoneCall className="h-3 w-3" />Picked Up
      </Badge>
    );
  }

  switch (status) {
    case 'completed':
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1"><PhoneOutgoing className="h-3 w-3" />Completed</Badge>;
    case 'initiated':
    case 'ringing':
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1"><PhoneOutgoing className="h-3 w-3" />Attempted</Badge>;
    case 'in-progress':
    case 'in_progress':
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1"><PhoneCall className="h-3 w-3" />In Progress</Badge>;
    case 'busy':
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1"><PhoneOff className="h-3 w-3" />Busy</Badge>;
    case 'no-answer':
    case 'no_answer':
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><PhoneMissed className="h-3 w-3" />No Answer</Badge>;
    case 'missed':
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><PhoneIncoming className="h-3 w-3" />Missed</Badge>;
    case 'failed':
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export const formatCallDuration = (seconds: number | null): string | null => {
  if (!seconds || seconds === 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getCallStatusDisplay = (callStatus: string) => {
  switch (callStatus) {
    case 'connecting':
      return { text: 'Connecting...', icon: <PhoneCall className="h-5 w-5 animate-pulse" /> };
    case 'ringing':
      return { text: 'Ringing...', icon: <PhoneCall className="h-5 w-5 animate-pulse" /> };
    case 'in_progress':
      return { text: 'Call in progress', icon: <PhoneCall className="h-5 w-5" /> };
    default:
      return { text: 'Call in progress', icon: <PhoneCall className="h-5 w-5" /> };
  }
};
