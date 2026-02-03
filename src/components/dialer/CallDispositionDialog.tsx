import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUp,
  ThumbsDown,
  CalendarClock,
  CalendarCheck,
  Phone,
  UserX,
  Shield,
  VoicemailIcon,
  XCircle,
  Plus,
  X,
  CalendarIcon,
  Clock,
} from "lucide-react";
import { format, addHours, addDays, startOfTomorrow, setHours, setMinutes } from "date-fns";

export type CallDisposition = 
  | 'interested'
  | 'not_interested'
  | 'callback'
  | 'meeting_booked'
  | 'wrong_number'
  | 'gatekeeper'
  | 'left_voicemail'
  | 'no_answer';

interface CallDispositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  callDuration: number;
  existingNotes?: string;
  onSubmit: (data: {
    disposition: CallDisposition;
    notes: string;
    tags: string[];
    scheduleCallback?: Date;
  }) => void;
}

const DISPOSITIONS: { value: CallDisposition; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'interested', label: 'Interested', icon: <ThumbsUp className="h-4 w-4" />, color: 'bg-success/10 text-success border-success/30 hover:bg-success/20' },
  { value: 'not_interested', label: 'Not Interested', icon: <ThumbsDown className="h-4 w-4" />, color: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20' },
  { value: 'callback', label: 'Call Back', icon: <CalendarClock className="h-4 w-4" />, color: 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20' },
  { value: 'meeting_booked', label: 'Meeting Booked', icon: <CalendarCheck className="h-4 w-4" />, color: 'bg-success/10 text-success border-success/30 hover:bg-success/20' },
  { value: 'left_voicemail', label: 'Left Voicemail', icon: <VoicemailIcon className="h-4 w-4" />, color: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20' },
  { value: 'no_answer', label: 'No Answer', icon: <XCircle className="h-4 w-4" />, color: 'bg-muted text-muted-foreground border-border hover:bg-muted/80' },
  { value: 'gatekeeper', label: 'Gatekeeper', icon: <Shield className="h-4 w-4" />, color: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20' },
  { value: 'wrong_number', label: 'Wrong Number', icon: <UserX className="h-4 w-4" />, color: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20' },
];

const QUICK_CALLBACK_OPTIONS = [
  { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
  { label: 'In 2 hours', getValue: () => addHours(new Date(), 2) },
  { label: 'Tomorrow 9 AM', getValue: () => setMinutes(setHours(startOfTomorrow(), 9), 0) },
  { label: 'Tomorrow 2 PM', getValue: () => setMinutes(setHours(startOfTomorrow(), 14), 0) },
  { label: 'In 2 days', getValue: () => addDays(new Date(), 2) },
  { label: 'In 1 week', getValue: () => addDays(new Date(), 7) },
];

const SUGGESTED_TAGS = [
  'Hot Lead',
  'Decision Maker',
  'Budget Holder',
  'Technical',
  'Referral',
  'Competitor User',
  'Demo Requested',
  'Pricing Discussed',
  'Follow Up',
  'Champion',
];

export function CallDispositionDialog({
  open,
  onOpenChange,
  leadName,
  callDuration,
  existingNotes = '',
  onSubmit,
}: CallDispositionDialogProps) {
  const [disposition, setDisposition] = useState<CallDisposition | null>(null);
  const [notes, setNotes] = useState(existingNotes);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [scheduleCallback, setScheduleCallback] = useState<Date | undefined>();
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customTime, setCustomTime] = useState('09:00');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = () => {
    if (!disposition) return;
    
    let finalCallbackDate = scheduleCallback;
    if (showCustomDate && scheduleCallback) {
      const [hours, minutes] = customTime.split(':').map(Number);
      finalCallbackDate = setMinutes(setHours(scheduleCallback, hours), minutes);
    }
    
    onSubmit({
      disposition,
      notes,
      tags,
      scheduleCallback: finalCallbackDate,
    });
    
    // Reset state
    setDisposition(null);
    setNotes('');
    setTags([]);
    setScheduleCallback(undefined);
    setShowCustomDate(false);
    onOpenChange(false);
  };

  const needsCallback = disposition === 'callback' || disposition === 'no_answer' || disposition === 'gatekeeper' || disposition === 'left_voicemail';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Call Completed
          </DialogTitle>
          <DialogDescription>
            {leadName} • {formatDuration(callDuration)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Disposition Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">How did the call go?</Label>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDisposition(d.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    disposition === d.value
                      ? `${d.color} ring-2 ring-offset-2 ring-primary`
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  {d.icon}
                  <span className="text-sm font-medium">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={tags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  onClick={() => tags.includes(tag) ? handleRemoveTag(tag) : handleAddTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Notes</Label>
            <Textarea
              placeholder="Add notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Schedule Callback (for relevant dispositions) */}
          {needsCallback && (
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <Label className="text-base font-medium">Schedule Follow-up</Label>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {QUICK_CALLBACK_OPTIONS.map((option) => (
                  <Button
                    key={option.label}
                    variant={scheduleCallback?.getTime() === option.getValue().getTime() ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setScheduleCallback(option.getValue());
                      setShowCustomDate(false);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={showCustomDate ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowCustomDate(true)}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Custom Date
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleCallback}
                      onSelect={(date) => {
                        setScheduleCallback(date);
                        setShowCustomDate(true);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {showCustomDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-28"
                    />
                  </div>
                )}
              </div>

              {scheduleCallback && (
                <p className="text-sm text-muted-foreground">
                  Follow-up scheduled for: <span className="text-foreground font-medium">
                    {format(scheduleCallback, 'EEEE, MMMM d, yyyy')} at {showCustomDate ? customTime : format(scheduleCallback, 'h:mm a')}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={!disposition}>
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
