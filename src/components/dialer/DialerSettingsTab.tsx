import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, User, PhoneForwarded, Loader2, Check, Settings } from "lucide-react";
import { toast } from "sonner";

interface PhoneNumber {
  id: string;
  phone_number: string;
  is_active: boolean;
  assigned_to: string | null;
  forwarding_number: string | null;
}

interface SDRMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface DialerSettingsTabProps {
  workspaceId: string;
  onNumbersUpdated?: () => void;
}

export function DialerSettingsTab({ workspaceId, onNumbersUpdated }: DialerSettingsTabProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [sdrMembers, setSDRMembers] = useState<SDRMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [forwardingInputs, setForwardingInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchPhoneNumbers(), fetchSDRMembers()]);
    setIsLoading(false);
  };

  const fetchPhoneNumbers = async () => {
    const { data, error } = await supabase
      .from('workspace_phone_numbers')
      .select('id, phone_number, is_active, assigned_to, forwarding_number')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Error fetching phone numbers:', error);
      return;
    }

    setPhoneNumbers(data || []);
    // Initialize forwarding inputs
    const inputs: Record<string, string> = {};
    (data || []).forEach(pn => {
      inputs[pn.id] = pn.forwarding_number || '';
    });
    setForwardingInputs(inputs);
  };

  const fetchSDRMembers = async () => {
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('id, user_id')
      .eq('workspace_id', workspaceId)
      .is('removed_at', null);

    if (membersError || !members?.length) {
      setSDRMembers([]);
      return;
    }

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
    setSDRMembers(members.map(m => ({
      id: m.id,
      user_id: m.user_id,
      profiles: profilesMap.get(m.user_id) || undefined,
    })));
  };

  const handleAssignNumber = async (numberId: string, userId: string | null) => {
    setSavingId(numberId);
    try {
      const { error } = await supabase
        .from('workspace_phone_numbers')
        .update({ assigned_to: userId })
        .eq('id', numberId);

      if (error) throw error;

      toast.success(userId ? "Number assigned successfully" : "Number unassigned");
      fetchPhoneNumbers();
      onNumbersUpdated?.();
    } catch {
      toast.error("Failed to assign number");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveForwarding = async (numberId: string) => {
    const forwardingNumber = forwardingInputs[numberId]?.trim() || null;
    setSavingId(numberId);

    try {
      // Update in database
      const { error } = await supabase
        .from('workspace_phone_numbers')
        .update({ forwarding_number: forwardingNumber })
        .eq('id', numberId);

      if (error) throw error;

      // Update Twilio number configuration to point voice URL to our webhook
      const pn = phoneNumbers.find(p => p.id === numberId);
      if (pn) {
        const { data, error: fnError } = await supabase.functions.invoke('twilio', {
          body: {
            action: 'update_forwarding',
            phone_number: pn.phone_number,
            forwarding_number: forwardingNumber,
            workspace_id: workspaceId,
          },
        });

        if (fnError) {
          console.error('Error updating Twilio config:', fnError);
          toast.error("Saved locally but failed to update call routing. Try again.");
          setSavingId(null);
          return;
        }
      }

      toast.success(forwardingNumber ? "Forwarding number saved" : "Forwarding disabled");
      fetchPhoneNumbers();
    } catch {
      toast.error("Failed to save forwarding number");
    } finally {
      setSavingId(null);
    }
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null;
    const member = sdrMembers.find(m => m.user_id === userId);
    return member?.profiles?.full_name || member?.profiles?.email || 'Team Member';
  };

  const getAssignedCount = (userId: string) => {
    return phoneNumbers.filter(pn => pn.assigned_to === userId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phoneNumbers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Phone className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Phone Numbers</h3>
          <p className="text-muted-foreground max-w-md">
            Purchase phone numbers from the Purchase tab first, then come back here to assign them to SDRs and configure call forwarding.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Dialer Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Assign numbers to SDRs and configure inbound call forwarding.
        </p>
      </div>

      <div className="space-y-4">
        {phoneNumbers.map(pn => (
          <Card key={pn.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  {pn.phone_number}
                </CardTitle>
                {pn.assigned_to && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {getAssigneeName(pn.assigned_to)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SDR Assignment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign to SDR</Label>
                <Select
                  value={pn.assigned_to || "unassigned"}
                  onValueChange={(value) => handleAssignNumber(pn.id, value === "unassigned" ? null : value)}
                  disabled={savingId === pn.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {sdrMembers.map(member => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles?.full_name || member.profiles?.email || 'Team Member'}
                        {` (${getAssignedCount(member.user_id)} numbers)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Forwarding Number */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <PhoneForwarded className="h-4 w-4" />
                  Inbound Call Forwarding
                </Label>
                <p className="text-xs text-muted-foreground">
                  When someone calls this number back, the call will be forwarded to the number below.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={forwardingInputs[pn.id] || ''}
                    onChange={(e) => setForwardingInputs(prev => ({ ...prev, [pn.id]: e.target.value }))}
                    className="font-mono"
                    disabled={savingId === pn.id}
                  />
                  <Button
                    onClick={() => handleSaveForwarding(pn.id)}
                    disabled={savingId === pn.id || forwardingInputs[pn.id] === (pn.forwarding_number || '')}
                    size="sm"
                    className="shrink-0"
                  >
                    {savingId === pn.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
