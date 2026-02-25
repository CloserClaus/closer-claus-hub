import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Phone, PhoneOff, User, Building2, ShoppingCart, Lock, Mic, MicOff, FileText, PhoneCall,
} from 'lucide-react';
import { getCallStatusDisplay } from './callStatusUtils';

interface PhoneNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  assigned_to: string | null;
}

interface DialPadLead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
}

interface DialPadProps {
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  selectedLead: DialPadLead | null;
  selectedCallerId: string;
  setSelectedCallerId: (v: string) => void;
  workspacePhoneNumbers: PhoneNumber[];
  isCallActive: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  dialerAvailable: boolean;
  hasActiveSubscription: boolean;
  callStatus: string;
  formattedDuration: string;
  isMuted: boolean;
  callNotes: string;
  setCallNotes: (v: string) => void;
  showFloatingScript: boolean;
  setShowFloatingScript: (v: boolean) => void;
  onInitiateCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onDialPadPress: (digit: string) => void;
  onGoToPurchase: () => void;
  isOwner: boolean;
  userId?: string;
}

const dialPadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function DialPad({
  phoneNumber, setPhoneNumber, selectedLead, selectedCallerId, setSelectedCallerId,
  workspacePhoneNumbers, isCallActive, isLoading, isConnecting, dialerAvailable,
  hasActiveSubscription, callStatus, formattedDuration, isMuted, callNotes, setCallNotes,
  showFloatingScript, setShowFloatingScript, onInitiateCall, onEndCall, onToggleMute,
  onDialPadPress, onGoToPurchase, isOwner, userId,
}: DialPadProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Dial Pad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedLead && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{selectedLead.first_name} {selectedLead.last_name}</span>
            </div>
            {selectedLead.company && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{selectedLead.company}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Caller ID</label>
          {workspacePhoneNumbers.length > 0 ? (
            <select
              value={selectedCallerId}
              onChange={(e) => setSelectedCallerId(e.target.value)}
              className="w-full p-2 rounded-md border border-border bg-background text-sm"
              disabled={isCallActive}
            >
              {workspacePhoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.phone_number}>
                  {pn.phone_number}
                  {pn.assigned_to === userId && ' (Your Number)'}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <div className="w-full p-2 rounded-md border border-border bg-muted text-sm text-muted-foreground">
                No numbers available
              </div>
              {isOwner && (
                <Button variant="outline" size="sm" className="w-full" onClick={onGoToPurchase}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Get a Phone Number
                </Button>
              )}
            </div>
          )}
        </div>

        <Input
          type="tel"
          placeholder="Enter phone number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="text-center text-xl font-mono"
          disabled={isCallActive}
        />

        <div className="grid grid-cols-3 gap-2">
          {dialPadNumbers.map((num) => (
            <Button key={num} variant="outline" size="lg" onClick={() => onDialPadPress(num)} className="text-lg font-medium">
              {num}
            </Button>
          ))}
        </div>

        {isCallActive ? (
          <div className="space-y-4">
            {!showFloatingScript && (
              <Button variant="outline" size="sm" onClick={() => setShowFloatingScript(true)} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Show Call Script
              </Button>
            )}

            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-success mb-2">
                {getCallStatusDisplay(callStatus).icon}
                <span className="font-medium">{getCallStatusDisplay(callStatus).text}</span>
              </div>
              <p className="text-2xl font-mono">{formattedDuration}</p>
            </div>

            <div className="flex justify-center gap-2">
              <Button variant={isMuted ? "destructive" : "outline"} size="icon" onClick={onToggleMute} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </div>

            <Textarea placeholder="Call notes..." value={callNotes} onChange={(e) => setCallNotes(e.target.value)} rows={3} />

            <Button variant="destructive" size="lg" className="w-full" onClick={onEndCall} disabled={isLoading}>
              <PhoneOff className="h-5 w-5 mr-2" />
              End Call
            </Button>
          </div>
        ) : !hasActiveSubscription ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full" disabled>
              <Lock className="h-5 w-5 mr-2" />
              Subscription Required
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Activate a subscription to start making calls and unlock 1,000 free minutes/mo.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = '/subscription'}>
              View Plans
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={onInitiateCall}
            disabled={isLoading || !phoneNumber || !dialerAvailable || !selectedCallerId}
          >
            <Phone className="h-5 w-5 mr-2" />
            {isLoading ? "Connecting..." : isConnecting ? "Initializing..." : "Call"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
